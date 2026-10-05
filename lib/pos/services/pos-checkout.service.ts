import { getQuotes, getSales, setQuotes, setSales } from "@/lib/pos/mock/pos-memory-store";
import { removeQuote as removeMockQuote } from "@/lib/pos/services/pos-quote.service";
import { generatePosFolio } from "@/lib/pos/services/pos-folio.service";
import { getPosDataMode } from "@/lib/pos/services/pos-data-mode";
import { type PosCheckoutInput, type PosCheckoutResult, type PosSaleRecord } from "@/lib/pos/types";

async function safeJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`HTTP_${response.status}::${text.slice(0, 160)}`);
  }
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const payload = await safeJson(response);
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.detail ? `${payload?.error}::${payload.detail}` : (payload?.error || `HTTP_${response.status}`));
  }
  return payload as T;
}

function withStoreId(path: string, storeId?: string) {
  if (!storeId) return path;
  const url = new URL(path, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  url.searchParams.set("storeId", storeId);
  if (typeof window !== "undefined") return `${url.pathname}${url.search}`;
  return url.toString();
}

export async function checkoutPosSaleService(input: PosCheckoutInput): Promise<PosCheckoutResult> {
  if (getPosDataMode() === "mock") {
    const now = new Date().toISOString();
    const saleId = `sale-${Date.now()}`;
    const sale: PosSaleRecord = {
      id: saleId,
      folio: generatePosFolio("sale"),
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      customer: input.customer,
      lines: input.lines,
      subtotal: input.subtotal,
      discountTotal: input.discountTotal,
      total: input.total,
      paymentMethod: input.payment.method,
      receivedAmount: input.payment.received,
      changeAmount: input.payment.change,
      note: input.note,
      cashierName: input.cashier.cashierName,
      status: "completed",
      createdAt: now,
    };
    setSales([sale, ...getSales()]);
    if (input.sourceType === "quote" && input.sourceId) {
      setQuotes(removeMockQuote(getQuotes(), input.sourceId));
    }
    return {
      saleId,
      folio: sale.folio,
      total: input.total,
      paymentMethod: input.payment.method,
      createdAt: now,
      status: "completed",
    };
  }

  const payload = await fetchJson<{ ok: true } & PosCheckoutResult>(withStoreId("/api/pos/checkout", input.store?.storeId), {
    method: "POST",
    body: JSON.stringify({ input }),
  });
  return {
    saleId: payload.saleId,
    folio: payload.folio,
    total: payload.total,
    paymentMethod: payload.paymentMethod,
    createdAt: payload.createdAt,
    status: payload.status,
  };
}
