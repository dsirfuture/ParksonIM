import { NextRequest, NextResponse } from "next/server";
import { ensurePosStoreAccess, requirePosSession } from "@/lib/pos/server/pos-route";
import { getPosCashierDetail, updatePosCashierStatusRecord } from "@/lib/pos/server/pos-cashiers.server";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePosSession("pos.cashier.manage", {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;
  const params = await context.params;
  try {
    const existing = await getPosCashierDetail({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      id: params.id,
    });
    const scopeCheck = ensurePosStoreAccess(auth.pos, existing.storeId);
    if (!scopeCheck.ok) return scopeCheck.response;

    const payload = await request.json().catch(() => ({}));
    const item = await updatePosCashierStatusRecord({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      id: params.id,
      active: payload?.active !== false,
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "POS_CASHIER_SAVE_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
