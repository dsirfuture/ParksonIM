import { getQuotes, setQuotes } from "@/lib/pos/mock/pos-memory-store";
import { getPosDataMode } from "@/lib/pos/services/pos-data-mode";
import { createQuoteDraft as createMockQuoteDraft, removeQuote as removeMockQuote } from "@/lib/pos/services/pos-quote.service";
import { type PosCashierContext, type PosQuoteDraft, type PosQuoteDraftInput } from "@/lib/pos/types";

async function safeJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
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
    throw new Error(payload?.error || `HTTP_${response.status}`);
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

export async function listPosQuotesService(storeId?: string): Promise<PosQuoteDraft[]> {
  if (getPosDataMode() === "mock") {
    return getQuotes();
  }
  try {
    const payload = await fetchJson<{ ok: true; items: PosQuoteDraft[] }>(withStoreId("/api/pos/quotes", storeId));
    return payload.items || [];
  } catch {
    return getQuotes();
  }
}

export async function createPosQuoteService(
  input: PosQuoteDraftInput,
  _cashier: PosCashierContext,
): Promise<PosQuoteDraft> {
  if (getPosDataMode() === "mock") {
    const current = getQuotes();
      const item = createMockQuoteDraft(
      {
        lines: input.lines,
        customer: input.customer,
        orderDiscount: null,
        payment: {
          method: null,
          received: 0,
          change: 0,
        },
        sourceType: "direct",
        sourceId: null,
        subtotal: input.subtotal,
        discountTotal: input.discountTotal,
        total: input.total,
      },
      "draft",
    );
    setQuotes([item, ...current]);
    return item;
  }
  const payload = await fetchJson<{ ok: true; item: PosQuoteDraft }>("/api/pos/quotes", {
    method: "POST",
    body: JSON.stringify({ input }),
  });
  return payload.item;
}

export async function deletePosQuoteService(id: string): Promise<boolean> {
  if (getPosDataMode() === "mock") {
    const current = getQuotes();
    setQuotes(removeMockQuote(current, id));
    return true;
  }
  await fetchJson<{ ok: true }>(`/api/pos/quotes/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return true;
}
