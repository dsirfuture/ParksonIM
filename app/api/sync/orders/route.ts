// @ts-nocheck
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RawOrderItem = {
  line_no?: unknown;
  lineNo?: unknown;
  location?: unknown;
  position?: unknown;
  position_name?: unknown;
  positionName?: unknown;
  location_name?: unknown;
  locationName?: unknown;
  warehouse_position?: unknown;
  warehousePosition?: unknown;
  pos?: unknown;
  weizhi?: unknown;
  "位置"?: unknown;
  "库位"?: unknown;
  "仓位"?: unknown;
  supplier?: unknown;
  supplier_name?: unknown;
  supplierName?: unknown;
  gongyingshang?: unknown;
  item_no?: unknown;
  itemNo?: unknown;
  sku?: unknown;
  sku_no?: unknown;
  skuNo?: unknown;
  code?: unknown;
  product_sku?: unknown;
  productSku?: unknown;
  product_code?: unknown;
  barcode?: unknown;
  bar_code?: unknown;
  barCode?: unknown;
  tiaoxingma?: unknown;
  product_no?: unknown;
  productNo?: unknown;
  product_name?: unknown;
  productName?: unknown;
  name_cn?: unknown;
  name_es?: unknown;
  product_name_cn?: unknown;
  product_name_es?: unknown;
  name?: unknown;
  title?: unknown;
  qty?: unknown;
  quantity?: unknown;
  total_qty?: unknown;
  totalQty?: unknown;
  num?: unknown;
  shuliang?: unknown;
  unit_price?: unknown;
  unitPrice?: unknown;
  price?: unknown;
  danjia?: unknown;
  line_total?: unknown;
  lineTotal?: unknown;
  subtotal?: unknown;
  xiaoji?: unknown;
  amount?: unknown;
  line_amount?: unknown;
  lineAmount?: unknown;
};

type RawOrder = {
  order_key?: unknown;
  orderKey?: unknown;
  order_no?: unknown;
  orderNo?: unknown;
  order_created_at?: unknown;
  orderCreatedAt?: unknown;
  customer_id?: unknown;
  customerId?: unknown;
  customer_name?: unknown;
  customer?: unknown;
  customerName?: unknown;
  company_name?: unknown;
  company?: unknown;
  companyName?: unknown;
  contact_name?: unknown;
  contact?: unknown;
  contactName?: unknown;
  contact_phone?: unknown;
  contactPhone?: unknown;
  address_text?: unknown;
  addressText?: unknown;
  order_remark?: unknown;
  note?: unknown;
  remark?: unknown;
  orderRemark?: unknown;
  store_label?: unknown;
  storeLabel?: unknown;
  header_status_id?: unknown;
  headerStatusId?: unknown;
  header_status?: unknown;
  headerStatus?: unknown;
  latest_status?: unknown;
  latestStatus?: unknown;
  header_amount?: unknown;
  headerAmount?: unknown;
  amount?: unknown;
  jinez?: unknown;
  discounted_amount?: unknown;
  discountedAmount?: unknown;
  order_amount?: unknown;
  orderAmount?: unknown;
  items_count?: unknown;
  itemsCount?: unknown;
  header_updated_at?: unknown;
  headerUpdatedAt?: unknown;
  synced_at?: unknown;
  header?: unknown;
  items?: unknown;
  details?: unknown;
  lines?: unknown;
  rows?: unknown;
  data?: unknown;
  list?: unknown;
  products?: unknown;
  product_list?: unknown;
  pedidolist?: unknown;
  pedidoList?: unknown;
};

type ParsedOrderItem = {
  lineNo: number;
  location: string;
  locationKey: string | null;
  itemNo: string | null;
  barcode: string | null;
  productName: string | null;
  qty: number;
  unitPrice: number | null;
  lineTotal: number | null;
};

type ParsedOrder = {
  orderNo: string;
  orderCreatedAt: Date | null;
  customerId: string | null;
  orderAmount: number | null;
  amountKeyPath: string | null;
  companyName: string | null;
  customerName: string | null;
  contactName: string | null;
  contactPhone: string | null;
  addressText: string | null;
  remarkText: string | null;
  storeLabel: string | null;
  headerStatusId: string | null;
  headerStatus: string | null;
  latestStatus: string | null;
  headerUpdatedAt: Date | null;
  items: ParsedOrderItem[];
};

function pickNonEmptyText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const v = (value || "").trim();
    if (v) return v;
  }
  return null;
}

function sanitizeStatusText(value: string | null | undefined) {
  const raw = (value || "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower === "-" || lower === "—" || lower === "n/a" || lower === "null" || lower === "none") {
    return null;
  }
  return raw;
}

