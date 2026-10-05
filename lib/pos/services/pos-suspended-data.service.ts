import { getSuspendedOrders, setSuspendedOrders } from "@/lib/pos/mock/pos-memory-store";
import { getPosDataMode } from "@/lib/pos/services/pos-data-mode";
import { createSuspendedOrder as createMockSuspendedOrder, removeSuspendedOrder as removeMockSuspendedOrder, resumeSuspendedOrder as resumeMockSuspendedOrder } from "@/lib/pos/services/pos-suspended.service";
import { type PosCart, type PosCashierContext, type PosSuspendedOrder, type PosSuspendedOrderInput } from "@/lib/pos/types";

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

export async function listPosSuspendedOrdersService(storeId?: string): Promise<PosSuspendedOrder[]> {
  if (getPosDataMode() === "mock") {
    return getSuspendedOrders();
  }
  try {
    const payload = await fetchJson<{ ok: true; items: PosSuspendedOrder[] }>(withStoreId("/api/pos/suspended", storeId));
    return payload.items || [];
  } catch {
    return getSuspendedOrders();
  }
}

export async function createPosSuspendedOrderService(
  input: PosSuspendedOrderInput,
  cashier: PosCashierContext,
): Promise<PosSuspendedOrder> {
  if (getPosDataMode() === "mock") {
    const current = getSuspendedOrders();
      const item = createMockSuspendedOrder(
      {
        lines: input.lines,
        customer: input.customer,
        orderDiscount: null,
        payment: {
          method: input.paymentMethod,
          received: input.paymentMethod === "cash" ? 0 : input.total,
          change: 0,
        },
        sourceType: "direct",
        sourceId: null,
        subtotal: input.subtotal,
        discountTotal: input.discountTotal,
        total: input.total,
      },
      cashier,
      "suspended",
    );
    setSuspendedOrders([item, ...current]);
    return item;
  }
  const payload = await fetchJson<{ ok: true; item: PosSuspendedOrder }>("/api/pos/suspended", {
    method: "POST",
    body: JSON.stringify({ input }),
  });
  return payload.item;
}

export async function resumePosSuspendedOrderService(id: string): Promise<{ item: PosSuspendedOrder; cart: PosCart } | null> {
  if (getPosDataMode() === "mock") {
    const current = getSuspendedOrders();
    const target = current.find((item) => item.id === id);
    if (!target) return null;
    const next = removeMockSuspendedOrder(current, id);
    setSuspendedOrders(next);
    return {
      item: target,
      cart: resumeMockSuspendedOrder(target),
    };
  }
  const payload = await fetchJson<{ ok: true; item: PosSuspendedOrder; cart: PosCart }>(`/api/pos/suspended/${encodeURIComponent(id)}/resume`, {
    method: "POST",
  });
  return payload;
}

export async function deletePosSuspendedOrderService(id: string): Promise<boolean> {
  if (getPosDataMode() === "mock") {
    const current = getSuspendedOrders();
    setSuspendedOrders(removeMockSuspendedOrder(current, id));
    return true;
  }
  await fetchJson<{ ok: true }>(`/api/pos/suspended/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return true;
}
