import { type Lang } from "@/lib/i18n";
import { type PosInventoryMovementQuery, type PosInventoryQuery, type PosReportQuery, type PosReplenishmentSuggestionQuery, type PosSaleQuery } from "@/lib/pos/types";

function withParams(path: string, params?: Record<string, string | undefined>) {
  const url = new URL(path, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, value);
  }
  if (typeof window !== "undefined") return `${url.pathname}${url.search}`;
  return url.toString();
}

async function readError(response: Response) {
  const text = await response.text();
  if (!text) return `HTTP_${response.status}`;
  try {
    const payload = JSON.parse(text);
    return payload?.error || `HTTP_${response.status}`;
  } catch {
    return text;
  }
}

async function downloadExport(path: string, params: Record<string, string | undefined>, fallbackName: string) {
  const response = await fetch(withParams(path, params), {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?(.*?)"?$/i);
  const fileName = match?.[1] ? decodeURIComponent(match[1]) : fallbackName;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function exportPosSalesService(query: PosSaleQuery, lang: Lang) {
  await downloadExport("/api/pos/sales/export", {
    lang,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    folio: query.folio,
    customer: query.customer,
    paymentMethod: query.paymentMethod,
    status: query.status,
    storeId: query.storeId,
  }, "pos-sales.xlsx");
}

export async function exportPosInventoryService(query: PosInventoryQuery, lang: Lang) {
  await downloadExport("/api/pos/inventory/export", {
    lang,
    storeId: query.storeId,
    keyword: query.keyword,
    clave: query.clave,
    barcode: query.barcode,
    status: query.status,
    lowStockOnly: query.lowStockOnly ? "1" : undefined,
  }, "pos-inventory.xlsx");
}

export async function exportPosInventoryMovementsService(query: PosInventoryMovementQuery, lang: Lang) {
  await downloadExport("/api/pos/inventory-movements/export", {
    lang,
    storeId: query.storeId,
    productId: query.productId,
    keyword: query.keyword,
    moveType: query.moveType,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  }, "pos-inventory-movements.xlsx");
}

export async function exportPosFinanceReportService(query: PosReportQuery, lang: Lang) {
  await downloadExport("/api/pos/reports/finance/export", {
    lang,
    storeId: query.storeId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  }, "pos-finance.xlsx");
}

export async function exportPosInventoryReportService(query: PosReportQuery, lang: Lang) {
  await downloadExport("/api/pos/reports/inventory/export", {
    lang,
    storeId: query.storeId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    limit: query.limit ? String(query.limit) : undefined,
  }, "pos-inventory-stats.xlsx");
}

export async function exportPosReplenishmentService(query: PosReplenishmentSuggestionQuery, lang: Lang) {
  await downloadExport("/api/pos/replenishment-suggestions/export", {
    lang,
    storeId: query.storeId,
    keyword: query.keyword,
    lowStockOnly: query.lowStockOnly ? "1" : undefined,
    suggestedOnly: query.suggestedOnly ? "1" : undefined,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    limit: query.limit ? String(query.limit) : undefined,
  }, "pos-replenishment.xlsx");
}
