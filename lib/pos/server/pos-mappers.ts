import { type PosCart, type PosCartLine, type PosDiscountType, type PosPaymentMethod, type PosProduct, type PosQuoteDraft, type PosSaleListItem, type PosSaleRecord, type PosSuspendedOrder, type PosTicketDto, type PosTransferDetail, type PosTransferItem, type PosTransferLine, type PosTransferStatus } from "@/lib/pos/types";

function toNumber(value: unknown) {
  if (typeof value === "number") return Number(value.toFixed(2));
  if (typeof value === "string") return Number(Number(value).toFixed(2));
  if (value && typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
    return Number((value as { toNumber: () => number }).toNumber().toFixed(2));
  }
  return 0;
}

function cleanText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function toPaymentMethod(value: string | null | undefined): PosPaymentMethod {
  if (value === "cash" || value === "transfer" || value === "card") return value;
  return null;
}

function toLineDiscount(type: string | null | undefined, value: unknown) {
  if (!type || (type !== "amount" && type !== "percent")) return null;
  return {
    type: type as PosDiscountType,
    value: toNumber(value),
    scope: "line" as const,
  };
}

export function mapPosProductRow(input: {
  id: string;
  sourceProductId?: string;
  sourceKind?: "inventory" | "yogo";
  inventoryManaged?: boolean | null;
  barcode?: string | null;
  clave?: string | null;
  nameCn?: string | null;
  nameEs?: string | null;
  category?: string | null;
  subcategory?: string | null;
  spec?: string | null;
  origin?: string | null;
  importer?: string | null;
  shortDescription?: string | null;
  posPrice?: unknown;
  sourcePrice?: unknown;
  active?: boolean | null;
  allowDiscount?: boolean | null;
  imageUrl?: string | null;
}): PosProduct {
  return {
    id: input.id,
    sourceProductId: input.sourceProductId || input.id,
    sourceKind: input.sourceKind || "inventory",
    inventoryManaged: input.inventoryManaged ?? true,
    barcode: cleanText(input.barcode),
    clave: cleanText(input.clave),
    nameCn: cleanText(input.nameCn),
    nameEs: cleanText(input.nameEs),
    category: cleanText(input.category),
    subcategory: cleanText(input.subcategory),
    spec: cleanText(input.spec),
    origin: cleanText(input.origin),
    importer: cleanText(input.importer),
    shortDescription: cleanText(input.shortDescription),
    imageUrl: cleanText(input.imageUrl),
    price: toNumber(input.posPrice ?? input.sourcePrice),
    stock: toNumber("stock" in input ? (input as { stock?: unknown }).stock : 0),
    allowDiscount: input.allowDiscount ?? true,
    active: input.active ?? true,
  };
}

export function mapStoredLineToCartLine(input: {
  id: string;
  product_id: string;
  sourceKind?: "inventory" | "yogo";
  inventoryManaged?: boolean | null;
  barcode_snapshot?: string | null;
  clave_snapshot?: string | null;
  name_cn_snapshot?: string | null;
  name_es_snapshot?: string | null;
  spec_snapshot?: string | null;
  qty: number;
  unit_price: unknown;
  discount_type?: string | null;
  discount_value?: unknown;
  subtotal: unknown;
}): PosCartLine {
  return {
    lineId: input.id,
    productId: input.product_id,
    sourceKind: input.sourceKind || "inventory",
    inventoryManaged: input.inventoryManaged ?? true,
    barcode: cleanText(input.barcode_snapshot),
    clave: cleanText(input.clave_snapshot),
    nameCn: cleanText(input.name_cn_snapshot),
    nameEs: cleanText(input.name_es_snapshot),
    spec: cleanText(input.spec_snapshot),
    qty: input.qty,
    unitPrice: toNumber(input.unit_price),
    lineDiscount: toLineDiscount(input.discount_type, input.discount_value),
    subtotal: toNumber(input.subtotal),
  };
}

