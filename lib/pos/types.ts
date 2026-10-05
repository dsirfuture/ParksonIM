export type PosPaymentMethod = "cash" | "transfer" | "card" | null;
export type PosSourceType = "direct" | "suspended" | "quote";

export type PosDiscountType = "amount" | "percent";
export type PosDiscountScope = "line" | "order";

export type PosProduct = {
  id: string;
  sourceProductId?: string;
  sourceKind?: "inventory" | "yogo";
  inventoryManaged?: boolean;
  barcode: string;
  clave: string;
  imageUrl?: string;
  nameCn: string;
  nameEs: string;
  category: string;
  subcategory: string;
  spec: string;
  origin: string;
  importer: string;
  shortDescription: string;
  price: number;
  stock: number;
  allowDiscount: boolean;
  active: boolean;
};

export type PosCustomer = {
  name: string;
  phone: string;
  rfc: string;
  notes: string;
};

export type PosDiscount = {
  type: PosDiscountType;
  value: number;
  scope: PosDiscountScope;
};

export type PosCartLine = {
  lineId: string;
  productId: string;
  sourceKind?: "inventory" | "yogo";
  inventoryManaged?: boolean;
  barcode: string;
  clave: string;
  nameCn: string;
  nameEs: string;
  spec: string;
  qty: number;
  unitPrice: number;
  lineDiscount: PosDiscount | null;
  subtotal: number;
};

export type PosPayment = {
  method: PosPaymentMethod;
  received: number;
  change: number;
};

export type PosCart = {
  lines: PosCartLine[];
  customer: PosCustomer;
  orderDiscount: PosDiscount | null;
  payment: PosPayment;
  sourceType: PosSourceType;
  sourceId: string | null;
  subtotal: number;
  discountTotal: number;
  total: number;
};

export type PosStoreContext = {
  storeId: string;
  storeName: string;
};

export type PosCashierContext = {
  cashierId: string;
  cashierName: string;
};

export type PosSuspendedOrder = {
  id: string;
  folio: string;
  storeId?: string;
  customer: PosCustomer;
  lines: PosCartLine[];
  subtotal: number;
  discountTotal: number;
  total: number;
  note: string;
  createdAt: string;
  cashierName: string;
  status: string;
  paymentMethod: PosPaymentMethod;
};

export type PosQuoteDraft = {
  id: string;
  folio: string;
  storeId?: string;
  customer: PosCustomer;
  lines: PosCartLine[];
  subtotal: number;
  discountTotal: number;
  total: number;
  note: string;
  createdAt: string;
  status: string;
};

export type PosMemoryStoreState = {
  products: PosProduct[];
  currentCart: PosCart;
  suspendedOrders: PosSuspendedOrder[];
  quotes: PosQuoteDraft[];
  sales: PosSaleRecord[];
  storeContext: PosStoreContext;
  cashierContext: PosCashierContext;
};

export type PosProductSearchInput = {
  barcode?: string;
  clave?: string;
  name?: string;
  q?: string;
};

export type PosSuspendedOrderInput = {
  store: PosStoreContext;
  cashier: PosCashierContext;
  customer: PosCustomer;
  lines: PosCartLine[];
  subtotal: number;
  discountTotal: number;
  total: number;
  note: string;
  paymentMethod: PosPaymentMethod;
};

export type PosQuoteDraftInput = {
  store: PosStoreContext;
  cashier: PosCashierContext;
  customer: PosCustomer;
  lines: PosCartLine[];
  subtotal: number;
  discountTotal: number;
  total: number;
  note: string;
};

export type PosCheckoutInput = {
  store: PosStoreContext;
  cashier: PosCashierContext;
  customer: PosCustomer;
  lines: PosCartLine[];
  orderDiscount: PosDiscount | null;
  payment: PosPayment;
  sourceType: PosSourceType;
  sourceId: string | null;
  subtotal: number;
  discountTotal: number;
  total: number;
  note: string;
};

export type PosSaleRecord = {
  id: string;
  folio: string;
  storeId?: string;
  sourceType: PosSourceType;
  sourceId: string | null;
  customer: PosCustomer;
  lines: PosCartLine[];
  subtotal: number;
  discountTotal: number;
  total: number;
  paymentMethod: PosPaymentMethod;
  receivedAmount: number;
  changeAmount: number;
  note: string;
  cashierName: string;
  status: string;
  createdAt: string;
};

export type PosCheckoutResult = {
  saleId: string;
  folio: string;
  total: number;
  paymentMethod: PosPaymentMethod;
  createdAt: string;
  status: string;
};

