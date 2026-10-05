import { getPosDataMode } from "@/lib/pos/services/pos-data-mode";
import { type PosReplenishmentSuggestionQuery, type PosReplenishmentSuggestionResult } from "@/lib/pos/types";

async function safeJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

async function fetchJson<T>(input: RequestInfo | URL): Promise<T> {
  const response = await fetch(input, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await safeJson(response);
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `HTTP_${response.status}`);
  }
  return payload as T;
}

function withParams(path: string, query?: PosReplenishmentSuggestionQuery) {
  const url = new URL(path, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (query?.storeId) url.searchParams.set("storeId", query.storeId);
  if (query?.keyword) url.searchParams.set("keyword", query.keyword);
  if (query?.lowStockOnly) url.searchParams.set("lowStockOnly", "1");
  if (query?.suggestedOnly) url.searchParams.set("suggestedOnly", "1");
  if (query?.dateFrom) url.searchParams.set("dateFrom", query.dateFrom);
  if (query?.dateTo) url.searchParams.set("dateTo", query.dateTo);
  if (query?.limit) url.searchParams.set("limit", String(query.limit));
  if (typeof window !== "undefined") return `${url.pathname}${url.search}`;
  return url.toString();
}

export async function listPosReplenishmentSuggestionsService(
  query?: PosReplenishmentSuggestionQuery,
): Promise<PosReplenishmentSuggestionResult> {
  if (getPosDataMode() === "mock") {
    return {
      items: [],
      total: 0,
      stores: query?.storeId ? [query.storeId] : ["store-demo-001", "default"],
      targetDays: 7,
    };
  }
  const payload = await fetchJson<{ ok: true } & PosReplenishmentSuggestionResult>(
    withParams("/api/pos/replenishment-suggestions", query),
  );
  return {
    items: payload.items || [],
    total: payload.total || 0,
    stores: payload.stores || [],
    targetDays: payload.targetDays || 7,
  };
}
