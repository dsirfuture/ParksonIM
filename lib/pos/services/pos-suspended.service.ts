import { generatePosFolio } from "@/lib/pos/services/pos-folio.service";
import { cloneCart, createEmptyCart } from "@/lib/pos/services/pos-cart.service";
import { type PosCart, type PosCashierContext, type PosSuspendedOrder } from "@/lib/pos/types";

export function createSuspendedOrder(
  cart: PosCart,
  cashier: PosCashierContext,
  statusLabel: string,
): PosSuspendedOrder {
  const source = cloneCart(cart);
  return {
    id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    folio: generatePosFolio("suspended"),
    customer: { ...source.customer },
    lines: source.lines.map((line) => ({ ...line, lineDiscount: line.lineDiscount ? { ...line.lineDiscount } : null })),
    subtotal: source.subtotal,
    discountTotal: source.discountTotal,
    total: source.total,
    note: source.customer.notes,
    createdAt: new Date().toISOString(),
    cashierName: cashier.cashierName,
    status: statusLabel,
    paymentMethod: source.payment.method,
  };
}

export function listSuspendedOrders(orders: PosSuspendedOrder[]) {
  return orders.map((order) => ({
    ...order,
    customer: { ...order.customer },
    lines: order.lines.map((line) => ({ ...line, lineDiscount: line.lineDiscount ? { ...line.lineDiscount } : null })),
  }));
}

export function removeSuspendedOrder(orders: PosSuspendedOrder[], orderId: string) {
  return orders.filter((order) => order.id !== orderId);
}

export function resumeSuspendedOrder(order: PosSuspendedOrder): PosCart {
  return {
    ...createEmptyCart(),
    lines: order.lines.map((line) => ({ ...line, lineDiscount: line.lineDiscount ? { ...line.lineDiscount } : null })),
    customer: { ...order.customer, notes: order.note || order.customer.notes },
    sourceType: "suspended",
    sourceId: order.id,
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    total: order.total,
    payment: {
      method: order.paymentMethod,
      received: order.paymentMethod === "cash" ? 0 : order.total,
      change: 0,
    },
  };
}
