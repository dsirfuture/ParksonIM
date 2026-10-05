import { NextResponse } from "next/server";
import { canAccessPosStore } from "@/lib/pos/access";
import { tryRecordPosAuditLog } from "@/lib/pos/server/pos-audit.server";
import { getPosTransferDetail, sendTransfer } from "@/lib/pos/server/pos-transfers.server";
import { requirePosSession } from "@/lib/pos/server/pos-route";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePosSession("pos.transfer.send", {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;

  const params = await context.params;
  try {
    const current = await getPosTransferDetail({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      id: params.id,
    });
    if (!auth.pos.allowAllStores && !canAccessPosStore(auth.pos, current.fromStoreId)) {
      await tryRecordPosAuditLog({
        tenantId: auth.scope.tenantId,
        companyId: auth.scope.companyId,
        input: {
          actionType: "access_denied",
          module: "transfers",
          actorUserId: auth.session.userId,
          actorName: auth.session.name || auth.session.userId,
          actorRole: auth.pos.role,
          storeId: auth.pos.defaultStoreId,
          targetType: "transfer",
          targetId: current.id,
          targetFolio: current.folio,
          summary: `调拨发出门店范围越权 ${current.folio}`,
          detailsJson: {
            attemptedAction: "transfer_sent",
            targetStoreId: current.fromStoreId,
            reason: "POS_STORE_SCOPE_DENIED",
          },
          resultStatus: "denied",
        },
      });
      return NextResponse.json({ ok: false, error: "POS_STORE_SCOPE_DENIED" }, { status: 403 });
    }
    const item = await sendTransfer({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      id: params.id,
      operator: auth.session.name || auth.session.userId,
    });
    await tryRecordPosAuditLog({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      input: {
        actionType: "transfer_sent",
        module: "transfers",
        actorUserId: auth.session.userId,
        actorName: auth.session.name || auth.session.userId,
        actorRole: auth.pos.role,
        storeId: item.fromStoreId || null,
        targetType: "transfer",
        targetId: item.id,
        targetFolio: item.folio,
        summary: `发出调拨 ${item.folio}`,
        detailsJson: {
          fromStoreId: item.fromStoreId,
          toStoreId: item.toStoreId,
          lineCount: item.lines?.length || 0,
        },
        resultStatus: "success",
      },
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "POS_TRANSFER_FAILED";
    await tryRecordPosAuditLog({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      input: {
        actionType: "transfer_sent",
        module: "transfers",
        actorUserId: auth.session.userId,
        actorName: auth.session.name || auth.session.userId,
        actorRole: auth.pos.role,
        storeId: auth.pos.defaultStoreId,
        targetType: "transfer",
        targetId: params.id,
        summary: "发出调拨失败",
        detailsJson: { error: message },
        resultStatus: "failed",
      },
    });
    const status = message === "POS_TRANSFER_NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