export type PosSaleListItem = {
  id: string;
  folio: string;
  storeId?: string;
  sourceType: PosSourceType;
  sourceId: string | null;
  sourceFolio?: string;
  customerName: string;
  customerPhone?: string;
  customerRfc?: string;
  note?: string;
  total: number;
  subtotal?: number;
  discountTotal?: number;
  paymentMethod: PosPaymentMethod;
  receivedAmount?: number;
  changeAmount?: number;
  cashierName: string;
  status: string;
  createdAt: string;
  lines?: PosCartLine[];
};

export type PosTicketLine = {
  productName: string;
  clave: string;
  barcode: string;
  spec: string;
  qty: number;
  unitPrice: number;
  discountType: PosDiscountType | null;
  discountValue: number;
  subtotal: number;
};

export type PosTicketDto = {
  saleId: string;
  folio: string;
  createdAt: string;
  storeName: string;
  companyFullName: string;
  headerSubtitle: string;
  logoUrl: string;
  showLogo: boolean;
  address: string;
  phone: string;
  whatsapp: string;
  website: string;
  qrContent: string;
  rfc: string;
  ticketBarcodeValue: string;
  showRfc: boolean;
  showWhatsapp: boolean;
  showWebsite: boolean;
  showQr: boolean;
  showTicketBarcode: boolean;
  showCashier: boolean;
  showCustomer: boolean;
  cashierName: string;
  customerName: string;
  paymentMethod: PosPaymentMethod;
  receivedAmount: number;
  changeAmount: number;
  subtotal: number;
  discountTotal: number;
  total: number;
  lines: PosTicketLine[];
  footerLine1: string;
  footerLine2: string;
};

export type PosSaleQuery = {
  dateFrom?: string;
  dateTo?: string;
  folio?: string;
  customer?: string;
  paymentMethod?: string;
  status?: string;
  storeId?: string;
  take?: number;
};

export type PosRefundRecord = {
  id: string;
  saleRecordId: string;
  folio: string;
  reason: string;
  subtotal: number;
  discountTotal: number;
  total: number;
  createdAt: string;
};

export type PosInventoryStatus = "ok" | "low" | "out";
export type PosInventoryAdjustType = "increase" | "decrease";
export type PosInventoryMoveType = "sale" | "return" | "adjust" | "import" | "transfer_out" | "transfer_in" | "count" | "damage";

export type PosInventoryItem = {
  id: string;
  storeId: string;
  productId: string;
  clave: string;
  barcode: string;
  productName: string;
  spec: string;
  onHandQty: number;
  reservedQty: number;
  availableQty: number;
  minStock: number;
  active: boolean;
  status: PosInventoryStatus;
  updatedAt: string;
};

export type PosInventoryDetail = PosInventoryItem;

export type PosInventoryQuery = {
  storeId?: string;
  keyword?: string;
  clave?: string;
  barcode?: string;
  status?: string;
  lowStockOnly?: boolean;
  page?: number;
  limit?: number;
};

export type PosInventoryListResult = {
  items: PosInventoryItem[];
  total: number;
  page: number;
  limit: number;
};

export type PosInventoryAdjustInput = {
  adjustType: PosInventoryAdjustType;
  qty: number;
  reason: string;
  note?: string;
  operator?: string;
};

export type PosInventoryCountInput = {
  finalQty: number;
  reason: string;
  note?: string;
  operator?: string;
};

export type PosInventoryDamageInput = {
  qty: number;
  reason: string;
  note?: string;
  operator?: string;
};

export type PosInventoryMovementItem = {
  id: string;
  createdAt: string;
  storeId: string;
  productId: string;
  clave: string;
  barcode: string;
  productName: string;
  moveType: PosInventoryMoveType | string;
  qtyChange: number;
  qtyBefore: number;
  qtyAfter: number;
  sourceType: string;
  sourceId?: string | null;
  sourceFolio?: string | null;
  createdBy?: string | null;
  note?: string | null;
};

