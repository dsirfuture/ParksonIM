import { NextResponse } from "next/server";
import { listPosPrimaryCategories } from "@/lib/pos/server/pos-products.server";
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

  const items = await listPosPrimaryCategories({
    tenantId: auth.scope.tenantId,
    companyId: auth.scope.companyId,
    storeId: storeScope.storeId,
    includeYogo: new URL(request.url).searchParams.get("includeYogo") === "1",
  });

  return NextResponse.json({ ok: true, items });
}
