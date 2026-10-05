import { NextResponse } from "next/server";
import { resolvePosStoreScope } from "@/lib/pos/access";
import { tryRecordPosAuditLog } from "@/lib/pos/server/pos-audit.server";
import { commitPosInventoryImport } from "@/lib/pos/server/pos-inventory-import.server";
import { requirePosSession } from "@/lib/pos/server/pos-route";
import { type PosInventoryImportRowInput } from "@/lib/pos/types";

export async function POST(request: Request) {
  const auth = await requirePosSession("pos.inventory.import", {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;

  const payload = (await request.json()) as {
    rows?: PosInventoryImportRowInput[];
    operator?: string;
  };
  if (!Array.isArray(payload?.rows)) {
    return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
  }

  try {
    const rows = [];
    for (const row of payload.rows) {
      const scoped = resolvePosStoreScope(auth.pos, row.storeId, { requireStore: true });
      if (!scoped.ok) {
        await tryRecordPosAuditLog({
          tenantId: auth.scope.tenantId,
          companyId: auth.scope.companyId,
          input: {
            actionType: "access_denied",
            module: "inventory_import",
            actorUserId: auth.session.userId,
            actorName: auth.session.name || auth.session.userId,
            actorRole: auth.pos.role,
            storeId: auth.pos.defaultStoreId,
            summary: "库存导入门店范围越权",
            detailsJson: {
              attemptedAction: "inventory_import_committed",
              requestedStoreId: row.storeId || null,
              reason: scoped.error,
            },
            resultStatus: "denied",
          },
        });
        throw new Error(scoped.error);
      }
      rows.push({ ...row, storeId: scoped.storeId! });
    }
    const result = await commitPosInventoryImport({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      rows,
      operator: payload.operator || auth.session.userId,
    });
    await tryRecordPosAuditLog({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      input: {
        actionType: "inventory_import_committed",
        module: "inventory_import",
        actorUserId: auth.session.userId,
        actorName: auth.session.name || auth.session.userId,
        actorRole: auth.pos.role,
        storeId: rows[0]?.storeId || auth.pos.defaultStoreId,
        summary: `完成库存导入 ${result.importedCount}/${result.totalRows}`,
        detailsJson: {
          rowCount: result.totalRows,
          successCount: result.importedCount,
        },
        resultStatus: "success",
      },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    await tryRecordPosAuditLog({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      input: {
        actionType: "inventory_import_committed",
        module: "inventory_import",
        actorUserId: auth.session.userId,
        actorName: auth.session.name || auth.session.userId,
        actorRole: auth.pos.role,
        storeId: auth.pos.defaultStoreId,
        summary: "库存导入失败",
        detailsJson: {
          rowCount: payload.rows.length,
          error: error instanceof Error ? error.message : "POS_IMPORT_COMMIT_FAILED",
        },
        resultStatus: "failed",
      },
    });
    if (error instanceof Error && error.message === "POS_IMPORT_PREVIEW_INVALID") {
      const preview = (error as Error & { preview?: unknown }).preview;
      return NextResponse.json({ ok: false, error: error.message, preview }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "POS_IMPORT_COMMIT_FAILED";
    const status = message === "POS_STORE_SCOPE_DENIED" ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
