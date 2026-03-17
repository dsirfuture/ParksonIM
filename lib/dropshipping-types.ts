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
  settlementStatus: "unpaid" | "paid";
  catalogMatched: boolean;
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
  snapshotStockedQty: number | null;
  snapshotStockAmount: number | null;
  warehouse: string;
  color: string;
  shippingFee: number;
  shippingLabelFile: string;
  shippingProofFile: string;
  shippingLabelAttachments: DsOrderAttachment[];
  shippingProofAttachments: DsOrderAttachment[];
  createdAt: string;
  notes: string;
  currentInventoryQty: number | null;
  warnings: string[];
};

export type DsOrderAttachment = {
  id: string;
  type: "label" | "proof";
  fileName: string;
  fileUrl: string;
  sourcePath: string;
  mimeType: string;
  sortOrder: number;
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
  settledOrders: DsFinanceOrderItem[];
};

export type DsFinanceOrderItem = {
  orderId: string;
  platformOrderNo: string;
  sku: string;
  productNameZh: string;
  trackingNo: string;
  shippedAt: string | null;
  settledAt: string | null;
  paidAmount: number;
  totalAmount: number;
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

export type DsLegacyImportRow = {
  customerName: string;
  platform: string;
  platformOrderNo: string;
  trackingNo: string;
  shippingLabelFile: string;
  shippingLabelFiles: DsLegacyImportAsset[];
  shipped: boolean;
  shippedAt: string | null;
  shippingProofFile: string;
  shippingProofFiles: DsLegacyImportAsset[];
  sku: string;
  quantity: number;
  color: string;
  warehouse: string;
  shippingFee: number | null;
  productImageUrl: string;
  productNameZh: string;
  unitPrice: number | null;
  discountRate: number | null;
  stockedQty: number | null;
  stockAmount: number | null;
  rateValue: number | null;
  exchangedAmount: number | null;
  shippingAmount: number | null;
  totalAmount: number | null;
  paidAmount: number | null;
  unpaidAmount: number | null;
  settledAt: string | null;
};

export type DsLegacyImportAsset = {
  displayName: string;
  relativePath: string;
  bytes?: Uint8Array;
  mimeType?: string;
};

export type DsLegacyImportSummary = {
  totalRows: number;
  createdOrders: number;
  updatedOrders: number;
  touchedCustomers: number;
  touchedProducts: number;
  seededPayments: number;
  uploadedLabels: number;
  uploadedProofs: number;
};
