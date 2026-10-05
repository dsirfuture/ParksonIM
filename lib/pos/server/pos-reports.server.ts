import { listKnownPosStoreIds } from "@/lib/pos/repositories/pos-inventory.repository";
import { getPosDashboardSummaryAggregate, getPosInventoryOverviewAggregate, getPosPaymentsSummaryAggregate, getPosReplenishmentSuggestionsAggregate, getPosSalesTrendAggregate, getPosTopProductsAggregate } from "@/lib/pos/repositories/pos-reports.repository";
import { type PosReplenishmentSuggestionQuery, type PosReportQuery } from "@/lib/pos/types";

type TenantScope = {
  tenantId: string;
  companyId: string;
};

export async function getPosDashboardSummary(params: TenantScope & PosReportQuery) {
  return getPosDashboardSummaryAggregate(params);
}

export async function getPosPaymentsSummary(params: TenantScope & PosReportQuery) {
  return getPosPaymentsSummaryAggregate(params);
}

export async function getPosTopProductsReport(params: TenantScope & PosReportQuery) {
  return getPosTopProductsAggregate(params);
}

export async function getPosInventoryOverview(params: TenantScope & PosReportQuery) {
  return getPosInventoryOverviewAggregate(params);
}

export async function getPosSalesTrend(params: TenantScope & PosReportQuery) {
  return getPosSalesTrendAggregate(params);
}

export async function getPosReplenishmentSuggestions(params: TenantScope & PosReplenishmentSuggestionQuery) {
  const [items, stores] = await Promise.all([
    getPosReplenishmentSuggestionsAggregate(params),
    listKnownPosStoreIds(params),
  ]);
  return {
    items,
    total: items.length,
    stores,
    targetDays: 7,
  };
}
