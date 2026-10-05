import { NextResponse } from "next/server";
import { resolvePosStoreScope } from "@/lib/pos/access";
import { tryRecordPosAuditLog } from "@/lib/pos/server/pos-audit.server";
import { checkoutPosSale } from "@/lib/pos/server/pos-checkout.server";
import { requirePosSession } from "@/lib/pos/server/pos-route";
import { type PosCheckoutInput } from "@/lib/pos/types";

export async function POST(request: Request) {
  const auth = await requirePosSession("pos.sale.checkout");
  if (!auth.ok) return auth.response;

  const payload = (await request.json()) as { input?: PosCheckoutInput };
  if (!payload?.input || !Array.isArray(payload.input.lines) || payload.input.lines.length === 0) {
    return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const storeScope = resolvePosStoreScope(auth.pos, payload.input.store?.storeId, {
    requireStore: true,
  });
  if (!storeScope.ok) {
    await tryRecordPosAuditLog({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      input: {
        actionType: "access_denied",
        module: "cashier",
        actorUserId: auth.session.userId,
        actorName: auth.session.name || auth.session.userId,
        actorRole: auth.pos.role,
        storeId: auth.pos.defaultStoreId,
        summary: "收银门店范围越权",
        detailsJson: {
          attemptedAction: "checkout",
          requestedStoreId: payload.input.store?.storeId || null,
          reason: storeScope.error,
        },
        resultStatus: "denied",
      },
    });
    return NextResponse.json({ ok: false, error: storeScope.error }, { status: 403 });
  }

  try {
    const sale = await checkoutPosSale({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      input: {
        ...payload.input,
        store: {
          storeId: storeScope.storeId!,
          storeName: payload.input.store?.storeName || auth.pos.defaultStoreName,
        },
        cashier: {
          cashierId: auth.pos.cashierId,
          cashierName: auth.pos.cashierName,
        },
      },
    });
    await tryRecordPosAuditLog({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      input: {
        actionType: "checkout_completed",
        module: "cashier",
        actorUserId: auth.session.userId,
        actorName: auth.session.name || auth.session.userId,
        actorRole: auth.pos.role,
        storeId: storeScope.storeId || null,
        targetType: "sale",
        targetId: sale.id,
        targetFolio: sale.folio,
        summary: `完成收银 ${sale.folio}`,
        detailsJson: {
          total: sale.total,
          paymentMethod: sale.paymentMethod,
          sourceType: payload.input.sourceType || "direct",
          lineCount: payload.input.lines.length,
        },
        resultStatus: "success",
      },
    });
    return NextResponse.json({
      ok: true,
      saleId: sale.id,
      folio: sale.folio,
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      createdAt: sale.createdAt,
      status: sale.status,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CHECKOUT_FAILED";
    const [code, detail] = message.split("::");
    await tryRecordPosAuditLog({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      input: {
        actionType: "checkout_completed",
        module: "cashier",
        actorUserId: auth.session.userId,
        actorName: auth.session.name || auth.session.userId,
        actorRole: auth.pos.role,
        storeId: storeScope.storeId || null,
        summary: "收银失败",
        detailsJson: {
          total: payload.input.total,
          paymentMethod: payload.input.payment?.method || null,
          sourceType: payload.input.sourceType || "direct",
          lineCount: payload.input.lines.length,
          error: code,
          detail: detail || null,
        },
        resultStatus: "failed",
      },
    });
    const status = code === "CHECKOUT_SOURCE_NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ ok: false, error: code, detail: detail || null }, { status });
  }
}
