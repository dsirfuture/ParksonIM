import { NextResponse } from "next/server";
import { getPosProductByClave } from "@/lib/pos/server/pos-products.server";
import { requirePosSession, resolvePosStoreFromRequest } from "@/lib/pos/server/pos-route";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clave: string }> },
) {
  const auth = await requirePosSession([
    "pos.cashier.view",
    "pos.quote.view",
    "pos.products_prices.view",
  ]);
  if (!auth.ok) return auth.response;
  const storeScope = resolvePosStoreFromRequest(auth.pos, request.url, { requireStore: false });
  if (!storeScope.ok) return storeScope.response;

  const { clave } = await params;
  const url = new URL(request.url);
  const item = await getPosProductByClave({
    tenantId: auth.scope.tenantId,
    companyId: auth.scope.companyId,
    storeId: storeScope.storeId,
    clave: decodeURIComponent(clave || ""),
    includeYogo: url.searchParams.get("includeYogo") === "1",
  });
  if (!item) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item });
}
