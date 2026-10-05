import { NextResponse } from "next/server";
import { getPosTopProductsReport } from "@/lib/pos/server/pos-reports.server";
import { requirePosSession, resolvePosStoreFromRequest } from "@/lib/pos/server/pos-route";

export async function GET(request: Request) {
  const auth = await requirePosSession([
    "pos.workbench.view",
    "pos.report.finance.view",
    "pos.report.inventory.view",
    "pos.replenishment.view",
  ]);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const storeScope = resolvePosStoreFromRequest(auth.pos, request.url, { requireStore: false });
  if (!storeScope.ok) return storeScope.response;
  const item = await getPosTopProductsReport({
    tenantId: auth.scope.tenantId,
    companyId: auth.scope.companyId,
    storeId: storeScope.storeId,
    dateFrom: url.searchParams.get("dateFrom") || undefined,
    dateTo: url.searchParams.get("dateTo") || undefined,
    limit: Number(url.searchParams.get("limit") || 8),
  });

  return NextResponse.json({ ok: true, item });
}