function sanitizeStatusId(value: string | null | undefined) {
  const raw = (value || "").trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower === "-" || lower === "—" || lower === "n/a" || lower === "null" || lower === "none") {
    return null;
  }
  return raw;
}

function normalizeStoredStatusText(value: string | null | undefined) {
  const raw = sanitizeStatusText(value) || sanitizeStatusId(value);
  if (!raw) return null;
  const key = raw.toLowerCase();
  if (key === "1" || key === "new" || key === "new_order" || key === "new order" || raw === "新订单") {
    return "新订单";
  }
  if (key === "2" || key === "packing" || key === "picking" || raw === "配货中") {
    return "配货中";
  }
  return raw;
}

function pickDate(
  left: Date | null | undefined,
  right: Date | null | undefined,
  preferLatest = false,
) {
  if (!left) return right || null;
  if (!right) return left;
  if (!preferLatest) return right;
  return left.getTime() >= right.getTime() ? left : right;
}

function mergeParsedOrder(base: ParsedOrder, incoming: ParsedOrder): ParsedOrder {
  const mergedStatusText = pickNonEmptyText(
    sanitizeStatusText(incoming.headerStatus),
    sanitizeStatusText(incoming.latestStatus),
    sanitizeStatusId(incoming.headerStatusId),
    sanitizeStatusText(base.headerStatus),
    sanitizeStatusText(base.latestStatus),
    sanitizeStatusId(base.headerStatusId),
  );

  return {
    orderNo: base.orderNo,
    orderCreatedAt: pickDate(base.orderCreatedAt, incoming.orderCreatedAt),
    customerId: pickNonEmptyText(incoming.customerId, base.customerId),
    orderAmount: incoming.orderAmount ?? base.orderAmount,
    amountKeyPath: pickNonEmptyText(incoming.amountKeyPath, base.amountKeyPath),
    companyName: pickNonEmptyText(incoming.companyName, base.companyName),
    customerName: pickNonEmptyText(incoming.customerName, base.customerName),
    contactName: pickNonEmptyText(incoming.contactName, base.contactName),
    contactPhone: pickNonEmptyText(incoming.contactPhone, base.contactPhone),
    addressText: pickNonEmptyText(incoming.addressText, base.addressText),
    remarkText: pickNonEmptyText(incoming.remarkText, base.remarkText),
    storeLabel: pickNonEmptyText(incoming.storeLabel, base.storeLabel),
    headerStatusId: pickNonEmptyText(
      sanitizeStatusId(incoming.headerStatusId),
      sanitizeStatusId(base.headerStatusId),
    ),
    headerStatus: mergedStatusText,
    latestStatus: pickNonEmptyText(
      sanitizeStatusText(incoming.latestStatus),
      sanitizeStatusText(base.latestStatus),
    ),
    headerUpdatedAt: pickDate(base.headerUpdatedAt, incoming.headerUpdatedAt, true),
    items: incoming.items.length > 0 ? incoming.items : base.items,
  };
}

function text(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const v = value.trim();
    return v ? v : null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}

