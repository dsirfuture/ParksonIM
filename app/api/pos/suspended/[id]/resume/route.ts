import { NextResponse } from "next/server";
import { resumePosSuspendedOrder } from "@/lib/pos/server/pos-suspended.server";
import { ensurePosStoreAccess, requirePosSession } from "@/lib/pos/server/pos-route";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePosSession("pos.suspended.view");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const result = await resumePosSuspendedOrder({
    tenantId: auth.scope.tenantId,
    companyId: auth.scope.companyId,
    id,
  });
  if (!result) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }
  const access = ensurePosStoreAccess(auth.pos, result.order.storeId);
  if (!access.ok) return access.response;
  return NextResponse.json({ ok: true, item: result.order, cart: result.cart });
}
