export type DsLang = "zh" | "es";

export type DsShippingStatus = "pending" | "shipped" | "cancelled";
export type DsFinanceStatus = "unpaid" | "partial" | "paid";
export type DsInventoryStatus = "healthy" | "low" | "empty";

export type DsOverviewStats = {
  todayOrders: number;
  todayShippedOrders: number;
  todayPendingOrders: number;
  unsettledCustomers: number;
  totalReceivable: number;
  totalPaid: number;
  totalUnpaid: number;
  currentRate: number | null;
  rateUpdatedAt: string | null;
  rateFailed: boolean;
  rateFailureReason: string | null;
};

export type DsOverviewOrder = {
  id: string;
  customerName: string;
  platform: string;
  orderNo: string;
  sku: string;
  quantity: number;
  shippingStatus: DsShippingStatus;
  createdAt: string;
};

export type DsAlertItem = {
  type:
    | "pending_order"
    | "missing_shipping_proof"
    | "low_inventory"
    | "duplicate_order"
    | "exchange_rate_failed"
    | "customer_unsettled";
  count: number;
};

export type DsOrderRow = {
  id: string;
  customerId: string;
  customerName: string;
  productId: string;
  sku: string;
  productNameZh: string;
  productNameEs: string;
  productImageUrl: string;
  platform: string;
  platformOrderNo: string;
  trackingNo: string;
  quantity: number;
  shippingStatus: DsShippingStatus;
  shippedAt: string | null;
  warehouse: string;
  color: string;
  shippingFee: number;
  shippingLabelFile: string;
  shippingProofFile: string;
  createdAt: string;
  notes: string;
  currentInventoryQty: number | null;
  warnings: string[];
};

export type DsInventoryRow = {
  inventoryId: string;
  customerId: string;
  customerName: string;
  productId: string;
  sku: string;
  productNameZh: string;
  productNameEs: string;
  productImageUrl: string;
  warehouse: string;
  stockedQty: number;
  shippedQty: number;
  remainingQty: number;
  unitPrice: number;
  discountRate: number;
  stockAmount: number;
  status: DsInventoryStatus;
};

export type DsFinanceRow = {
  customerId: string;
  customerName: string;
  stockAmount: number;
  exchangeRate: number | null;
  exchangedAmount: number;
  shippingAmount: number;
  totalAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  status: DsFinanceStatus;
  lastPaidAt: string | null;
};

export type DsExchangeRatePayload = {
  id: string;
  rateDate: string;
  baseCurrency: string;
  targetCurrency: string;
  rateValue: number;
  sourceName: string;
  fetchedAt: string | null;
  isManual: boolean;
  fetchFailed: boolean;
  failureReason: string | null;
};