function firstNonNull<T>(...values: Array<T | null | undefined>) {
  for (const value of values) {
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value).trim();
  const normalized = raw
    .replace(/[%$¥￥\s]/g, "")
    .replace(/，/g, ",")
    .replace(/(\d),(?=\d{3}(\D|$))/g, "$1");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function intOrZero(value: unknown) {
  const parsed = numberOrNull(value);
  if (parsed === null) return 0;
  return Number.isInteger(parsed) ? parsed : Math.trunc(parsed);
}

function dateOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function readApiKey(request: Request) {
  const direct = request.headers.get("x-api-key")?.trim();
  if (direct) return direct;
  const auth = request.headers.get("authorization")?.trim() || "";
  if (!auth.toLowerCase().startsWith("bearer ")) return "";
  return auth.slice(7).trim();
}

function asOrderList(body: unknown): RawOrder[] {
  if (Array.isArray(body)) return body as RawOrder[];
  if (!body || typeof body !== "object") return [];
  const data = body as Record<string, unknown>;
  if (Array.isArray(data.orders)) return data.orders as RawOrder[];
  if (Array.isArray(data.items)) return data.items as RawOrder[];
  if (Array.isArray(data.rows)) return data.rows as RawOrder[];
  if (Array.isArray(data.data)) return data.data as RawOrder[];
  if (Array.isArray(data.list)) return data.list as RawOrder[];
  if ("order_no" in data || "order_key" in data) return [body as RawOrder];
  return [];
}

function asItemList(input: unknown): RawOrderItem[] {
  if (Array.isArray(input)) return input as RawOrderItem[];
  if (!input || typeof input !== "object") return [];
  const data = input as Record<string, unknown>;
  if (Array.isArray(data.items)) return data.items as RawOrderItem[];
  if (Array.isArray(data.lines)) return data.lines as RawOrderItem[];
  if (Array.isArray(data.details)) return data.details as RawOrderItem[];
  if (Array.isArray(data.rows)) return data.rows as RawOrderItem[];
  if (Array.isArray(data.data)) return data.data as RawOrderItem[];
  if (Array.isArray(data.list)) return data.list as RawOrderItem[];
  if (Array.isArray(data.products)) return data.products as RawOrderItem[];
  if (Array.isArray(data.product_list)) return data.product_list as RawOrderItem[];
  if ("item_no" in data || "sku" in data || "product_code" in data || "barcode" in data) {
    return [data as RawOrderItem];
  }
  return [];
}

function tailThree(orderNo: string) {
  const digits = orderNo.replace(/\D/g, "");
  return (digits.slice(-3) || "000").padStart(3, "0");
}

function findLocationValue(input: RawOrderItem): { value: string; key: string | null } {
  const knownKeys: Array<keyof RawOrderItem> = [
    "location",
    "position",
    "position_name",
    "positionName",
    "location_name",
    "locationName",
    "warehouse_position",
    "warehousePosition",
    "pos",
    "weizhi",
    "位置",
    "库位",
    "仓位",
    "supplier",
    "supplier_name",
    "supplierName",
    "gongyingshang",
  ];
  for (const key of knownKeys) {
    const value = text(input[key]);
    if (value && value !== "-") return { value, key: String(key) };
  }

  const entries = Object.entries(input as Record<string, unknown>);
  for (const [key, raw] of entries) {
    const v = text(raw);
    if (!v || v === "-") continue;
    const k = key.toLowerCase();
    if (
      /location|position|posicion|ubicacion|warehouse|slot|bin|shelf|place|weizhi|supplier|proveedor|gongying|库位|仓位|位置/.test(
        k,
      )
    ) {
      return { value: v, key };
    }
  }
  return { value: "-", key: null };
}

function detectAmountFromPayload(
  root: Record<string, unknown>,
  header: Record<string, unknown> | null,
  pedidolist: Record<string, unknown> | null,
): { value: number | null; keyPath: string | null } {
  const scopes: Array<{ path: string; obj: Record<string, unknown> | null }> = [
    { path: "pedidolist", obj: pedidolist },
    { path: "header", obj: header },
    { path: "root", obj: root },
  ];
  const candidates: Array<{ keyPath: string; score: number; value: number }> = [];
  for (const scope of scopes) {
    if (!scope.obj) continue;
    for (const [key, raw] of Object.entries(scope.obj)) {
      if (raw === null || raw === undefined) continue;
      if (Array.isArray(raw) || typeof raw === "object") continue;
      const amount = numberOrNull(raw);
      if (amount === null) continue;
      const keyText = key.toLowerCase();
      const keyIsAmountLike =
        /jine|amount|total|money|price|sum|pay|fee|折后|实付|应付|金额/.test(keyText) ||
        /jine|amount|total|money|price|sum|pay|fee|折后|实付|应付|金额/.test(key);
      if (!keyIsAmountLike) continue;
      let score = 0;
      if (scope.path === "pedidolist") score += 50;
      if (/jinez|折后|actual|real|net|paid|payable|实付|应付/.test(keyText)) score += 40;
      if (/jine|amount|金额/.test(keyText)) score += 25;
      if (/total|sum|money|price/.test(keyText)) score += 10;
      if (/qty|count|num|line|item|status|id/.test(keyText)) score -= 40;
      candidates.push({ keyPath: `${scope.path}.${key}`, score, value: amount });
    }
  }
  if (candidates.length === 0) return { value: null, keyPath: null };
  candidates.sort((a, b) => b.score - a.score);
  return { value: candidates[0].value, keyPath: candidates[0].keyPath };
}

function detectStatusFromPayload(
  root: Record<string, unknown>,
  header: Record<string, unknown> | null,
  pedidolist: Record<string, unknown> | null,
): { statusText: string | null; statusId: string | null } {
  const scopes: Array<Record<string, unknown> | null> = [pedidolist, header, root];
  const textCandidates: Array<{ score: number; value: string }> = [];
  const idCandidates: Array<{ score: number; value: string }> = [];

  for (const scope of scopes) {
    if (!scope) continue;
    for (const [key, raw] of Object.entries(scope)) {
      const value = text(raw);
      if (!value) continue;
      const cleaned = sanitizeStatusText(value) || sanitizeStatusId(value);
      if (!cleaned) continue;
      const k = key.toLowerCase();
      if (!/(status|state|zhuangtai|鐘舵€?|鐘舵€�)/.test(k)) continue;

      let score = 0;
      if (scope === pedidolist) score += 40;
      else if (scope === header) score += 25;
      else score += 10;

      if (/header[_-]?status|status[_-]?text|state[_-]?text|zhuangtai/.test(k)) score += 20;
      if (/status[_-]?id|state[_-]?id/.test(k)) score += 15;
      if (/latest/.test(k)) score -= 10;

      if (/^\d+$/.test(cleaned)) {
        idCandidates.push({ score, value: cleaned });
      } else {
        textCandidates.push({ score, value: cleaned });
      }
    }
  }

  textCandidates.sort((a, b) => b.score - a.score);
  idCandidates.sort((a, b) => b.score - a.score);

  return {
    statusText: textCandidates[0]?.value || null,
    statusId: idCandidates[0]?.value || null,
  };
}

function parseOrderItem(input: RawOrderItem, index: number): ParsedOrderItem {
  const lineNo = intOrZero(input.line_no ?? input.lineNo) || index + 1;
  const locationPicked = findLocationValue(input);
  const location = locationPicked.value;
  const itemNo =
    text(input.item_no) ||
    text(input.itemNo) ||
    text(input.sku) ||
    text(input.sku_no) ||
    text(input.skuNo) ||
    text(input.code) ||
    text(input.product_sku) ||
    text(input.productSku) ||
    text(input.product_code) ||
    null;
  const barcode =
    text(input.barcode) ||
    text(input.bar_code) ||
    text(input.barCode) ||
    text(input.tiaoxingma) ||
    text(input.product_no) ||
    text(input.productNo) ||
    null;
  const productName =
    text(input.product_name) ||
    text(input.productName) ||
    text(input.name_cn) ||
    text(input.product_name_cn) ||
    text(input.name_es) ||
    text(input.product_name_es) ||
    text(input.name) ||
    text(input.title) ||
    null;
  const qty = intOrZero(
    input.total_qty ?? input.totalQty ?? input.qty ?? input.quantity ?? input.num ?? input.shuliang,
  );
  const unitPrice = numberOrNull(input.unit_price ?? input.unitPrice ?? input.price ?? input.danjia);
  const lineTotal = numberOrNull(
    input.line_total ??
      input.lineTotal ??
      input.subtotal ??
      input.xiaoji ??
      input.amount ??
      input.line_amount ??
      input.lineAmount,
  );
  return {
    lineNo,
    location,
    locationKey: locationPicked.key,
    itemNo,
    barcode,
    productName,
    qty,
    unitPrice,
    lineTotal,
  };
}

function parseOrder(input: RawOrder, index: number): ParsedOrder {
  const asObjectOrNull = (value: unknown) => {
    if (value && typeof value === "object") return value as Record<string, unknown>;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  };

  const root = input as Record<string, unknown>;
  const header = asObjectOrNull(input.header);
  const pedidolist = asObjectOrNull(input.pedidolist) ?? asObjectOrNull(input.pedidoList);
  const detectedStatus = detectStatusFromPayload(root, header, pedidolist);

  const orderNo = firstNonNull(
    text(input.order_no),
    text(input.orderNo),
    text(input.order_key),
    text(input.orderKey),
    text(header?.order_no),
    text(header?.orderNo),
    text(header?.order_key),
    text(header?.orderKey),
  );
  if (!orderNo) throw new Error(`Row ${index + 1}: order_no or order_key is required`);

  const rawItems = asItemList(
    input.items ??
      input.details ??
      input.lines ??
      input.rows ??
      input.data ??
      input.list ??
      input.products ??
      input.product_list ??
      header?.items ??
      header?.details ??
      header?.lines ??
      header?.rows ??
      header?.data ??
      header?.list ??
      header?.products ??
      header?.product_list,
  );
  const items = rawItems.map(parseOrderItem);

  const explicitAmount = numberOrNull(
    firstNonNull(
      input.jinez,
      root.jinez,
      pedidolist?.jinez,
      input.header_amount,
      input.headerAmount,
      input.order_amount,
      input.orderAmount,
      input.amount,
      root.order_total,
      root.total,
      root.total_amount,
      root.totalAmount,
      root.jine,
      header?.header_amount,
      header?.headerAmount,
      header?.order_amount,
      header?.orderAmount,
      header?.amount,
      header?.total,
      header?.total_amount,
      header?.totalAmount,
      header?.jine,
      header?.jinez,
      pedidolist?.amount,
      pedidolist?.total,
      pedidolist?.total_amount,
      pedidolist?.totalAmount,
      pedidolist?.jine,
    ),
  );

  const detectedAmount =
    explicitAmount !== null
      ? { value: explicitAmount, keyPath: "explicit-mapped" as string | null }
      : detectAmountFromPayload(root, header, pedidolist);

  return {
    orderNo,
    orderCreatedAt: firstNonNull(
      dateOrNull(input.order_created_at),
      dateOrNull(input.orderCreatedAt),
      dateOrNull(root.created_at),
      dateOrNull(root.order_date),
      dateOrNull(root.createdAt),
      dateOrNull(root.create_time),
      dateOrNull(root.created_time),
      dateOrNull(root.riqi),
      dateOrNull(pedidolist?.order_created_at),
      dateOrNull(pedidolist?.orderCreatedAt),
      dateOrNull(pedidolist?.created_at),
      dateOrNull(pedidolist?.order_date),
      dateOrNull(pedidolist?.createdAt),
      dateOrNull(pedidolist?.create_time),
      dateOrNull(pedidolist?.created_time),
      dateOrNull(pedidolist?.riqi),
      dateOrNull(header?.order_created_at),
      dateOrNull(header?.orderCreatedAt),
      dateOrNull(header?.created_at),
      dateOrNull(header?.order_date),
      dateOrNull(header?.createdAt),
      dateOrNull(header?.create_time),
      dateOrNull(header?.created_time),
      dateOrNull(header?.riqi),
    ),
    customerId: firstNonNull(
      text(input.customer_id),
      text(input.customerId),
      text(header?.customer_id),
      text(header?.customerId),
    ),
    orderAmount: detectedAmount.value,
    amountKeyPath: detectedAmount.keyPath,
    companyName: firstNonNull(
      text(input.company_name),
      text(input.companyName),
      text(input.company),
      text(root.customer_company),
      text(root.gongsi),
      text(root.kehu),
      text(pedidolist?.company_name),
      text(pedidolist?.companyName),
      text(pedidolist?.company),
      text(pedidolist?.customer_company),
      text(pedidolist?.gongsi),
      text(pedidolist?.kehu),
      text(header?.company_name),
      text(header?.companyName),
      text(header?.company),
      text(header?.customer_company),
      text(header?.gongsi),
      text(header?.kehu),
    ),
    customerName: firstNonNull(
      text(input.customer_name),
      text(input.customerName),
      text(input.customer),
      text(pedidolist?.customer_name),
      text(pedidolist?.customerName),
      text(pedidolist?.customer),
      text(header?.customer_name),
      text(header?.customerName),
      text(header?.customer),
    ),
    contactName: firstNonNull(
      text(input.contact_name),
      text(input.contactName),
      text(input.contact),
      text(root.contact_person),
      text(root.linkman),
      text(root.lianxiren),
      text(pedidolist?.contact_name),
      text(pedidolist?.contactName),
      text(pedidolist?.contact),
      text(pedidolist?.contact_person),
      text(pedidolist?.linkman),
      text(pedidolist?.lianxiren),
      text(header?.contact_name),
      text(header?.contactName),
      text(header?.contact),
      text(header?.contact_person),
      text(header?.linkman),
      text(header?.lianxiren),
    ),
    contactPhone: firstNonNull(
      text(input.contact_phone),
      text(input.contactPhone),
      text(root.contact_tel),
      text(root.contact_mobile),
      text(root.customer_phone),
      text(root.customer_mobile),
      text(root.phone),
      text(root.mobile),
      text(root.telephone),
      text(root.tel),
      text(root.lianxidianhua),
      text(pedidolist?.contact_phone),
      text(pedidolist?.contactPhone),
      text(pedidolist?.contact_tel),
      text(pedidolist?.contact_mobile),
      text(pedidolist?.customer_phone),
      text(pedidolist?.customer_mobile),
      text(pedidolist?.phone),
      text(pedidolist?.mobile),
      text(pedidolist?.telephone),
      text(pedidolist?.tel),
      text(pedidolist?.lianxidianhua),
      text(header?.contact_phone),
      text(header?.contactPhone),
      text(header?.contact_tel),
      text(header?.contact_mobile),
      text(header?.customer_phone),
      text(header?.customer_mobile),
      text(header?.phone),
      text(header?.mobile),
      text(header?.telephone),
      text(header?.tel),
      text(header?.lianxidianhua),
    ),
    addressText: firstNonNull(
      text(input.address_text),
      text(input.addressText),
      text(pedidolist?.address_text),
      text(pedidolist?.addressText),
      text(header?.address_text),
      text(header?.addressText),
    ),
    remarkText: firstNonNull(
      text(input.order_remark),
      text(input.orderRemark),
      text(input.note),
      text(input.remark),
      text(root.memo),
      text(root.beizhu),
      text(pedidolist?.order_remark),
      text(pedidolist?.orderRemark),
      text(pedidolist?.note),
      text(pedidolist?.remark),
      text(pedidolist?.memo),
      text(pedidolist?.beizhu),
      text(header?.order_remark),
      text(header?.orderRemark),
      text(header?.note),
      text(header?.remark),
      text(header?.memo),
      text(header?.beizhu),
    ),
    storeLabel: firstNonNull(
      text(input.store_label),
      text(input.storeLabel),
      text(pedidolist?.store_label),
      text(pedidolist?.storeLabel),
      text(header?.store_label),
      text(header?.storeLabel),
    ),
    headerStatusId: firstNonNull(
      sanitizeStatusId(text(input.header_status_id)),
      sanitizeStatusId(text(input.headerStatusId)),
      sanitizeStatusId(text(root.status_id)),
      sanitizeStatusId(text(root.statusId)),
      sanitizeStatusId(text(pedidolist?.header_status_id)),
      sanitizeStatusId(text(pedidolist?.headerStatusId)),
      sanitizeStatusId(text(pedidolist?.status_id)),
      sanitizeStatusId(text(pedidolist?.statusId)),
      sanitizeStatusId(text(header?.header_status_id)),
      sanitizeStatusId(text(header?.headerStatusId)),
      sanitizeStatusId(text(header?.status_id)),
      sanitizeStatusId(text(header?.statusId)),
      sanitizeStatusId(detectedStatus.statusId),
    ),
    headerStatus: firstNonNull(
      sanitizeStatusText(text(input.header_status)),
      sanitizeStatusText(text(input.headerStatus)),
      sanitizeStatusText(text(root.status)),
      sanitizeStatusText(text(root.zhuangtai)),
      sanitizeStatusText(text(root.status_text)),
      sanitizeStatusText(text(root.header_status_text)),
      sanitizeStatusText(text(pedidolist?.header_status)),
      sanitizeStatusText(text(pedidolist?.headerStatus)),
      sanitizeStatusText(text(pedidolist?.status)),
      sanitizeStatusText(text(pedidolist?.zhuangtai)),
      sanitizeStatusText(text(pedidolist?.status_text)),
      sanitizeStatusText(text(pedidolist?.header_status_text)),
      sanitizeStatusText(text(header?.header_status)),
      sanitizeStatusText(text(header?.headerStatus)),
      sanitizeStatusText(text(header?.status)),
      sanitizeStatusText(text(header?.zhuangtai)),
      sanitizeStatusText(text(header?.status_text)),
      sanitizeStatusText(text(header?.header_status_text)),
      sanitizeStatusText(detectedStatus.statusText),
    ),
    latestStatus: firstNonNull(
      sanitizeStatusText(text(input.latest_status)),
      sanitizeStatusText(text(input.latestStatus)),
      sanitizeStatusText(text(pedidolist?.latest_status)),
      sanitizeStatusText(text(pedidolist?.latestStatus)),
      sanitizeStatusText(text(header?.latest_status)),
      sanitizeStatusText(text(header?.latestStatus)),
    ),
    headerUpdatedAt: dateOrNull(
      input.header_updated_at ??
        input.headerUpdatedAt ??
        input.synced_at ??
        header?.header_updated_at ??
        header?.headerUpdatedAt,
    ),
    items,
  };
}

async function columnExists(name: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'yg_order_imports' AND column_name = $1
    `,
    name,
  );
  return rows.length > 0;
}

async function ensurePreviewStatusColumns() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE yg_order_imports
    ADD COLUMN IF NOT EXISTS header_status_id text,
    ADD COLUMN IF NOT EXISTS header_status text,
    ADD COLUMN IF NOT EXISTS latest_status text,
    ADD COLUMN IF NOT EXISTS header_updated_at timestamptz,
    ADD COLUMN IF NOT EXISTS order_created_at timestamptz,
    ADD COLUMN IF NOT EXISTS order_key text,
    ADD COLUMN IF NOT EXISTS customer_id text
  `);
}

