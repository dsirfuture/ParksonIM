import { NextResponse } from "next/server";
import { tryRecordPosAuditLog } from "@/lib/pos/server/pos-audit.server";
import { refundPosSale } from "@/lib/pos/server/pos-refund.server";
import { getPosSaleDetail } from "@/lib/pos/server/pos-sales.server";
import { ensurePosStoreAccess, requirePosSession } from "@/lib/pos/server/pos-route";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePosSession("pos.sale.refund", {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;

  const params = await context.params;
  const payload = (await request.json().catch(() => ({}))) as { reason?: string };
  try {
    const sale = await getPosSaleDetail({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      id: params.id,
    });
    const access = ensurePosStoreAccess(auth.pos, sale.storeId);
    if (!access.ok) {
      await tryRecordPosAuditLog({
        tenantId: auth.scope.tenantId,
        companyId: auth.scope.companyId,
        input: {
          actionType: "access_denied",
          module: "sales_docs",
          actorUserId: auth.session.userId,
          actorName: auth.session.name || auth.session.userId,
          actorRole: auth.pos.role,
          storeId: auth.pos.defaultStoreId,
          targetType: "sale",
          targetId: sale.id,
          targetFolio: sale.folio,
          summary: `退款门店范围越权 ${sale.folio}`,
          detailsJson: {
            attemptedAction: "refund",
            targetStoreId: sale.storeId,
            reason: "POS_STORE_SCOPE_DENIED",
          },
          resultStatus: "denied",
        },
      });
      return access.response;
    }
    const item = await refundPosSale({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      saleId: params.id,
      cashierId: auth.session.userId,
      cashierName: auth.session.name,
      reason: payload.reason || "",
    });
    await tryRecordPosAuditLog({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      input: {
        actionType: "refund_completed",
        module: "sales_docs",
        actorUserId: auth.session.userId,
        actorName: auth.session.name || auth.session.userId,
        actorRole: auth.pos.role,
        storeId: sale.storeId,
        targetType: "refund",
        targetId: item.id,
        targetFolio: item.folio,
        summary: `完成退款 ${item.folio}`,
        detailsJson: {
          refundFolio: item.folio,
          originalSaleFolio: sale.folio,
          total: item.total,
        },
        resultStatus: "success",
      },
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "POS_REFUND_FAILED";
    await tryRecordPosAuditLog({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      input: {
        actionType: "refund_completed",
        module: "sales_docs",
        actorUserId: auth.session.userId,
        actorName: auth.session.name || auth.session.userId,
        actorRole: auth.pos.role,
        storeId: auth.pos.defaultStoreId,
        targetType: "sale",
        targetId: params.id,
        summary: "退款失败",
        detailsJson: {
          error: message,
        },
        resultStatus: "failed",
      },
    });
    const status = message === "POS_SALE_NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