export function mapSuspendedRecordToDto(record: {
  id: string;
  folio: string;
  store_id?: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_rfc: string | null;
  note: string | null;
  subtotal: unknown;
  discount_total: unknown;
  total: unknown;
  created_at: Date;
  cashier_name: string;
  status: string;
  payment_method?: string | null;
  lines: Array<{
    id: string;
    product_id: string;
    barcode_snapshot?: string | null;
    clave_snapshot?: string | null;
    name_cn_snapshot?: string | null;
    name_es_snapshot?: string | null;
    spec_snapshot?: string | null;
    qty: number;
    unit_price: unknown;
    discount_type?: string | null;
    discount_value?: unknown;
    subtotal: unknown;
  }>;
}): PosSuspendedOrder {
  return {
    id: record.id,
    folio: record.folio,
    storeId: cleanText(record.store_id),
    customer: {
      name: record.customer_name || "",
      phone: record.customer_phone || "",
      rfc: record.customer_rfc || "",
      notes: record.note || "",
    },
    lines: record.lines.map(mapStoredLineToCartLine),
    subtotal: toNumber(record.subtotal),
    discountTotal: toNumber(record.discount_total),
    total: toNumber(record.total),
    note: record.note || "",
    createdAt: record.created_at.toISOString(),
    cashierName: record.cashier_name,
    status: record.status,
    paymentMethod: toPaymentMethod(record.payment_method),
  };
}

export function mapQuoteRecordToDto(record: {
  id: string;
  folio: string;
  store_id?: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_rfc: string | null;
  note: string | null;
  subtotal: unknown;
  discount_total: unknown;
  total: unknown;
  created_at: Date;
  status: string;
  lines: Array<{
    id: string;
    product_id: string;
    barcode_snapshot?: string | null;
    clave_snapshot?: string | null;
    name_cn_snapshot?: string | null;
    name_es_snapshot?: string | null;
    spec_snapshot?: string | null;
    qty: number;
    unit_price: unknown;
    discount_type?: string | null;
    discount_value?: unknown;
    subtotal: unknown;
  }>;
}): PosQuoteDraft {
  return {
    id: record.id,
    folio: record.folio,
    storeId: cleanText(record.store_id),
    customer: {
      name: record.customer_name || "",
      phone: record.customer_phone || "",
      rfc: record.customer_rfc || "",
      notes: record.note || "",
    },
    lines: record.lines.map(mapStoredLineToCartLine),
    subtotal: toNumber(record.subtotal),
    discountTotal: toNumber(record.discount_total),
    total: toNumber(record.total),
    note: record.note || "",
    createdAt: record.created_at.toISOString(),
    status: record.status,
  };
}

export function mapSaleRecordToDto(record: {
  id: string;
  folio: string;
  store_id?: string | null;
  source_type: string;
  source_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_rfc: string | null;
  note: string | null;
  subtotal: unknown;
  discount_total: unknown;
  total: unknown;
  payment_method: string | null;
  received_amount: unknown;
  change_amount: unknown;
  cashier_name: string;
  status: string;
  created_at: Date;
  lines: Array<{
    id: string;
    product_id: string;
    barcode_snapshot?: string | null;
    clave_snapshot?: string | null;
    name_cn_snapshot?: string | null;
    name_es_snapshot?: string | null;
    spec_snapshot?: string | null;
    qty: number;
    unit_price: unknown;
    discount_type?: string | null;
    discount_value?: unknown;
    subtotal: unknown;
  }>;
}): PosSaleRecord {
  return {
    id: record.id,
    folio: record.folio,
    sourceType: record.source_type === "suspended" || record.source_type === "quote" ? record.source_type : "direct",
    sourceId: record.source_id,
    customer: {
      name: record.customer_name || "",
      phone: record.customer_phone || "",
      rfc: record.customer_rfc || "",
      notes: record.note || "",
    },
    lines: record.lines.map(mapStoredLineToCartLine),
    subtotal: toNumber(record.subtotal),
    discountTotal: toNumber(record.discount_total),
    total: toNumber(record.total),
    paymentMethod: toPaymentMethod(record.payment_method),
    receivedAmount: toNumber(record.received_amount),
    changeAmount: toNumber(record.change_amount),
    note: record.note || "",
    cashierName: record.cashier_name,
    status: record.status,
    createdAt: record.created_at.toISOString(),
  };
}

