import { NextResponse } from "next/server";
import { listPosProducts } from "@/lib/pos/server/pos-products.server";
import { requirePosSession, resolvePosStoreFromRequest } from "@/lib/pos/server/pos-route";

export async function GET(request: Request) {
  const auth = await requirePosSession([
    "pos.cashier.view",
    "pos.quote.view",
    "pos.products_prices.view",
  ]);
  if (!auth.ok) return auth.response;
  const storeScope = resolvePosStoreFromRequest(auth.pos, request.url, { requireStore: false });
  if (!storeScope.ok) return storeScope.response;

  const items = await listPosProducts({
    tenantId: auth.scope.tenantId,
    companyId: auth.scope.companyId,
    storeId: storeScope.storeId,
    take: Number(new URL(request.url).searchParams.get("take") || 60),
    includeYogo: new URL(request.url).searchParams.get("includeYogo") === "1",
    category: new URL(request.url).searchParams.get("category")?.trim() || undefined,
  });
  return NextResponse.json({ ok: true, items });
}
