import { listProducts } from "@/lib/pos/mock/pos-products.mock";
import { createEmptyCart } from "@/lib/pos/services/pos-cart.service";
import { type PosCart, type PosCashierContext, type PosMemoryStoreState, type PosQuoteDraft, type PosSaleRecord, type PosStoreContext, type PosSuspendedOrder } from "@/lib/pos/types";

const state: PosMemoryStoreState = {
  products: listProducts(),
  currentCart: createEmptyCart(),
  suspendedOrders: [],
  quotes: [],
  sales: [],
  storeContext: {
    storeId: "store-demo-001",
    storeName: "PARKSON STORE DEMO",
  },
  cashierContext: {
    cashierId: "cashier-demo-001",
    cashierName: "CAJERO 01",
  },
};

export function getPosMemoryStore() {
  return state;
}

export function getPosProducts() {
  return state.products.map((item) => ({ ...item }));
}

export function getCurrentCart() {
  return {
    ...state.currentCart,
    customer: { ...state.currentCart.customer },
    orderDiscount: state.currentCart.orderDiscount ? { ...state.currentCart.orderDiscount } : null,
    payment: { ...state.currentCart.payment },
    lines: state.currentCart.lines.map((line) => ({ ...line, lineDiscount: line.lineDiscount ? { ...line.lineDiscount } : null })),
  };
}

export function setCurrentCart(cart: PosCart) {
  state.currentCart = {
    ...cart,
    customer: { ...cart.customer },
    orderDiscount: cart.orderDiscount ? { ...cart.orderDiscount } : null,
    payment: { ...cart.payment },
    lines: cart.lines.map((line) => ({ ...line, lineDiscount: line.lineDiscount ? { ...line.lineDiscount } : null })),
  };
}

export function getSuspendedOrders() {
  return state.suspendedOrders.map((order) => ({
    ...order,
    customer: { ...order.customer },
    lines: order.lines.map((line) => ({ ...line, lineDiscount: line.lineDiscount ? { ...line.lineDiscount } : null })),
  }));
}

export function setSuspendedOrders(orders: PosSuspendedOrder[]) {
  state.suspendedOrders = orders.map((order) => ({
    ...order,
    customer: { ...order.customer },
    lines: order.lines.map((line) => ({ ...line, lineDiscount: line.lineDiscount ? { ...line.lineDiscount } : null })),
  }));
}

export function getQuotes() {
  return state.quotes.map((quote) => ({
    ...quote,
    customer: { ...quote.customer },
    lines: quote.lines.map((line) => ({ ...line, lineDiscount: line.lineDiscount ? { ...line.lineDiscount } : null })),
  }));
}

export function setQuotes(quotes: PosQuoteDraft[]) {
  state.quotes = quotes.map((quote) => ({
    ...quote,
    customer: { ...quote.customer },
    lines: quote.lines.map((line) => ({ ...line, lineDiscount: line.lineDiscount ? { ...line.lineDiscount } : null })),
  }));
}

export function getSales() {
  return state.sales.map((sale) => ({
    ...sale,
    customer: { ...sale.customer },
    lines: sale.lines.map((line) => ({ ...line, lineDiscount: line.lineDiscount ? { ...line.lineDiscount } : null })),
  }));
}

export function setSales(sales: PosSaleRecord[]) {
  state.sales = sales.map((sale) => ({
    ...sale,
    customer: { ...sale.customer },
    lines: sale.lines.map((line) => ({ ...line, lineDiscount: line.lineDiscount ? { ...line.lineDiscount } : null })),
  }));
}

export function setPosStoreContext(storeContext: PosStoreContext) {
  state.storeContext = { ...storeContext };
}

export function setPosCashierContext(cashierContext: PosCashierContext) {
  state.cashierContext = { ...cashierContext };
}