export function mapSaleRecordToListItem(record: {
  id: string;
  folio: string;
  store_id?: string | null;
  source_type: string;
  source_id: string | null;
  customer_name: string | null;
  customer_phone?: string | null;
  customer_rfc?: string | null;
  note?: string | null;
  subtotal?: unknown;
  discount_total?: unknown;
  total: unknown;
  payment_method: string | null;
  received_amount?: unknown;
  change_amount?: unknown;
  cashier_name: string;
  status: string;
  created_at: Date;
  lines?: Array<{
    id: string;
    product_id: string;
    barcode_snapshot?: string | null;
    clave_snapshot?: string | null;
    name_cn_snapshot?: string | null;
    name_es_snapshot?: string | null;
    spec_snapshot?: string | null;
    qty: number;
    unit_price: unknown;
    discount_type?: string | null;
    discount_value?: unknown;
    subtotal: unknown;
  }>;
}): PosSaleListItem {
  return {
    id: record.id,
    folio: record.folio,
    storeId: cleanText(record.store_id),
    sourceType: record.source_type === "suspended" || record.source_type === "quote" ? record.source_type : "direct",
    sourceId: record.source_id,
    customerName: record.customer_name || "",
    customerPhone: record.customer_phone || "",
    customerRfc: record.customer_rfc || "",
    note: record.note || "",
    total: toNumber(record.total),
    subtotal: toNumber(record.subtotal),
    discountTotal: toNumber(record.discount_total),
    paymentMethod: toPaymentMethod(record.payment_method),
    receivedAmount: toNumber(record.received_amount),
    changeAmount: toNumber(record.change_amount),
    cashierName: record.cashier_name,
    status: record.status,
    createdAt: record.created_at.toISOString(),
    lines: record.lines?.map(mapStoredLineToCartLine) || [],
  };
}

function toTransferStatus(value: string | null | undefined): PosTransferStatus {
  if (value === "sent" || value === "received" || value === "canceled") return value;
  return "draft";
}

function mapTransferLine(input: {
  id: string;
  product_id: string;
  barcode_snapshot?: string | null;
  clave_snapshot?: string | null;
  name_cn_snapshot?: string | null;
  name_es_snapshot?: string | null;
  spec_snapshot?: string | null;
  qty: number;
}): PosTransferLine {
  return {
    lineId: input.id,
    productId: input.product_id,
    barcode: cleanText(input.barcode_snapshot),
    clave: cleanText(input.clave_snapshot),
    nameCn: cleanText(input.name_cn_snapshot),
    nameEs: cleanText(input.name_es_snapshot),
    spec: cleanText(input.spec_snapshot),
    qty: input.qty,
  };
}

export function mapTransferRecordToListItem(record: {
  id: string;
  folio: string;
  from_store_id: string;
  to_store_id: string;
  created_by?: string | null;
  created_by_name: string;
  note?: string | null;
  status: string;
  created_at: Date;
  sent_at?: Date | null;
  received_at?: Date | null;
  lines?: Array<{
    id: string;
    product_id: string;
    barcode_snapshot?: string | null;
    clave_snapshot?: string | null;
    name_cn_snapshot?: string | null;
    name_es_snapshot?: string | null;
    spec_snapshot?: string | null;
    qty: number;
  }>;
}): PosTransferItem {
  const lines = (record.lines || []).map(mapTransferLine);
  return {
    id: record.id,
    folio: record.folio,
    fromStoreId: record.from_store_id,
    toStoreId: record.to_store_id,
    createdBy: record.created_by || null,
    createdByName: cleanText(record.created_by_name),
    note: cleanText(record.note),
    status: toTransferStatus(record.status),
    lineCount: lines.length,
    totalQty: lines.reduce((sum, item) => sum + item.qty, 0),
    createdAt: record.created_at.toISOString(),
    sentAt: record.sent_at?.toISOString() || null,
    receivedAt: record.received_at?.toISOString() || null,
    lines,
  };
}

export function mapTransferRecordToDetail(record: {
  id: string;
  folio: string;
  from_store_id: string;
  to_store_id: string;
  created_by?: string | null;
  created_by_name: string;
  note?: string | null;
  status: string;
  created_at: Date;
  sent_at?: Date | null;
  received_at?: Date | null;
  lines?: Array<{
    id: string;
    product_id: string;
    barcode_snapshot?: string | null;
    clave_snapshot?: string | null;
    name_cn_snapshot?: string | null;
    name_es_snapshot?: string | null;
    spec_snapshot?: string | null;
    qty: number;
  }>;
}): PosTransferDetail {
  return mapTransferRecordToListItem(record);
}

