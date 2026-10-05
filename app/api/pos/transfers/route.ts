import { NextResponse } from "next/server";
import { canAccessPosStore } from "@/lib/pos/access";
import { tryRecordPosAuditLog } from "@/lib/pos/server/pos-audit.server";
import { createTransfer, listPosTransfers } from "@/lib/pos/server/pos-transfers.server";
import { requirePosSession } from "@/lib/pos/server/pos-route";

export async function GET(request: Request) {
  const auth = await requirePosSession("pos.transfer.view", {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const result = await listPosTransfers({
    tenantId: auth.scope.tenantId,
    companyId: auth.scope.companyId,
    query: {
      fromStoreId: auth.pos.allowAllStores ? (url.searchParams.get("fromStoreId") || "") : "",
      toStoreId: auth.pos.allowAllStores ? (url.searchParams.get("toStoreId") || "") : "",
      relatedStoreId: auth.pos.allowAllStores ? "" : auth.pos.defaultStoreId,
      status: url.searchParams.get("status") || "",
      folio: url.searchParams.get("folio") || "",
      dateFrom: url.searchParams.get("dateFrom") || "",
      dateTo: url.searchParams.get("dateTo") || "",
      page: Number(url.searchParams.get("page") || 1),
      limit: Number(url.searchParams.get("limit") || 20),
    },
  });
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(request: Request) {
  const auth = await requirePosSession("pos.transfer.create", {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;

  const payload = (await request.json().catch(() => ({}))) as {
    input?: {
      fromStoreId?: string;
      toStoreId?: string;
      note?: string;
      lines?: Array<{
        productId?: string;
        barcode?: string;
        clave?: string;
        nameCn?: string;
        nameEs?: string;
        spec?: string;
        qty?: number;
      }>;
    };
  };

  try {
    const fromStoreId = payload.input?.fromStoreId || "";
    const toStoreId = payload.input?.toStoreId || "";
    if (
      !auth.pos.allowAllStores &&
      !canAccessPosStore(auth.pos, fromStoreId) &&
      !canAccessPosStore(auth.pos, toStoreId)
    ) {
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
          summary: "调拨门店范围越权",
          detailsJson: {
            attemptedAction: "transfer_created",
            fromStoreId,
            toStoreId,
            reason: "POS_STORE_SCOPE_DENIED",
          },
          resultStatus: "denied",
        },
      });
      return NextResponse.json({ ok: false, error: "POS_STORE_SCOPE_DENIED" }, { status: 403 });
    }
    const item = await createTransfer({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      input: {
        fromStoreId,
        toStoreId,
        note: payload.input?.note || "",
        createdBy: auth.session.userId,
        createdByName: auth.session.name || auth.session.userId,
        lines: (payload.input?.lines || []).map((line) => ({
          productId: line.productId || "",
          barcode: line.barcode || "",
          clave: line.clave || "",
          nameCn: line.nameCn || "",
          nameEs: line.nameEs || "",
          spec: line.spec || "",
          qty: Number(line.qty || 0),
        })),
      },
    });
    await tryRecordPosAuditLog({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      input: {
        actionType: "transfer_created",
        module: "transfers",
        actorUserId: auth.session.userId,
        actorName: auth.session.name || auth.session.userId,
        actorRole: auth.pos.role,
        storeId: item.fromStoreId || null,
        targetType: "transfer",
        targetId: item.id,
        targetFolio: item.folio,
        summary: `创建调拨 ${item.folio}`,
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
        actionType: "transfer_created",
        module: "transfers",
        actorUserId: auth.session.userId,
        actorName: auth.session.name || auth.session.userId,
        actorRole: auth.pos.role,
        storeId: auth.pos.defaultStoreId,
        summary: "创建调拨失败",
        detailsJson: { error: message },
        resultStatus: "failed",
      },
    });
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
