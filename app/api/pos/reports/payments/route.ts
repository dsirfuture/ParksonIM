import { NextResponse } from "next/server";
import { getPosPaymentsSummary } from "@/lib/pos/server/pos-reports.server";
import { requirePosSession, resolvePosStoreFromRequest } from "@/lib/pos/server/pos-route";

export async function GET(request: Request) {
  const auth = await requirePosSession([
    "pos.workbench.view",
    "pos.report.finance.view",
  ]);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const storeScope = resolvePosStoreFromRequest(auth.pos, request.url, { requireStore: false });
  if (!storeScope.ok) return storeScope.response;
  const item = await getPosPaymentsSummary({
    tenantId: auth.scope.tenantId,
    companyId: auth.scope.companyId,
    storeId: storeScope.storeId,
    dateFrom: url.searchParams.get("dateFrom") || undefined,
    dateTo: url.searchParams.get("dateTo") || undefined,
  });

  return NextResponse.json({ ok: true, item });
}