export type PosInventoryMovementQuery = {
  storeId?: string;
  productId?: string;
  keyword?: string;
  moveType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

export type PosInventoryMovementListResult = {
  items: PosInventoryMovementItem[];
  total: number;
  page: number;
  limit: number;
};

export type PosInventoryImportRowInput = {
  storeId: string;
  clave: string;
  barcode: string;
  qty: number;
  note?: string;
};

export type PosInventoryImportRowStatus =
  | "ready"
  | "store_not_found"
  | "identifier_missing"
  | "product_not_found"
  | "product_mismatch"
  | "qty_invalid"
  | "duplicate";

export type PosInventoryImportPreviewItem = {
  rowNumber: number;
  storeId: string;
  clave: string;
  barcode: string;
  qty: number;
  note: string;
  productId?: string;
  productName?: string;
  canImport: boolean;
  status: PosInventoryImportRowStatus;
  reason: string;
  currentQty?: number;
};

export type PosInventoryImportPreviewResult = {
  items: PosInventoryImportPreviewItem[];
  total: number;
  importableCount: number;
  invalidCount: number;
};

export type PosInventoryImportCommitItem = {
  rowNumber: number;
  storeId: string;
  productId: string;
  productName: string;
  qtyChange: number;
  qtyBefore: number;
  qtyAfter: number;
};

export type PosInventoryImportCommitResult = {
  totalRows: number;
  importedCount: number;
  items: PosInventoryImportCommitItem[];
};

export type PosTransferStatus = "draft" | "sent" | "received" | "canceled";

export type PosTransferLine = {
  lineId: string;
  productId: string;
  barcode: string;
  clave: string;
  nameCn: string;
  nameEs: string;
  spec: string;
  qty: number;
};

export type PosTransferCreateLineInput = {
  productId: string;
  barcode: string;
  clave: string;
  nameCn: string;
  nameEs: string;
  spec: string;
  qty: number;
};

export type PosTransferCreateInput = {
  fromStoreId: string;
  toStoreId: string;
  note?: string;
  createdBy?: string;
  createdByName?: string;
  lines: PosTransferCreateLineInput[];
};

export type PosTransferItem = {
  id: string;
  folio: string;
  fromStoreId: string;
  toStoreId: string;
  createdBy?: string | null;
  createdByName: string;
  note: string;
  status: PosTransferStatus;
  lineCount: number;
  totalQty: number;
  createdAt: string;
  sentAt?: string | null;
  receivedAt?: string | null;
  lines?: PosTransferLine[];
};

export type PosTransferDetail = PosTransferItem;

export type PosTransferQuery = {
  fromStoreId?: string;
  toStoreId?: string;
  relatedStoreId?: string;
  status?: string;
  folio?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

export type PosTransferListResult = {
  items: PosTransferItem[];
  total: number;
  page: number;
  limit: number;
  stores: string[];
};

export type PosStoreSetting = {
  id: string;
  storeId: string;
  storeName: string;
  companyFullName: string;
  storeCode: string;
  address: string;
  phone: string;
  rfc: string;
  active: boolean;
  defaultTicketHeader: string;
  ticketSubtitle: string;
  cashierAutoCloseEnabled: boolean;
  cashierAutoCloseMinutes: number;
  updatedAt: string;
};

export type PosStoreSettingQuery = {
  storeId?: string;
};

export type PosStoreSettingInput = {
  storeName: string;
  companyFullName?: string;
  storeCode?: string;
  address?: string;
  phone?: string;
  rfc?: string;
  active: boolean;
  defaultTicketHeader?: string;
  ticketSubtitle?: string;
  cashierAutoCloseEnabled?: boolean;
  cashierAutoCloseMinutes?: number;
};

export type PosTicketSettingConfig = {
  id: string;
  storeId: string;
  ticketHeaderName: string;
  ticketHeaderSubtitle: string;
  companyFullName: string;
  logoUrl: string;
  showLogo: boolean;
  address: string;
  phone: string;
  whatsapp: string;
  website: string;
  qrContent: string;
  rfc: string;
  showRfc: boolean;
  showWhatsapp: boolean;
  showWebsite: boolean;
  showQr: boolean;
  showTicketBarcode: boolean;
  showCashier: boolean;
  showCustomer: boolean;
  footerLine1: string;
  footerLine2: string;
  updatedAt: string;
};

export type PosTicketSettingInput = {
  ticketHeaderName?: string;
  ticketHeaderSubtitle?: string;
  companyFullName?: string;
  logoUrl?: string;
  showLogo: boolean;
  address?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  qrContent?: string;
  rfc?: string;
  showRfc: boolean;
  showWhatsapp: boolean;
  showWebsite: boolean;
  showQr: boolean;
  showTicketBarcode: boolean;
  showCashier: boolean;
  showCustomer: boolean;
  footerLine1?: string;
  footerLine2?: string;
};

export type PosCashierRole = "admin_general" | "store_admin" | "cashier";
export type PosPermissionOverrideEffect = "grant" | "deny";
export type PosPermissionOverrideItem = {
  permissionKey: string;
  effect: PosPermissionOverrideEffect;
};

export type PosCashierPermissionState = {
  roleDefaults: string[];
  grants: string[];
  denies: string[];
  effective: string[];
};

export type PosCashierItem = {
  id: string;
  account: string;
  name: string;
  phone: string;
  phoneCountry: string;
  email: string;
  avatarUrl: string | null;
  storeId: string;
  role: PosCashierRole;
  active: boolean;
  updatedAt: string;
};

export type PosCashierDetail = PosCashierItem & {
  permissions: PosCashierPermissionState;
};

export type PosCashierQuery = {
  storeId?: string;
  keyword?: string;
  role?: string;
  status?: string;
};

export type PosCashierUpsertInput = {
  account: string;
  name: string;
  phone: string;
  phoneCountry?: string;
  email?: string;
  password?: string;
  storeId: string;
  role: PosCashierRole;
  active: boolean;
  permissionOverrides?: PosPermissionOverrideItem[];
};

export type PosLabelTemplateType = "product" | "shelf";
export type PosLabelSize = "40x50" | "80x50";

export type PosLabelItem = {
  productId: string;
  storeId: string;
  clave: string;
  barcode: string;
  imageUrl?: string;
  storeName?: string;
  nameCn: string;
  nameEs: string;
  price: number;
  origin: string;
  importer: string;
  shortDescription: string;
  copies: number;
};

export type PosLabelPrintFields = {
  price: boolean;
  barcode: boolean;
  nameCn: boolean;
  nameEs: boolean;
  clave: boolean;
  origin: boolean;
  importer: boolean;
  shortDescription: boolean;
};

export type PosReportQuery = {
  storeId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  granularity?: "day";
};

export type PosReplenishmentInventoryStatus = "ok" | "low" | "out";
export type PosReplenishmentSuggestionStatus = "none" | "suggested";

export type PosReplenishmentSuggestionItem = {
  storeId: string;
  productId: string;
  clave: string;
  barcode: string;
  productName: string;
  currentQty: number;
  minStock: number;
  sales7d: number;
  sales30d: number;
  avgDailySales: number;
  suggestedQty: number;
  inventoryStatus: PosReplenishmentInventoryStatus;
  suggestionStatus: PosReplenishmentSuggestionStatus;
  combinedStatus: string;
};

export type PosReplenishmentSuggestionQuery = {
  storeId?: string;
  keyword?: string;
  lowStockOnly?: boolean;
  suggestedOnly?: boolean;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  lang?: "zh" | "es";
};

export type PosReplenishmentSuggestionResult = {
  items: PosReplenishmentSuggestionItem[];
  total: number;
  stores: string[];
  targetDays: number;
};

export type PosAuditResultStatus = "success" | "failed" | "denied";

export type PosAuditLogItem = {
  id: string;
  actionType: string;
  module: string;
  actorUserId?: string | null;
  actorName: string;
  actorRole: string;
  storeId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  targetFolio?: string | null;
  summary: string;
  detailsJson?: Record<string, unknown> | null;
  resultStatus: PosAuditResultStatus | string;
  createdAt: string;
};

export type PosAuditDetailField = {
  labelKey: string;
  value: string;
};

export type PosAuditDetailChange = {
  labelKey: string;
  before: string;
  after: string;
  change?: string;
};

export type PosAuditLogDetail = PosAuditLogItem & {
  keyFields?: PosAuditDetailField[];
  detailFields?: PosAuditDetailField[];
  changeFields?: PosAuditDetailChange[];
};

export type PosAuditLogQuery = {
  storeId?: string;
  actorUserId?: string;
  actorRole?: string;
  module?: string;
  actionType?: string;
  resultStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

export type PosAuditLogListResult = {
  items: PosAuditLogItem[];
  total: number;
  page: number;
  limit: number;
};

export type PosDashboardSummary = {
  salesTotal: number;
  refundTotal: number;
  netSalesTotal: number;
  orderCount: number;
  todayOrderCount: number;
  weekOrderCount: number;
  monthOrderCount: number;
  refundedOrderCount: number;
  avgTicket: number;
  todaySalesTotal: number;
  weekSalesTotal: number;
  monthSalesTotal: number;
};

export type PosPaymentsSummary = {
  cashTotal: number;
  transferTotal: number;
  cardTotal: number;
  refundTotal: number;
};

export type PosTopProductItem = {
  productId: string;
  clave: string;
  productName: string;
  qtyTotal: number;
  salesTotal: number;
};

export type PosTopProductsReport = {
  topByQty: PosTopProductItem[];
  topBySales: PosTopProductItem[];
};

export type PosInventoryLowStockItem = {
  storeId: string;
  productId: string;
  clave: string;
  productName: string;
  onHandQty: number;
  availableQty: number;
  minStock: number;
};

export type PosInventoryOverview = {
  totalActiveInventoryItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  lowStockItems: PosInventoryLowStockItem[];
};

export type PosSalesTrendPoint = {
  bucket: string;
  salesTotal: number;
  refundTotal: number;
  netSalesTotal: number;
  orderCount: number;
};
