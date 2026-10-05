import { createEmptyPayment, setPaymentMethod as setPaymentMethodValue, setReceivedAmount as setReceivedAmountValue } from "@/lib/pos/services/pos-payment.service";
import {
  type PosCart,
  type PosCartLine,
  type PosCustomer,
  type PosDiscount,
  type PosDiscountType,
  type PosPaymentMethod,
  type PosProduct,
} from "@/lib/pos/types";

function toSafeMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Number(value.toFixed(2)));
}

function createEmptyCustomer(): PosCustomer {
  return {
    name: "",
    phone: "",
    rfc: "",
    notes: "",
  };
}

function computeDiscount(base: number, discount: PosDiscount | null) {
  if (!discount || discount.value <= 0) return 0;
  if (discount.type === "percent") return Math.min(base, toSafeMoney((base * discount.value) / 100));
  return Math.min(base, toSafeMoney(discount.value));
}

function recalculateLine(line: PosCartLine): PosCartLine {
  const base = line.qty * line.unitPrice;
  const subtotal = toSafeMoney(base - computeDiscount(base, line.lineDiscount));
  return {
    ...line,
    subtotal,
  };
}

export function createEmptyCart(): PosCart {
  return {
    lines: [],
    customer: createEmptyCustomer(),
    orderDiscount: null,
    payment: createEmptyPayment(),
    sourceType: "direct",
    sourceId: null,
    subtotal: 0,
    discountTotal: 0,
    total: 0,
  };
}

export function cloneCart(cart: PosCart): PosCart {
  return {
    ...cart,
    customer: { ...cart.customer },
    orderDiscount: cart.orderDiscount ? { ...cart.orderDiscount } : null,
    payment: { ...cart.payment },
    lines: cart.lines.map((line) => ({
      ...line,
      lineDiscount: line.lineDiscount ? { ...line.lineDiscount } : null,
    })),
  };
}

export function recalculateCart(cart: PosCart): PosCart {
  const lines = cart.lines.map(recalculateLine);
  const baseSubtotal = toSafeMoney(lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0));
  const lineDiscountTotal = toSafeMoney(lines.reduce((sum, line) => sum + (line.qty * line.unitPrice - line.subtotal), 0));
  const orderBase = toSafeMoney(baseSubtotal - lineDiscountTotal);
  const orderDiscount = computeDiscount(orderBase, cart.orderDiscount);
  const subtotal = baseSubtotal;
  const discountTotal = toSafeMoney(lineDiscountTotal + orderDiscount);
  const total = toSafeMoney(subtotal - discountTotal);
  const payment = cart.payment.method
    ? cart.payment.method === "cash"
      ? setReceivedAmountValue(total, cart.payment, cart.payment.received)
      : setPaymentMethodValue(total, cart.payment, cart.payment.method)
    : { ...cart.payment, received: 0, change: 0 };
  return {
    ...cart,
    lines,
    subtotal,
    discountTotal,
    total,
    payment,
  };
}

function createLine(product: PosProduct): PosCartLine {
  return {
    lineId: `line-${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    productId: product.id,
    sourceKind: product.sourceKind || "inventory",
    inventoryManaged: product.inventoryManaged ?? true,
    barcode: product.barcode,
    clave: product.clave,
    nameCn: product.nameCn,
    nameEs: product.nameEs,
    spec: product.spec,
    qty: 1,
    unitPrice: product.price,
    lineDiscount: null,
    subtotal: product.price,
  };
}

export function addProductToCart(cart: PosCart, product: PosProduct): PosCart {
  const index = cart.lines.findIndex((line) => line.productId === product.id);
  const next = cloneCart(cart);
  if (index >= 0) {
    next.lines[index] = {
      ...next.lines[index],
      qty: next.lines[index].qty + 1,
    };
  } else {
    next.lines.push(createLine(product));
  }
  return recalculateCart(next);
}

export function updateCartLineQty(cart: PosCart, lineId: string, qty: number): PosCart {
  const next = cloneCart(cart);
  next.lines = next.lines.map((line) =>
    line.lineId === lineId
      ? { ...line, qty: Math.max(1, Math.floor(Number.isFinite(qty) ? qty : 1)) }
      : line,
  );
  return recalculateCart(next);
}

export function removeCartLine(cart: PosCart, lineId: string): PosCart {
  const next = cloneCart(cart);
  next.lines = next.lines.filter((line) => line.lineId !== lineId);
  return recalculateCart(next);
}

export function clearCart(): PosCart {
  return createEmptyCart();
}

export function setLineDiscount(
  cart: PosCart,
  lineId: string,
  discountType: PosDiscountType,
  discountValue: number,
): PosCart {
  const next = cloneCart(cart);
  next.lines = next.lines.map((line) =>
    line.lineId === lineId
      ? {
          ...line,
          lineDiscount: discountValue > 0 ? { type: discountType, value: toSafeMoney(discountValue), scope: "line" } : null,
        }
      : line,
  );
  return recalculateCart(next);
}

export function setOrderDiscount(cart: PosCart, discountType: PosDiscountType, discountValue: number): PosCart {
  const next = cloneCart(cart);
  next.orderDiscount = discountValue > 0 ? { type: discountType, value: toSafeMoney(discountValue), scope: "order" } : null;
  return recalculateCart(next);
}

export function setCustomerField(cart: PosCart, field: keyof PosCustomer, value: string): PosCart {
  const next = cloneCart(cart);
  next.customer = {
    ...next.customer,
    [field]: value,
  };
  return next;
}

export function setPaymentMethod(cart: PosCart, method: PosPaymentMethod): PosCart {
  const next = cloneCart(cart);
  next.payment = setPaymentMethodValue(next.total, next.payment, method);
  return recalculateCart(next);
}

export function setReceivedAmount(cart: PosCart, received: number): PosCart {
  const next = cloneCart(cart);
  next.payment = setReceivedAmountValue(next.total, next.payment, received);
  return recalculateCart(next);
}
