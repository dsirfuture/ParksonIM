import { NextResponse } from "next/server";
import { deletePosSuspendedOrder, getPosSuspendedOrder } from "@/lib/pos/server/pos-suspended.server";
import { ensurePosStoreAccess, requirePosSession } from "@/lib/pos/server/pos-route";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePosSession("pos.suspended.view");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const item = await getPosSuspendedOrder({
    tenantId: auth.scope.tenantId,
    companyId: auth.scope.companyId,
    id,
  });
  if (!item) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }
  const access = ensurePosStoreAccess(auth.pos, item.storeId);
  if (!access.ok) return access.response;
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePosSession("pos.suspended.view");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const item = await getPosSuspendedOrder({
    tenantId: auth.scope.tenantId,
    companyId: auth.scope.companyId,
    id,
  });
  if (!item) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }
  const access = ensurePosStoreAccess(auth.pos, item.storeId);
  if (!access.ok) return access.response;
  const deleted = await deletePosSuspendedOrder({
    tenantId: auth.scope.tenantId,
    companyId: auth.scope.companyId,
    id,
  });
  if (!deleted) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
