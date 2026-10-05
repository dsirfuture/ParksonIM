import { NextResponse } from "next/server";
import { listPosInventoryMovementRows } from "@/lib/pos/server/pos-inventory.server";
import { requirePosSession, resolvePosStoreFromRequest } from "@/lib/pos/server/pos-route";

export async function GET(request: Request) {
  const auth = await requirePosSession("pos.inventory.movements.view", {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;
  const storeScope = resolvePosStoreFromRequest(auth.pos, request.url, { requireStore: false });
  if (!storeScope.ok) return storeScope.response;

  const url = new URL(request.url);
  const result = await listPosInventoryMovementRows({
    tenantId: auth.scope.tenantId,
    companyId: auth.scope.companyId,
    query: {
      storeId: storeScope.storeId || "",
      productId: url.searchParams.get("productId") || "",
      keyword: url.searchParams.get("keyword") || "",
      moveType: url.searchParams.get("moveType") || "",
      dateFrom: url.searchParams.get("dateFrom") || "",
      dateTo: url.searchParams.get("dateTo") || "",
      page: Number(url.searchParams.get("page") || 1),
      limit: Number(url.searchParams.get("limit") || 20),
    },
  });

  return NextResponse.json({ ok: true, ...result });
}
