import { NextResponse } from "next/server";
import { searchPosProducts } from "@/lib/pos/server/pos-products.server";
import { requirePosSession, resolvePosStoreFromRequest } from "@/lib/pos/server/pos-route";

export async function GET(request: Request) {
  const auth = await requirePosSession([
    "pos.cashier.view",
    "pos.quote.view",
    "pos.products_prices.view",
  ]);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const storeScope = resolvePosStoreFromRequest(auth.pos, request.url, { requireStore: false });
  if (!storeScope.ok) return storeScope.response;
  const q = url.searchParams.get("q")?.trim() || "";
  if (!q) {
    return NextResponse.json({ ok: true, items: [] });
  }

  const items = await searchPosProducts({
    tenantId: auth.scope.tenantId,
    companyId: auth.scope.companyId,
    storeId: storeScope.storeId,
    q,
    take: Number(url.searchParams.get("take") || 30),
    includeYogo: url.searchParams.get("includeYogo") === "1",
  });
  return NextResponse.json({ ok: true, items });
}
