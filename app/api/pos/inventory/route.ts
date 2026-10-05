import { NextResponse } from "next/server";
import { listPosInventory } from "@/lib/pos/server/pos-inventory.server";
import { requirePosSession, resolvePosStoreFromRequest } from "@/lib/pos/server/pos-route";

export async function GET(request: Request) {
  const auth = await requirePosSession("pos.inventory.view", {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;
  const storeScope = resolvePosStoreFromRequest(auth.pos, request.url, { requireStore: false });
  if (!storeScope.ok) return storeScope.response;

  const url = new URL(request.url);
  const lowStockOnly = url.searchParams.get("lowStockOnly");
  const result = await listPosInventory({
    tenantId: auth.scope.tenantId,
    companyId: auth.scope.companyId,
    query: {
      storeId: storeScope.storeId || "",
      keyword: url.searchParams.get("keyword") || "",
      clave: url.searchParams.get("clave") || "",
      barcode: url.searchParams.get("barcode") || "",
      status: url.searchParams.get("status") || "",
      lowStockOnly: lowStockOnly === "1" || lowStockOnly === "true",
      page: Number(url.searchParams.get("page") || 1),
      limit: Number(url.searchParams.get("limit") || 20),
    },
  });

  return NextResponse.json({ ok: true, ...result });
}
