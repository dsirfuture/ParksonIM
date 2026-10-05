import { NextResponse } from "next/server";
import { tryRecordPosAuditLog } from "@/lib/pos/server/pos-audit.server";
import { damageInventory, getPosInventoryDetail } from "@/lib/pos/server/pos-inventory.server";
import { ensurePosStoreAccess, requirePosSession } from "@/lib/pos/server/pos-route";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePosSession("pos.inventory.damage", {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;

  const params = await context.params;
  let currentStoreId = auth.pos.defaultStoreId;
  let currentClave = "";
  let currentOnHand = 0;
  try {
    const current = await getPosInventoryDetail({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      id: params.id,
    });
    currentStoreId = current.storeId;
    currentClave = current.clave;
    currentOnHand = current.onHandQty;
    const scopeCheck = ensurePosStoreAccess(auth.pos, current.storeId);
    if (!scopeCheck.ok) {
      await tryRecordPosAuditLog({
        tenantId: auth.scope.tenantId,
        companyId: auth.scope.companyId,
        input: {
          actionType: "access_denied",
          module: "store_inventory",
          actorUserId: auth.session.userId,
          actorName: auth.session.name || auth.session.userId,
          actorRole: auth.pos.role,
          storeId: auth.pos.defaultStoreId,
          targetType: "inventory",
          targetId: params.id,
          summary: `库存报损门店范围越权 ${current.clave}`,
          detailsJson: {
            attemptedAction: "inventory_damaged",
            targetStoreId: current.storeId,
            reason: "POS_STORE_SCOPE_DENIED",
          },
          resultStatus: "denied",
        },
      });
      return scopeCheck.response;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "POS_INVENTORY_NOT_FOUND";
    return NextResponse.json({ ok: false, error: message }, { status: message === "POS_INVENTORY_NOT_FOUND" ? 404 : 400 });
  }
  const payload = (await request.json().catch(() => ({}))) as {
    qty?: number;
    reason?: string;
    note?: string;
    operator?: string;
  };

  try {
    const item = await damageInventory({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      id: params.id,
      operator: auth.session.name || auth.session.userId,
      input: {
        qty: Number(payload.qty || 0),
        reason: payload.reason || "",
        note: payload.note || "",
        operator: payload.operator || "",
      },
    });
    await tryRecordPosAuditLog({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      input: {
        actionType: "inventory_damaged",
        module: "store_inventory",
        actorUserId: auth.session.userId,
        actorName: auth.session.name || auth.session.userId,
        actorRole: auth.pos.role,
        storeId: item.storeId,
        targetType: "inventory",
        targetId: item.id,
        summary: `库存报损 ${item.clave}`,
        detailsJson: {
          productId: item.productId,
          clave: item.clave,
          qtyBefore: currentOnHand,
          qtyAfter: item.availableQty,
          qtyChange: item.availableQty - currentOnHand,
          reason: payload.reason || "",
        },
        resultStatus: "success",
      },
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "POS_INVENTORY_DAMAGE_FAILED";
    await tryRecordPosAuditLog({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      input: {
        actionType: "inventory_damaged",
        module: "store_inventory",
        actorUserId: auth.session.userId,
        actorName: auth.session.name || auth.session.userId,
        actorRole: auth.pos.role,
        storeId: currentStoreId,
        targetType: "inventory",
        targetId: params.id,
        summary: `库存报损失败 ${currentClave || params.id}`,
        detailsJson: {
          clave: currentClave || null,
          error: message,
        },
        resultStatus: "failed",
      },
    });
    const status = message === "POS_INVENTORY_NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
