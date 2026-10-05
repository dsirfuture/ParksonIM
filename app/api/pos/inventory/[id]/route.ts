import { NextResponse } from "next/server";
import { getPosInventoryDetail } from "@/lib/pos/server/pos-inventory.server";
import { ensurePosStoreAccess, requirePosSession } from "@/lib/pos/server/pos-route";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePosSession("pos.inventory.view", {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;

  const params = await context.params;
  try {
    const item = await getPosInventoryDetail({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      id: params.id,
    });
    const access = ensurePosStoreAccess(auth.pos, item.storeId);
    if (!access.ok) return access.response;
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "POS_INVENTORY_NOT_FOUND";
    const status = message === "POS_INVENTORY_NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
