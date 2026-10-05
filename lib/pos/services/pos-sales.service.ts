import { getPosDataMode } from "@/lib/pos/services/pos-data-mode";
import { getSales, setSales } from "@/lib/pos/mock/pos-memory-store";
import { type PosRefundRecord, type PosSaleListItem, type PosSaleQuery } from "@/lib/pos/types";

async function safeJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
  });
  const payload = await safeJson(response);
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `HTTP_${response.status}`);
  }
  return payload as T;
}

function withParams(path: string, params?: Record<string, string | undefined>) {
  if (!params) return path;
  const url = new URL(path, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  if (typeof window !== "undefined") return `${url.pathname}${url.search}`;
  return url.toString();
}

export async function listPosSalesService(query?: PosSaleQuery): Promise<PosSaleListItem[]> {
  if (getPosDataMode() === "mock") {
    const items = getSales().map((sale) => ({
      id: sale.id,
      folio: sale.folio,
      sourceType: sale.sourceType,
      sourceId: sale.sourceId,
      customerName: sale.customer.name,
      customerPhone: sale.customer.phone,
      customerRfc: sale.customer.rfc,
      note: sale.note,
      subtotal: sale.subtotal,
      discountTotal: sale.discountTotal,
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      receivedAmount: sale.receivedAmount,
      changeAmount: sale.changeAmount,
      cashierName: sale.cashierName,
      status: sale.status,
      createdAt: sale.createdAt,
      lines: sale.lines,
    }));
    return items.filter((item) => {
      if (query?.folio && !item.folio.toLowerCase().includes(query.folio.toLowerCase())) return false;
      if (query?.customer && !item.customerName.toLowerCase().includes(query.customer.toLowerCase())) return false;
      if (query?.paymentMethod && item.paymentMethod !== query.paymentMethod) return false;
      if (query?.status && item.status !== query.status) return false;
      return true;
    });
  }
  const payload = await fetchJson<{ ok: true; items: PosSaleListItem[] }>(withParams("/api/pos/sales", {
    storeId: query?.storeId,
    folio: query?.folio,
    customer: query?.customer,
    paymentMethod: query?.paymentMethod,
    status: query?.status,
    dateFrom: query?.dateFrom,
    dateTo: query?.dateTo,
    take: query?.take ? String(query.take) : undefined,
  }));
  return payload.items || [];
}

export async function getPosSaleDetailService(id: string): Promise<PosSaleListItem> {
  if (getPosDataMode() === "mock") {
    const sale = getSales().find((item) => item.id === id);
    if (!sale) throw new Error("POS_SALE_NOT_FOUND");
    return {
      id: sale.id,
      folio: sale.folio,
      sourceType: sale.sourceType,
      sourceId: sale.sourceId,
      customerName: sale.customer.name,
      customerPhone: sale.customer.phone,
      customerRfc: sale.customer.rfc,
      note: sale.note,
      subtotal: sale.subtotal,
      discountTotal: sale.discountTotal,
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      receivedAmount: sale.receivedAmount,
      changeAmount: sale.changeAmount,
      cashierName: sale.cashierName,
      status: sale.status,
      createdAt: sale.createdAt,
      lines: sale.lines,
    };
  }
  const payload = await fetchJson<{ ok: true; item: PosSaleListItem }>(`/api/pos/sales/${encodeURIComponent(id)}`);
  return payload.item;
}

export async function refundPosSaleService(id: string, reason: string): Promise<PosRefundRecord> {
  if (getPosDataMode() === "mock") {
    const current = getSales();
    const sale = current.find((item) => item.id === id);
    if (!sale) throw new Error("POS_SALE_NOT_FOUND");
    if (sale.status === "refunded") throw new Error("POS_SALE_ALREADY_REFUNDED");
    setSales(current.map((item) => (item.id === id ? { ...item, status: "refunded" } : item)));
    return {
      id: `refund-${Date.now()}`,
      saleRecordId: sale.id,
      folio: `DEV-${Date.now()}`,
      reason,
      subtotal: sale.subtotal,
      discountTotal: sale.discountTotal,
      total: sale.total,
      createdAt: new Date().toISOString(),
    };
  }
  const payload = await fetchJson<{ ok: true; item: PosRefundRecord }>(`/api/pos/sales/${encodeURIComponent(id)}/refund`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason }),
  });
  return payload.item;
}
