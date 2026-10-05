import { cloneCart, createEmptyCart } from "@/lib/pos/services/pos-cart.service";
import { generatePosFolio } from "@/lib/pos/services/pos-folio.service";
import { type PosCart, type PosQuoteDraft } from "@/lib/pos/types";

export function createQuoteDraft(cart: PosCart, statusLabel: string): PosQuoteDraft {
  const source = cloneCart(cart);
  return {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    folio: generatePosFolio("quote"),
    customer: { ...source.customer },
    lines: source.lines.map((line) => ({ ...line, lineDiscount: line.lineDiscount ? { ...line.lineDiscount } : null })),
    subtotal: source.subtotal,
    discountTotal: source.discountTotal,
    total: source.total,
    note: source.customer.notes,
    createdAt: new Date().toISOString(),
    status: statusLabel,
  };
}

export function listQuotes(quotes: PosQuoteDraft[]) {
  return quotes.map((quote) => ({
    ...quote,
    customer: { ...quote.customer },
    lines: quote.lines.map((line) => ({ ...line, lineDiscount: line.lineDiscount ? { ...line.lineDiscount } : null })),
  }));
}

export function removeQuote(quotes: PosQuoteDraft[], quoteId: string) {
  return quotes.filter((quote) => quote.id !== quoteId);
}

export function quoteToCart(quote: PosQuoteDraft): PosCart {
  return {
    ...createEmptyCart(),
    lines: quote.lines.map((line) => ({ ...line, lineDiscount: line.lineDiscount ? { ...line.lineDiscount } : null })),
    customer: { ...quote.customer, notes: quote.note || quote.customer.notes },
    sourceType: "quote",
    sourceId: quote.id,
    subtotal: quote.subtotal,
    discountTotal: quote.discountTotal,
    total: quote.total,
    payment: {
      method: "cash",
      received: 0,
      change: 0,
    },
  };
}
