import { NextResponse } from "next/server";
import { resolvePosStoreScope } from "@/lib/pos/access";
import { createPosSuspendedOrder, listPosSuspendedOrders } from "@/lib/pos/server/pos-suspended.server";
import { requirePosSession, resolvePosStoreFromRequest } from "@/lib/pos/server/pos-route";
import { type PosSuspendedOrderInput } from "@/lib/pos/types";

export async function GET(request: Request) {
  const auth = await requirePosSession("pos.suspended.view");
  if (!auth.ok) return auth.response;
  const storeScope = resolvePosStoreFromRequest(auth.pos, request.url, { requireStore: false });
  if (!storeScope.ok) return storeScope.response;

  const items = await listPosSuspendedOrders({
    tenantId: auth.scope.tenantId,
    companyId: auth.scope.companyId,
    storeId: storeScope.storeId,
  });
  return NextResponse.json({ ok: true, items });
}

export async function POST(request: Request) {
  const auth = await requirePosSession("pos.suspended.view");
  if (!auth.ok) return auth.response;

  const payload = (await request.json()) as { input?: PosSuspendedOrderInput };
  if (!payload?.input || !Array.isArray(payload.input.lines) || payload.input.lines.length === 0) {
    return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const storeScope = resolvePosStoreScope(auth.pos, payload.input.store?.storeId, {
    requireStore: true,
  });
  if (!storeScope.ok) {
    return NextResponse.json({ ok: false, error: storeScope.error }, { status: 403 });
  }

  const item = await createPosSuspendedOrder({
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
  return NextResponse.json({ ok: true, item });
}