export function mapSaleRecordToTicketDto(input: {
  sale: {
    id: string;
    folio: string;
    store_id: string;
    cashier_name: string;
    customer_name: string | null;
    subtotal: unknown;
    discount_total: unknown;
    total: unknown;
    payment_method: string | null;
    received_amount: unknown;
    change_amount: unknown;
    created_at: Date;
    lines: Array<{
      barcode_snapshot?: string | null;
      clave_snapshot?: string | null;
      name_cn_snapshot?: string | null;
      name_es_snapshot?: string | null;
      spec_snapshot?: string | null;
      qty: number;
      unit_price: unknown;
      discount_type?: string | null;
      discount_value?: unknown;
      subtotal: unknown;
    }>;
  };
  ticketSetting?: {
    ticket_header_name?: string | null;
    ticket_header_subtitle?: string | null;
    logo_url?: string | null;
    show_logo?: boolean | null;
    address?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    website?: string | null;
    qr_content?: string | null;
    rfc?: string | null;
    show_ticket_barcode?: boolean | null;
    footer_line_1?: string | null;
    footer_line_2?: string | null;
    show_rfc?: boolean | null;
    show_whatsapp?: boolean | null;
    show_website?: boolean | null;
    show_qr?: boolean | null;
    show_cashier?: boolean | null;
    show_customer?: boolean | null;
  } | null;
  storeSetting?: {
    store_name?: string | null;
    company_full_name?: string | null;
    address?: string | null;
    phone?: string | null;
    rfc?: string | null;
    default_ticket_header?: string | null;
    ticket_subtitle?: string | null;
  } | null;
}): PosTicketDto {
  const sale = input.sale;
  const setting = input.ticketSetting;
  const store = input.storeSetting;
  return {
    saleId: sale.id,
    folio: sale.folio,
    createdAt: sale.created_at.toISOString(),
    storeName: cleanText(setting?.ticket_header_name) || cleanText(store?.default_ticket_header) || cleanText(store?.store_name) || (sale.store_id === "default" ? "PARKSON POS" : sale.store_id),
    companyFullName: cleanText(store?.company_full_name),
    headerSubtitle: cleanText(setting?.ticket_header_subtitle) || cleanText(store?.ticket_subtitle),
    logoUrl: cleanText(setting?.logo_url),
    showLogo: Boolean(setting?.show_logo) && cleanText(setting?.logo_url).length > 0,
    address: cleanText(setting?.address) || cleanText(store?.address),
    phone: cleanText(setting?.phone) || cleanText(store?.phone),
    whatsapp: cleanText(setting?.whatsapp),
    website: cleanText(setting?.website),
    qrContent: cleanText(setting?.qr_content),
    rfc: cleanText(setting?.rfc) || cleanText(store?.rfc),
    ticketBarcodeValue: sale.folio,
    showRfc: Boolean(setting?.show_rfc),
    showWhatsapp: Boolean(setting?.show_whatsapp),
    showWebsite: Boolean(setting?.show_website),
    showQr: Boolean(setting?.show_qr) && cleanText(setting?.qr_content).length > 0,
    showTicketBarcode: Boolean(setting?.show_ticket_barcode),
    showCashier: setting?.show_cashier ?? true,
    showCustomer: setting?.show_customer ?? true,
    cashierName: sale.cashier_name,
    customerName: sale.customer_name || "",
    paymentMethod: toPaymentMethod(sale.payment_method),
    receivedAmount: toNumber(sale.received_amount),
    changeAmount: toNumber(sale.change_amount),
    subtotal: toNumber(sale.subtotal),
    discountTotal: toNumber(sale.discount_total),
    total: toNumber(sale.total),
    lines: sale.lines.map((line) => ({
      productName: cleanText(line.name_cn_snapshot) || cleanText(line.name_es_snapshot) || cleanText(line.clave_snapshot),
      clave: cleanText(line.clave_snapshot),
      barcode: cleanText(line.barcode_snapshot),
      spec: cleanText(line.spec_snapshot),
      qty: line.qty,
      unitPrice: toNumber(line.unit_price),
      discountType: line.discount_type === "amount" || line.discount_type === "percent" ? line.discount_type : null,
      discountValue: toNumber(line.discount_value),
      subtotal: toNumber(line.subtotal),
    })),
    footerLine1: cleanText(setting?.footer_line_1),
    footerLine2: cleanText(setting?.footer_line_2),
  };
}

export function toCartFromSuspended(order: PosSuspendedOrder): PosCart {
  return {
    lines: order.lines.map((line) => ({
      ...line,
      lineDiscount: line.lineDiscount ? { ...line.lineDiscount } : null,
    })),
    customer: {
      ...order.customer,
      notes: order.note || order.customer.notes,
    },
    orderDiscount: null,
    payment: {
      method: order.paymentMethod,
      received: order.paymentMethod === "cash" ? 0 : order.total,
      change: 0,
    },
    sourceType: "suspended",
    sourceId: order.id,
    subtotal: order.subtotal,
    discountTotal: order.discountTotal,
    total: order.total,
  };
}
