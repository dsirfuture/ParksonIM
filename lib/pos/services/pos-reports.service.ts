import { getPosDataMode } from "@/lib/pos/services/pos-data-mode";
import { getPosProducts, getSales } from "@/lib/pos/mock/pos-memory-store";
import { type PosDashboardSummary, type PosInventoryOverview, type PosPaymentsSummary, type PosReportQuery, type PosReplenishmentSuggestionQuery, type PosSalesTrendPoint, type PosTopProductsReport } from "@/lib/pos/types";

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

function withParams(path: string, query?: PosReportQuery) {
  const url = new URL(path, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (query?.storeId) url.searchParams.set("storeId", query.storeId);
  if (query?.dateFrom) url.searchParams.set("dateFrom", query.dateFrom);
  if (query?.dateTo) url.searchParams.set("dateTo", query.dateTo);
  if (query?.limit) url.searchParams.set("limit", String(query.limit));
  if (typeof window !== "undefined") return `${url.pathname}${url.search}`;
  return url.toString();
}

function withReplenishmentParams(path: string, query?: PosReplenishmentSuggestionQuery) {
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

function bucketDate(input: string) {
  return input.slice(0, 10);
}

function fillTrendDateBuckets(items: PosSalesTrendPoint[], query?: PosReportQuery) {
  if (!query?.dateFrom || !query?.dateTo) return items;
  const start = new Date(`${query.dateFrom}T00:00:00`);
  const end = new Date(`${query.dateTo}T00:00:00`);
  const map = new Map(items.map((item) => [item.bucket, item]));
  const filled: PosSalesTrendPoint[] = [];
  const cursor = new Date(start);

  while (cursor.getTime() <= end.getTime()) {
    const bucket = cursor.toISOString().slice(0, 10);
    filled.push(map.get(bucket) || {
      bucket,
      salesTotal: 0,
      refundTotal: 0,
      netSalesTotal: 0,
      orderCount: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return filled;
}

function isWithinRange(input: string, start: Date, end: Date) {
  const value = new Date(input).getTime();
  return value >= start.getTime() && value <= end.getTime();
}

function defaultMockSummary(): PosDashboardSummary {
  const sales = getSales();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);
  const weekStart = new Date(now);
  const weekDay = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - (weekDay === 0 ? 6 : weekDay - 1));
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const salesTotal = sales.reduce((sum, item) => sum + item.total, 0);
  const refundTotal = sales.filter((item) => item.status === "refunded").reduce((sum, item) => sum + item.total, 0);
  const orderCount = sales.length;
  const todaySales = sales.filter((item) => isWithinRange(item.createdAt, todayStart, todayEnd));
  const weekSales = sales.filter((item) => isWithinRange(item.createdAt, weekStart, todayEnd));
  const monthSales = sales.filter((item) => isWithinRange(item.createdAt, monthStart, todayEnd));
  return {
    salesTotal,
    refundTotal,
    netSalesTotal: salesTotal - refundTotal,
    orderCount,
    todayOrderCount: todaySales.length,
    weekOrderCount: weekSales.length,
    monthOrderCount: monthSales.length,
    refundedOrderCount: sales.filter((item) => item.status === "refunded").length,
    avgTicket: orderCount > 0 ? Number((salesTotal / orderCount).toFixed(2)) : 0,
    todaySalesTotal: todaySales.reduce((sum, item) => sum + item.total, 0),
    weekSalesTotal: weekSales.reduce((sum, item) => sum + item.total, 0),
    monthSalesTotal: monthSales.reduce((sum, item) => sum + item.total, 0),
  };
}

export async function getPosDashboardSummaryService(query?: PosReportQuery): Promise<PosDashboardSummary> {
  if (getPosDataMode() === "mock") return defaultMockSummary();
  const payload = await fetchJson<{ ok: true; item: PosDashboardSummary }>(withParams("/api/pos/dashboard/summary", query));
  return payload.item;
}

export async function getPosPaymentsSummaryService(query?: PosReportQuery): Promise<PosPaymentsSummary> {
  if (getPosDataMode() === "mock") {
    const sales = getSales();
    return {
      cashTotal: sales.filter((item) => item.paymentMethod === "cash").reduce((sum, item) => sum + item.total, 0),
      transferTotal: sales.filter((item) => item.paymentMethod === "transfer").reduce((sum, item) => sum + item.total, 0),
      cardTotal: sales.filter((item) => item.paymentMethod === "card").reduce((sum, item) => sum + item.total, 0),
      refundTotal: sales.filter((item) => item.status === "refunded").reduce((sum, item) => sum + item.total, 0),
    };
  }
  const payload = await fetchJson<{ ok: true; item: PosPaymentsSummary }>(withParams("/api/pos/reports/payments", query));
  return payload.item;
}

export async function getPosTopProductsReportService(query?: PosReportQuery): Promise<PosTopProductsReport> {
  if (getPosDataMode() === "mock") {
    const map = new Map<string, { productId: string; clave: string; productName: string; qtyTotal: number; salesTotal: number }>();
    for (const sale of getSales()) {
      for (const line of sale.lines) {
        const current = map.get(line.productId) || {
          productId: line.productId,
          clave: line.clave,
          productName: line.nameCn,
          qtyTotal: 0,
          salesTotal: 0,
        };
        current.qtyTotal += line.qty;
        current.salesTotal += line.subtotal;
        map.set(line.productId, current);
      }
    }
    const items = Array.from(map.values());
    return {
      topByQty: [...items].sort((a, b) => b.qtyTotal - a.qtyTotal).slice(0, query?.limit || 8),
      topBySales: [...items].sort((a, b) => b.salesTotal - a.salesTotal).slice(0, query?.limit || 8),
    };
  }
  const payload = await fetchJson<{ ok: true; item: PosTopProductsReport }>(withParams("/api/pos/reports/top-products", query));
  return payload.item;
}

export async function getPosInventoryOverviewService(query?: PosReportQuery): Promise<PosInventoryOverview> {
  if (getPosDataMode() === "mock") {
    const products = getPosProducts();
    const lowStockItems = products
      .filter((item) => item.stock <= 20)
      .slice(0, 12)
      .map((item) => ({
        storeId: query?.storeId || "store-demo-001",
        productId: item.id,
        clave: item.clave,
        productName: item.nameCn,
        onHandQty: item.stock,
        availableQty: item.stock,
        minStock: 20,
      }));
    return {
      totalActiveInventoryItems: products.filter((item) => item.active).length,
      lowStockCount: lowStockItems.length,
      outOfStockCount: products.filter((item) => item.stock <= 0).length,
      lowStockItems,
    };
  }
  const payload = await fetchJson<{ ok: true; item: PosInventoryOverview }>(withParams("/api/pos/reports/inventory-overview", query));
  return payload.item;
}

export async function getPosSalesTrendService(query?: PosReportQuery): Promise<PosSalesTrendPoint[]> {
  if (getPosDataMode() === "mock") {
    const map = new Map<string, PosSalesTrendPoint>();
    for (const sale of getSales()) {
      const bucket = bucketDate(sale.createdAt);
      const current = map.get(bucket) || { bucket, salesTotal: 0, refundTotal: 0, netSalesTotal: 0, orderCount: 0 };
      current.salesTotal += sale.total;
      current.orderCount += 1;
      if (sale.status === "refunded") current.refundTotal += sale.total;
      current.netSalesTotal = current.salesTotal - current.refundTotal;
      map.set(bucket, current);
    }
    const items = Array.from(map.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));
    return fillTrendDateBuckets(items, query);
  }
  const payload = await fetchJson<{ ok: true; items: PosSalesTrendPoint[] }>(withParams("/api/pos/reports/sales-trend", query));
  return fillTrendDateBuckets(payload.items || [], query);
}

export async function getPosReplenishmentSuggestionsForReportService(query?: PosReplenishmentSuggestionQuery) {
  const payload = await fetchJson(withReplenishmentParams("/api/pos/replenishment-suggestions", query));
  return payload;
}
