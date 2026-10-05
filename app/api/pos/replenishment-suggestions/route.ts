import { NextResponse } from "next/server";
import { getPosReplenishmentSuggestions } from "@/lib/pos/server/pos-reports.server";
import { requirePosSession, resolvePosStoreFromRequest } from "@/lib/pos/server/pos-route";

export async function GET(request: Request) {
  const auth = await requirePosSession("pos.replenishment.view");
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const storeScope = resolvePosStoreFromRequest(auth.pos, request.url, { requireStore: false });
    if (!storeScope.ok) return storeScope.response;
    const result = await getPosReplenishmentSuggestions({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      storeId: storeScope.storeId,
      keyword: url.searchParams.get("keyword")?.trim() || undefined,
      lowStockOnly: url.searchParams.get("lowStockOnly") === "1",
      suggestedOnly: url.searchParams.get("suggestedOnly") === "1",
      dateFrom: url.searchParams.get("dateFrom")?.trim() || undefined,
      dateTo: url.searchParams.get("dateTo")?.trim() || undefined,
      limit: Number(url.searchParams.get("limit") || 100),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "POS_REPLENISHMENT_FAILED" },
      { status: 500 },
    );
  }
}
