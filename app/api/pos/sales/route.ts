import { NextResponse } from "next/server";
import { listPosSales } from "@/lib/pos/server/pos-sales.server";
import { requirePosSession, resolvePosStoreFromRequest } from "@/lib/pos/server/pos-route";

export async function GET(request: Request) {
  const auth = await requirePosSession("pos.sale.view");
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const storeScope = resolvePosStoreFromRequest(auth.pos, request.url, { requireStore: false });
  if (!storeScope.ok) return storeScope.response;
  const items = await listPosSales({
    tenantId: auth.scope.tenantId,
    companyId: auth.scope.companyId,
    storeId: storeScope.storeId,
    take: Number(url.searchParams.get("take") || 50),
    query: {
      folio: url.searchParams.get("folio") || "",
      customer: url.searchParams.get("customer") || "",
      paymentMethod: url.searchParams.get("paymentMethod") || "",
      status: url.searchParams.get("status") || "",
      dateFrom: url.searchParams.get("dateFrom") || "",
      dateTo: url.searchParams.get("dateTo") || "",
    },
  });
  return NextResponse.json({ ok: true, items });
}