export async function POST(request: Request) {
  const expectedApiKey = process.env.YOGO_SYNC_API_KEY?.trim() || "";
  const tenantId = process.env.YOGO_SYNC_TENANT_ID?.trim() || "";
  const companyId = process.env.YOGO_SYNC_COMPANY_ID?.trim() || "";

  if (!expectedApiKey) {
    return NextResponse.json(
      { ok: false, error: "YOGO_SYNC_API_KEY is not configured" },
      { status: 500 },
    );
  }
  if (!UUID_RE.test(tenantId) || !UUID_RE.test(companyId)) {
    return NextResponse.json(
      { ok: false, error: "YOGO_SYNC_TENANT_ID / YOGO_SYNC_COMPANY_ID is invalid" },
      { status: 500 },
    );
  }

  const apiKey = readApiKey(request);
  if (!apiKey || apiKey !== expectedApiKey) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as unknown;
    const rawOrders = asOrderList(body);
    if (rawOrders.length === 0) {
      throw new Error("Payload must be an order object or an array of orders");
    }

    const parsedOrders = rawOrders.map(parseOrder);
    const deduped = new Map<string, ParsedOrder>();
    for (const order of parsedOrders) {
      const previous = deduped.get(order.orderNo);
      if (!previous) {
        deduped.set(order.orderNo, order);
      } else {
        deduped.set(order.orderNo, mergeParsedOrder(previous, order));
      }
    }
    const orders = Array.from(deduped.values());

    await ensurePreviewStatusColumns();

    const hasHeaderStatus = await columnExists("header_status");
    const hasHeaderStatusId = await columnExists("header_status_id");
    const hasLatestStatus = await columnExists("latest_status");
    const hasHeaderUpdatedAt = await columnExists("header_updated_at");
    const hasOrderCreatedAt = await columnExists("order_created_at");
    const hasOrderKey = await columnExists("order_key");
    const hasCustomerId = await columnExists("customer_id");
    const syncStatusAt = new Date();
    const incomingOrderNos = orders.map((order) => order.orderNo);

    if (incomingOrderNos.length > 0 && (hasHeaderStatus || hasLatestStatus || hasHeaderUpdatedAt)) {
      const staleSets: string[] = [];
      const staleParams: unknown[] = [tenantId, companyId, incomingOrderNos];

      if (hasHeaderStatus) {
        staleParams.push("配货中");
        staleSets.push(`header_status = $${staleParams.length}`);
      }
      if (hasLatestStatus) {
        staleParams.push("配货中");
        staleSets.push(`latest_status = $${staleParams.length}`);
      }
      if (hasHeaderUpdatedAt) {
        staleParams.push(syncStatusAt);
        staleSets.push(`header_updated_at = $${staleParams.length}`);
      }

      if (staleSets.length > 0) {
        await prisma.$executeRawUnsafe(
          `
            UPDATE yg_order_imports
            SET ${staleSets.join(", ")}
            WHERE tenant_id = $1::uuid
              AND company_id = $2::uuid
              AND NOT (order_no = ANY($3::text[]))
          `,
          ...staleParams,
        );
      }
    }

    const detectedLocationKeys = new Set<string>();
    const detectedAmountKeys = new Set<string>();
    for (const order of orders) {
      for (const item of order.items) {
        if (item.locationKey) detectedLocationKeys.add(item.locationKey);
      }
      if (order.amountKeyPath) detectedAmountKeys.add(order.amountKeyPath);
      const createCompanyName = order.companyName || order.customerName;
      const createCustomerName = order.customerName || order.companyName;
      const createContactName = order.contactName || order.customerName || order.companyName;
      const summedLineTotal = order.items.reduce((sum, item) => {
        const line = item.lineTotal ?? 0;
        return sum + line;
      }, 0);
      const resolvedAmount =
        order.orderAmount !== null
          ? order.orderAmount
          : summedLineTotal > 0
            ? summedLineTotal
            : null;
      const upserted = await prisma.ygOrderImport.upsert({
        where: {
          tenant_id_company_id_order_no: {
            tenant_id: tenantId,
            company_id: companyId,
            order_no: order.orderNo,
          },
        },
        create: {
          tenant_id: tenantId,
          company_id: companyId,
          order_no: order.orderNo,
          source_file_name: "yogo-sync-orders",
          sheet_name: "sync",
          order_amount: resolvedAmount,
          last_three: tailThree(order.orderNo),
          company_name: createCompanyName,
          customer_name: createCustomerName,
          contact_name: createContactName,
          contact_phone: order.contactPhone,
          address_text: order.addressText,
          order_remark: order.remarkText,
          store_label: order.storeLabel,
          supplier_count: new Set(
            order.items
              .map((item) => (item.location || "").trim().toUpperCase())
              .filter(Boolean),
          ).size,
          item_count: order.items.length,
          created_by: "yogo-sync",
        },
        update: {
          ...(resolvedAmount !== null ? { order_amount: resolvedAmount } : {}),
          ...(order.companyName ? { company_name: order.companyName } : {}),
          ...(order.customerName ? { customer_name: order.customerName } : {}),
          ...(order.contactName ? { contact_name: order.contactName } : {}),
          ...(order.contactPhone ? { contact_phone: order.contactPhone } : {}),
          ...(order.addressText ? { address_text: order.addressText } : {}),
          ...(order.remarkText ? { order_remark: order.remarkText } : {}),
          ...(order.storeLabel ? { store_label: order.storeLabel } : {}),
          ...(order.items.length > 0
            ? {
                supplier_count: new Set(
                  order.items
                    .map((item) => (item.location || "").trim().toUpperCase())
                    .filter(Boolean),
                ).size,
                item_count: order.items.length,
              }
            : {}),
        },
        select: { id: true },
      });

      if (
        hasHeaderStatus ||
        hasHeaderStatusId ||
        hasLatestStatus ||
        hasHeaderUpdatedAt ||
        hasOrderCreatedAt ||
        hasOrderKey ||
        hasCustomerId
      ) {
        const sets: string[] = [];
        const params: unknown[] = [upserted.id];
        const resolvedStatusText =
          normalizeStoredStatusText(order.headerStatus) ||
          normalizeStoredStatusText(order.latestStatus) ||
          normalizeStoredStatusText(order.headerStatusId) ||
          "新订单";
        if (hasHeaderStatus && resolvedStatusText) {
          params.push(resolvedStatusText);
          sets.push(`header_status = $${params.length}`);
        }
        if (hasHeaderStatusId && order.headerStatusId) {
          params.push(order.headerStatusId);
          sets.push(`header_status_id = $${params.length}`);
        }
        if (hasLatestStatus && resolvedStatusText) {
          params.push(normalizeStoredStatusText(order.latestStatus) || resolvedStatusText);
          sets.push(`latest_status = $${params.length}`);
        }
        if (hasHeaderUpdatedAt) {
          params.push(order.headerUpdatedAt || syncStatusAt);
          sets.push(`header_updated_at = $${params.length}`);
        }
        if (hasOrderCreatedAt && order.orderCreatedAt) {
          params.push(order.orderCreatedAt);
          sets.push(`order_created_at = $${params.length}`);
        }
        if (hasOrderKey) {
          params.push(order.orderNo);
          sets.push(`order_key = $${params.length}`);
        }
        if (hasCustomerId && order.customerId) {
          params.push(order.customerId);
          sets.push(`customer_id = $${params.length}`);
        }
        if (sets.length > 0) {
          await prisma.$executeRawUnsafe(
            `UPDATE yg_order_imports SET ${sets.join(", ")} WHERE id = $1::uuid`,
            ...params,
          );
        }
      }

      await prisma.ygSupplierOrder.deleteMany({
        where: {
          tenant_id: tenantId,
          company_id: companyId,
          import_id: upserted.id,
        },
      });

      if (order.items.length > 0) {
        const supplierGroups = new Map<string, ParsedOrderItem[]>();
        for (const item of order.items) {
          const supplier = (item.location || "").trim().toUpperCase() || "UNKNOWN";
          const group = supplierGroups.get(supplier) || [];
          group.push(item);
          supplierGroups.set(supplier, group);
        }

        for (const [supplierCode, items] of supplierGroups.entries()) {
          const groupLineTotal = items.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0);
          const groupAmount = groupLineTotal > 0 ? groupLineTotal : null;

          await prisma.ygSupplierOrder.create({
            data: {
              tenant_id: tenantId,
              company_id: companyId,
              import_id: upserted.id,
              order_no: order.orderNo,
              supplier_code: supplierCode,
              derived_order_no: `${order.orderNo}-${supplierCode}`,
              order_amount: groupAmount,
              note_text: order.remarkText,
              item_count: items.length,
              items: {
                create: items.map((item) => ({
                  tenant_id: tenantId,
                  company_id: companyId,
                  line_no: item.lineNo,
                  location: item.location,
                  item_no: item.itemNo,
                  barcode: item.barcode,
                  product_name: item.productName,
                  total_qty: item.qty,
                  unit_price: item.unitPrice,
                  line_total: item.lineTotal,
                })),
              },
            },
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      requestId: randomUUID(),
      summary: {
        totalCount: orders.length,
        detectedLocationKeys: Array.from(detectedLocationKeys),
        detectedAmountKeys: Array.from(detectedAmountKeys),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Sync failed" },
      { status: 400 },
    );
  }
}
