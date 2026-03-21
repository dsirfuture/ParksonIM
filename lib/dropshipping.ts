// @ts-nocheck
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import type { Session } from "@/lib/tenant";
import type {
  DsAlertItem,
  DsExchangeRatePayload,
  DsFinanceRow,
  DsFinanceStatus,
  DsOverviewAnalytics,
  DsOverviewCustomerRankItem,
  DsOverviewDailyPoint,
  DsOverviewPlatformRankItem,
  DsOverviewProductRankItem,
  DsLegacyImportAsset,
  DsInventoryRow,
  DsLegacyImportRow,
  DsLegacyImportSummary,
  DsOrderAttachment,
  DsInventoryStatus,
  DsOrderRow,
  DsOverviewOrder,
  DsOverviewStats,
  DsShippingStatus,
} from "@/lib/dropshipping-types";
import { buildProductImageUrl } from "@/lib/product-image-url";
import { normalizeProductCode } from "@/lib/product-code";
import { uploadR2Object } from "@/lib/r2-upload";

const DEFAULT_RATE_VALUE = 0.08;
const LOW_STOCK_THRESHOLD = 5;
const WISE_MXN_TO_CNY_URL = "https://wise.com/zh-cn/currency-converter/mxn-to-cny-rate";
const WISE_RATE_SOURCE_NAME = "wise.com";
const WISE_RATE_TTL_MS = 1000 * 60 * 60;
const orderAttachmentStore = prisma as typeof prisma & {
  dropshippingOrderAttachment: {
    deleteMany(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<{
      id: string;
      type: "label" | "proof";
      file_name: string;
      file_url: string;
      source_path: string | null;
      mime_type: string | null;
      sort_order: number;
    }>;
    findMany(args: unknown): Promise<
      Array<{
        id: string;
        order_id: string;
        type: "label" | "proof";
        file_name: string;
        file_url: string;
        source_path: string | null;
        mime_type: string | null;
        sort_order: number;
      }>
    >;
  };
};

function startOfTodayInMexico() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const iso = `${map.year}-${map.month}-${map.day}T00:00:00.000-06:00`;
  return new Date(iso);
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  ) {
    try {
      const parsed = (value as { toNumber: () => number }).toNumber();
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

function stripTrailingUnitPrice(name: string | null | undefined) {
  const text = String(name || "").trim();
  if (!text) return "";
  return text
    .replace(/\s+\$?\d[\d,]*(?:\.\d{1,2})?\s*$/u, "")
    .trim();
}

function legacyGroupKeyOf(row: Pick<DsLegacyImportRow, "customerName" | "platform" | "platformOrderNo">) {
  return [
    String(row.customerName || "").trim().toLowerCase(),
    String(row.platform || "").trim().toLowerCase(),
    String(row.platformOrderNo || "").trim().toLowerCase(),
  ].join("::");
}

async function fetchWiseMxnToCnyRate() {
  const response = await fetch(WISE_MXN_TO_CNY_URL, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      "cache-control": "no-cache",
      pragma: "no-cache",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`wise_fetch_failed_${response.status}`);
  }

  const html = await response.text();
  const match = html.match(/(?:Mex\$|MX\$)?1\s*MXN\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*CNY/i);
  const rateValue = match ? Number(match[1]) : 0;

  if (!Number.isFinite(rateValue) || rateValue <= 0) {
    throw new Error("wise_rate_parse_failed");
  }

  return {
    rateValue,
    sourceName: WISE_RATE_SOURCE_NAME,
    fetchedAt: new Date(),
  };
}

async function ensureOrderUniqueness(
  session: Session,
  payload: {
    id?: string;
    platformOrderNo: string;
    trackingNo?: string;
  },
) {
  const normalizedOrderNo = String(payload.platformOrderNo || "").trim();
  const normalizedTrackingNo = String(payload.trackingNo || "").trim();

  if (!normalizedOrderNo && !normalizedTrackingNo) return;

  const excludeId = String(payload.id || "").trim();
  const baseWhere = {
    tenant_id: session.tenantId,
    company_id: session.companyId,
    ...(excludeId ? { id: { not: excludeId } } : {}),
  };

  if (normalizedOrderNo) {
    const duplicateOrder = await prisma.dropshippingOrder.findFirst({
      where: {
        ...baseWhere,
        platform_order_no: normalizedOrderNo,
      },
      select: { id: true },
    });
    if (duplicateOrder) {
      throw new Error("duplicate_platform_order_no");
    }
  }

  if (normalizedTrackingNo) {
    const duplicateTracking = await prisma.dropshippingOrder.findFirst({
      where: {
        ...baseWhere,
        tracking_no: normalizedTrackingNo,
      },
      select: { id: true },
    });
    if (duplicateTracking) {
      throw new Error("duplicate_tracking_no");
    }
  }
}

function toOptionalNumber(value: unknown) {
  const num = toNumber(value);
  return num === 0 && (value === null || value === undefined || value === "") ? null : num;
}

function startOfMexicoDay(value: Date | null | undefined) {
  const target = value || new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(target);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(`${map.year}-${map.month}-${map.day}T00:00:00.000-06:00`);
}

function endOfMexicoDay(value: Date | null | undefined) {
  const start = startOfMexicoDay(value);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

function startOfMexicoMonth(value: Date | null | undefined) {
  const start = startOfMexicoDay(value);
  return new Date(`${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-01T00:00:00.000-06:00`);
}

function endOfMexicoMonth(value: Date | null | undefined) {
  const start = startOfMexicoMonth(value);
  return new Date(start.getUTCFullYear(), start.getUTCMonth() + 1, 1, 6, 0, 0, 0);
}

function formatMexicoMonthLabel(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "long",
  }).format(value);
}

function formatMexicoDayLabel(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    day: "2-digit",
  }).format(value);
}

async function ensureRateByDate(
  session: Session,
  input: { date: Date | null; value: number | null; sourceName?: string },
) {
  const rateDate = startOfMexicoDay(input.date);
  const existing = await prisma.dropshippingExchangeRate.findFirst({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      rate_date: rateDate,
      base_currency: "RMB",
      target_currency: "MXN",
    },
    orderBy: { created_at: "desc" },
  });

  if (existing) {
    if (input.value && toNumber(existing.rate_value) !== input.value) {
      return prisma.dropshippingExchangeRate.update({
        where: { id: existing.id },
        data: {
          rate_value: input.value,
          source_name: input.sourceName || existing.source_name,
          fetched_at: new Date(),
        },
      });
    }
    return existing;
  }

  return prisma.dropshippingExchangeRate.create({
    data: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      rate_date: rateDate,
      base_currency: "RMB",
      target_currency: "MXN",
      rate_value: input.value ?? DEFAULT_RATE_VALUE,
      source_name: input.sourceName || "legacy-import",
      fetched_at: new Date(),
      is_manual: true,
      fetch_failed: false,
    },
  });
}

export function computeStockAmount(unitPrice: number, stockedQty: number, discountRate: number) {
  const normalizedDiscountRate = Math.abs(discountRate) <= 1 ? discountRate : discountRate / 100;
  const safeDiscountRate = Math.min(Math.max(normalizedDiscountRate, 0), 1);
  return unitPrice * stockedQty * (1 - safeDiscountRate);
}

export function deriveInventoryStatus(remainingQty: number): DsInventoryStatus {
  if (remainingQty <= 0) return "empty";
  if (remainingQty < LOW_STOCK_THRESHOLD) return "low";
  return "healthy";
}

export function deriveFinanceStatus(totalAmount: number, paidAmount: number): DsFinanceStatus {
  const unpaid = totalAmount - paidAmount;
  if (unpaid <= 0) return "paid";
  if (paidAmount > 0) return "partial";
  return "unpaid";
}

export function getOrderWarnings(input: {
  duplicate: boolean;
  shippingStatus: DsShippingStatus;
  quantity: number;
  trackingNo: string;
  shippedAt: Date | null;
  shippingProofFile: string;
  inventoryQty: number | null;
}) {
  const warnings: string[] = [];
  if (input.duplicate) warnings.push("duplicate_order");
  if (input.quantity <= 0) warnings.push("invalid_quantity");
  if (input.shippingStatus === "shipped" && !input.shippedAt) warnings.push("missing_ship_date");
  if (input.shippingStatus === "shipped" && !input.shippingProofFile) warnings.push("missing_shipping_proof");
  if (input.shippingStatus === "pending" && input.trackingNo) warnings.push("tracking_without_status");
  if (input.inventoryQty !== null && input.inventoryQty < input.quantity) warnings.push("inventory_shortage");
  return warnings;
}

function sanitizeOrderNotes(notes: string | null | undefined) {
  const normalized = String(notes || "").trim();
  if (!normalized) return "";
  return normalized
    .split("|")
    .map((item) => item.trim())
    .filter((item) => item && !/^label:/i.test(item) && !/^proof:/i.test(item))
    .join(" | ");
}

export async function ensureTodayExchangeRate(session: Session) {
  const today = startOfTodayInMexico();
  const existing = await prisma.dropshippingExchangeRate.findFirst({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      rate_date: today,
      base_currency: "RMB",
      target_currency: "MXN",
    },
    orderBy: { created_at: "desc" },
  });

  const now = new Date();
  const isFreshWiseRate =
    !!existing &&
    existing.source_name === WISE_RATE_SOURCE_NAME &&
    !existing.fetch_failed &&
    !!existing.fetched_at &&
    now.getTime() - existing.fetched_at.getTime() < WISE_RATE_TTL_MS;

  if (isFreshWiseRate) return existing;

  if (existing?.is_manual && existing.source_name && existing.source_name !== "system-default") {
    return existing;
  }

  try {
    const wiseRate = await fetchWiseMxnToCnyRate();

    if (existing) {
      return prisma.dropshippingExchangeRate.update({
        where: { id: existing.id },
        data: {
          rate_value: wiseRate.rateValue,
          source_name: wiseRate.sourceName,
          fetched_at: wiseRate.fetchedAt,
          is_manual: false,
          fetch_failed: false,
          failure_reason: null,
        },
      });
    }

    return prisma.dropshippingExchangeRate.create({
      data: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        rate_date: today,
        base_currency: "RMB",
        target_currency: "MXN",
        rate_value: wiseRate.rateValue,
        source_name: wiseRate.sourceName,
        fetched_at: wiseRate.fetchedAt,
        is_manual: false,
        fetch_failed: false,
      },
    });
  } catch (error) {
    const failureReason = error instanceof Error ? error.message : "wise_rate_fetch_failed";

    if (existing) {
      return prisma.dropshippingExchangeRate.update({
        where: { id: existing.id },
        data: {
          source_name: existing.source_name || "system-default",
          fetched_at: existing.fetched_at || now,
          fetch_failed: true,
          failure_reason: failureReason,
        },
      });
    }

    return prisma.dropshippingExchangeRate.create({
      data: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        rate_date: today,
        base_currency: "RMB",
        target_currency: "MXN",
        rate_value: DEFAULT_RATE_VALUE,
        source_name: "system-default",
        fetched_at: now,
        is_manual: false,
        fetch_failed: true,
        failure_reason: failureReason,
      },
    });
  }
}

async function ensureCustomer(session: Session, customerName: string) {
  const normalized = customerName.trim();
  let customer = await prisma.dropshippingCustomer.findFirst({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      name: normalized,
    },
  });

  if (!customer) {
    customer = await prisma.dropshippingCustomer.create({
      data: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        name: normalized,
      },
    });
  }

  return customer;
}

async function ensureProduct(
  session: Session,
  input: {
    sku: string;
    nameZh: string;
    nameEs?: string;
    shippingFee?: number;
    warehouse?: string;
  },
) {
  const rawSku = String(input.sku || "").trim();
  const normalizedSku = normalizeProductCode(rawSku);
  let product = await prisma.dropshippingProduct.findFirst({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      sku: { equals: rawSku, mode: "insensitive" as const },
    },
  });

  if (!product) {
    const catalog = await prisma.productCatalog.findFirst({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        sku: { equals: normalizedSku, mode: "insensitive" as const },
      },
      select: {
        sku: true,
        name_zh: true,
        name_es: true,
        price: true,
        normal_discount: true,
      },
    });

    product = await prisma.dropshippingProduct.create({
      data: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        sku: rawSku || catalog?.sku || normalizedSku,
        name_zh: input.nameZh.trim() || catalog?.name_zh || rawSku || normalizedSku,
        name_es: input.nameEs?.trim() || catalog?.name_es || null,
        unit_price: toOptionalNumber(catalog?.price),
        discount_rate: toOptionalNumber(catalog?.normal_discount),
        default_shipping_fee: input.shippingFee ?? null,
        default_warehouse: input.warehouse?.trim() || null,
      },
    });
  }

  const nextData: Record<string, unknown> = {};
  if (rawSku && product.sku !== rawSku) nextData.sku = rawSku;
  if (input.nameZh.trim() && product.name_zh !== input.nameZh.trim()) nextData.name_zh = input.nameZh.trim();
  if (input.nameEs?.trim() && product.name_es !== input.nameEs.trim()) nextData.name_es = input.nameEs.trim();
  if (input.shippingFee !== undefined && input.shippingFee !== null) nextData.default_shipping_fee = input.shippingFee;
  if (input.warehouse?.trim()) nextData.default_warehouse = input.warehouse.trim();
  if (Object.keys(nextData).length > 0) {
    product = await prisma.dropshippingProduct.update({
      where: { id: product.id },
      data: nextData,
    });
  }

  return product;
}

async function ensureInventoryRecord(
  session: Session,
  input: {
    customerId: string;
    productId: string;
    warehouse?: string;
  },
) {
  const existing = await prisma.dropshippingCustomerInventory.findFirst({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      customer_id: input.customerId,
      product_id: input.productId,
    },
  });

  if (existing) return existing;

  return prisma.dropshippingCustomerInventory.create({
    data: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      customer_id: input.customerId,
      product_id: input.productId,
      stocked_qty: 0,
      warehouse: input.warehouse?.trim() || null,
    },
  });
}

function sanitizeStoragePart(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function extname(fileName: string) {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

function isAttachmentFormula(value: string) {
  const normalized = value.trim();
  return normalized.startsWith("=") || normalized.toUpperCase().includes("DISPIMG(");
}

function inferMimeType(fileName: string, fallback?: string) {
  if (fallback) return fallback;
  const ext = extname(fileName);
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

async function syncOrderAttachments(input: {
  session: Session;
  orderId: string;
  orderKey: string;
  assets: DsLegacyImportAsset[];
  type: "label" | "proof";
}) {
  if (input.assets.length === 0) {
    await orderAttachmentStore.dropshippingOrderAttachment.deleteMany({
      where: {
        tenant_id: input.session.tenantId,
        company_id: input.session.companyId,
        order_id: input.orderId,
        type: input.type,
      },
    });
    return [];
  }

  const prefix = input.type === "label" ? "dropshipping/labels" : "dropshipping/proofs";
  const uploaded: Array<{
    id?: string;
    file_name: string;
    file_url: string;
    source_path: string;
    mime_type: string;
    file_size: number;
    sort_order: number;
  }> = [];

  for (let index = 0; index < input.assets.length; index += 1) {
    const asset = input.assets[index];
    if (!asset.bytes || asset.bytes.length === 0) continue;

    const fileName = asset.displayName.trim() || `file-${index + 1}${extname(asset.relativePath) || ""}`;
    const safeKey = `${prefix}/${input.orderKey}/${index + 1}-${sanitizeStoragePart(fileName) || `file-${index + 1}`}`;
    const uploadedFile = await uploadR2Object({
      key: safeKey,
      body: asset.bytes,
      contentType: inferMimeType(fileName, asset.mimeType),
    });

    uploaded.push({
      file_name: fileName,
      file_url: uploadedFile.url,
      source_path: asset.relativePath,
      mime_type: inferMimeType(fileName, asset.mimeType),
      file_size: asset.bytes.length,
      sort_order: index,
    });
  }

  await orderAttachmentStore.dropshippingOrderAttachment.deleteMany({
    where: {
      tenant_id: input.session.tenantId,
      company_id: input.session.companyId,
      order_id: input.orderId,
      type: input.type,
    },
  });

  if (uploaded.length === 0) return [];

  const created = [];
  for (const item of uploaded) {
    created.push(
      await orderAttachmentStore.dropshippingOrderAttachment.create({
        data: {
          tenant_id: input.session.tenantId,
          company_id: input.session.companyId,
          order_id: input.orderId,
          type: input.type,
          ...item,
        },
      }),
    );
  }
  return created;
}

export async function replaceOrderAttachments(
  session: Session,
  input: {
    orderId: string;
    type: "label" | "proof";
    assets: Array<{
      displayName: string;
      bytes: Uint8Array;
      mimeType?: string;
    }>;
  },
) {
  const order = await prisma.dropshippingOrder.findFirst({
    where: {
      id: input.orderId,
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    include: {
      product: true,
      customer: true,
    },
  });

  if (!order) {
    throw new Error("order_not_found");
  }

  const orderKey = [
    sanitizeStoragePart(order.customer.name || ""),
    sanitizeStoragePart(order.platform_order_no || ""),
    sanitizeStoragePart(order.tracking_no || ""),
    sanitizeStoragePart(order.product.sku || ""),
    order.id,
  ]
    .filter(Boolean)
    .join("/");

  return syncOrderAttachments({
    session,
    orderId: order.id,
    orderKey,
    type: input.type,
    assets: input.assets.map((asset, index) => ({
      displayName: asset.displayName,
      relativePath: `${input.type}/${index + 1}-${asset.displayName}`,
      bytes: asset.bytes,
      mimeType: asset.mimeType,
    })),
  });
}

export async function saveOrder(
  session: Session,
  payload: {
    id?: string;
    customerName: string;
    platform: string;
    platformOrderNo: string;
    trackingGroupId?: string | null;
    sku: string;
    productNameZh: string;
    productNameEs?: string;
    quantity: number;
    trackingNo?: string;
    color?: string;
    warehouse?: string;
    shippedAt?: string | null;
    shippingFee?: number;
    settlementStatus?: "unpaid" | "paid";
    shippingStatus: DsShippingStatus;
    notes?: string;
  },
) {
  await ensureOrderUniqueness(session, {
    id: payload.id,
    platformOrderNo: payload.platformOrderNo,
    trackingNo: payload.trackingNo,
  });

  const customer = await ensureCustomer(session, payload.customerName);
  const product = await ensureProduct(session, {
    sku: payload.sku,
    nameZh: payload.productNameZh,
    nameEs: payload.productNameEs,
    shippingFee: payload.shippingFee,
    warehouse: payload.warehouse,
  });
  const rate = await ensureTodayExchangeRate(session);
  await ensureInventoryRecord(session, {
    customerId: customer.id,
    productId: product.id,
    warehouse: payload.warehouse,
  });

  const rawDiscountRate = toNumber(product.discount_rate);
  const normalizedDiscountRate = Math.abs(rawDiscountRate) <= 1 ? rawDiscountRate : rawDiscountRate / 100;
  const safeDiscountRate = Math.min(Math.max(normalizedDiscountRate, 0), 1);
  const stockAmount = toNumber(product.unit_price) * payload.quantity * (1 - safeDiscountRate);
  const shippingFee = payload.shippingFee ?? toNumber(product.default_shipping_fee) ?? 0;
  const totalAmount = stockAmount + shippingFee;
  const settlementStatus = payload.settlementStatus === "paid" ? "paid" : "unpaid";
  const settledAt = settlementStatus === "paid" ? new Date() : null;
  const paidAmount = settlementStatus === "paid" ? totalAmount : 0;
  const unpaidAmount = settlementStatus === "paid" ? 0 : totalAmount;

  const data = {
    customer_id: customer.id,
    product_id: product.id,
    platform: payload.platform.trim() || "无",
    platform_order_no: payload.platformOrderNo.trim(),
    tracking_group_id:
      payload.trackingGroupId === undefined
        ? undefined
        : payload.trackingGroupId?.trim() || null,
    tracking_no: payload.trackingNo?.trim() || null,
    quantity: payload.quantity,
    color: payload.color?.trim() || null,
    warehouse: payload.warehouse?.trim() || product.default_warehouse || null,
    shipped_at: payload.shippedAt ? new Date(payload.shippedAt) : null,
    shipping_fee: shippingFee || null,
    shipping_status: payload.shippingStatus,
    snapshot_stock_amount: stockAmount,
    snapshot_total_amount: totalAmount,
    snapshot_paid_amount: paidAmount,
    snapshot_unpaid_amount: unpaidAmount,
    settled_at: settledAt,
    notes: payload.notes?.trim() || null,
    exchange_rate_id: rate.id,
  };

  if (payload.id) {
    return prisma.dropshippingOrder.update({
      where: { id: payload.id },
      data,
    });
  }

  return prisma.dropshippingOrder.create({
    data: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      ...data,
    },
  });
}

export async function importLegacyOrders(
  session: Session,
  rows: DsLegacyImportRow[],
): Promise<DsLegacyImportSummary> {
  const legacyGroupCounts = new Map<string, number>();
  for (const row of rows) {
    const key = legacyGroupKeyOf(row);
    if (!key || !row.platformOrderNo?.trim()) continue;
    legacyGroupCounts.set(key, (legacyGroupCounts.get(key) || 0) + 1);
  }
  const legacyTrackingGroupIds = new Map<string, string>();
  for (const [key, count] of legacyGroupCounts.entries()) {
    if (count > 1) {
      legacyTrackingGroupIds.set(key, randomUUID());
    }
  }

  const touchedCustomers = new Set<string>();
  const touchedProducts = new Set<string>();
  const paymentSeededCustomers = new Set<string>();
  let createdOrders = 0;
  let updatedOrders = 0;
  let uploadedLabels = 0;
  let uploadedProofs = 0;

  const latestPaidSnapshotByCustomer = new Map<
    string,
    { amount: number; paidAt: Date; customerId: string }
  >();

  for (const row of rows) {
    const customer = await ensureCustomer(session, row.customerName);
    touchedCustomers.add(customer.id);

    const product = await ensureProduct(session, {
      sku: row.sku,
      nameZh: row.productNameZh,
      shippingFee: row.shippingFee ?? undefined,
      warehouse: row.warehouse || undefined,
    });
    touchedProducts.add(product.id);

    if (row.productImageUrl || row.unitPrice !== null || row.discountRate !== null) {
      await prisma.dropshippingProduct.update({
        where: { id: product.id },
        data: {
          image_url: row.productImageUrl || undefined,
          unit_price: row.unitPrice ?? undefined,
          discount_rate: row.discountRate ?? undefined,
        },
      });
    }

    const inventory = await ensureInventoryRecord(session, {
      customerId: customer.id,
      productId: product.id,
      warehouse: row.warehouse || undefined,
    });

    await prisma.dropshippingCustomerInventory.update({
      where: { id: inventory.id },
      data: {
        warehouse: row.warehouse || inventory.warehouse || undefined,
      },
    });

    const shippedAtDate = row.shippedAt ? new Date(row.shippedAt) : null;
    const settledAtDate = row.settledAt ? new Date(row.settledAt) : null;
    const rate = await ensureRateByDate(session, {
      date: settledAtDate || shippedAtDate,
      value: row.rateValue,
      sourceName: "legacy-import",
    });

    const existingOrder = await prisma.dropshippingOrder.findFirst({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        customer_id: customer.id,
        platform: row.platform,
        platform_order_no: row.platformOrderNo,
        product_id: product.id,
      },
      select: { id: true },
    });

    const payload = {
      customer_id: customer.id,
      product_id: product.id,
      platform: row.platform.trim(),
      platform_order_no: row.platformOrderNo.trim(),
      tracking_group_id: legacyTrackingGroupIds.get(legacyGroupKeyOf(row)) || null,
      tracking_no: row.trackingNo || null,
      shipping_label_file: row.shippingLabelFile || null,
      quantity: row.quantity,
      color: row.color || null,
      warehouse: row.warehouse || null,
      shipping_status: (row.shipped ? "shipped" : "pending") as DsShippingStatus,
      shipped_at: shippedAtDate,
      shipping_proof_file: row.shippingProofFile || null,
      shipping_fee: row.shippingFee ?? null,
      exchange_rate_id: rate.id,
      snapshot_stocked_qty: row.stockedQty,
      snapshot_stock_amount: row.stockAmount,
      snapshot_rate_value: row.rateValue,
      snapshot_exchanged_amount: row.exchangedAmount,
      snapshot_shipping_amount: row.shippingAmount,
      snapshot_total_amount: row.totalAmount,
      snapshot_paid_amount: row.paidAmount,
      snapshot_unpaid_amount: row.unpaidAmount,
      settled_at: settledAtDate,
      notes: null,
    };

    let order;
    if (existingOrder) {
      order = await prisma.dropshippingOrder.update({
        where: { id: existingOrder.id },
        data: payload,
      });
      updatedOrders += 1;
    } else {
      order = await prisma.dropshippingOrder.create({
        data: {
          tenant_id: session.tenantId,
          company_id: session.companyId,
          ...payload,
        },
      });
      createdOrders += 1;
    }

    const orderKey = sanitizeStoragePart(
      [
        row.customerName,
        row.platformOrderNo,
        row.trackingNo,
        product.sku,
        order.id,
      ]
        .filter(Boolean)
        .join("-"),
    ) || order.id;

    const labelAttachments = await syncOrderAttachments({
      session,
      orderId: order.id,
      orderKey,
      type: "label",
      assets: row.shippingLabelFiles,
    });
    const proofAttachments = await syncOrderAttachments({
      session,
      orderId: order.id,
      orderKey,
      type: "proof",
      assets: row.shippingProofFiles,
    });

    uploadedLabels += labelAttachments.length;
    uploadedProofs += proofAttachments.length;

    await prisma.dropshippingOrder.update({
      where: { id: order.id },
      data: {
        shipping_label_file: labelAttachments[0]?.file_url || row.shippingLabelFile || null,
        shipping_proof_file: proofAttachments[0]?.file_url || row.shippingProofFile || null,
      },
    });

    if (row.paidAmount !== null && row.paidAmount > 0) {
      const paidAt = settledAtDate || shippedAtDate || new Date();
      const prev = latestPaidSnapshotByCustomer.get(customer.id);
      if (!prev || prev.paidAt.getTime() <= paidAt.getTime()) {
        latestPaidSnapshotByCustomer.set(customer.id, {
          amount: row.paidAmount,
          paidAt,
          customerId: customer.id,
        });
      }
    }
  }

  for (const item of latestPaidSnapshotByCustomer.values()) {
    const existingPayment = await prisma.dropshippingPayment.findFirst({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        customer_id: item.customerId,
        payment_method: "legacy-import",
      },
      orderBy: { paid_at: "desc" },
    });

    if (existingPayment) {
      await prisma.dropshippingPayment.update({
        where: { id: existingPayment.id },
        data: {
          amount: item.amount,
          paid_at: item.paidAt,
          notes: "legacy-import-snapshot",
        },
      });
    } else {
      await prisma.dropshippingPayment.create({
        data: {
          tenant_id: session.tenantId,
          company_id: session.companyId,
          customer_id: item.customerId,
          amount: item.amount,
          paid_at: item.paidAt,
          payment_method: "legacy-import",
          notes: "legacy-import-snapshot",
        },
      });
    }
    paymentSeededCustomers.add(item.customerId);
  }

  return {
    totalRows: rows.length,
    createdOrders,
    updatedOrders,
    touchedCustomers: touchedCustomers.size,
    touchedProducts: touchedProducts.size,
    seededPayments: paymentSeededCustomers.size,
    uploadedLabels,
    uploadedProofs,
  };
}

export async function listOrders(session: Session) {
  const rawRows = await prisma.dropshippingOrder.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    include: {
      customer: true,
      product: true,
    },
    orderBy: [{ platform_order_no: "asc" }, { created_at: "asc" }],
  });
  const rows = [...rawRows].sort((a, b) => {
    const aTime = a.shipped_at ? a.shipped_at.getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.shipped_at ? b.shipped_at.getTime() : Number.POSITIVE_INFINITY;
    if (aTime !== bTime) return aTime - bTime;
    const orderNoCompare = a.platform_order_no.localeCompare(b.platform_order_no, "en");
    if (orderNoCompare !== 0) return orderNoCompare;
    return a.created_at.getTime() - b.created_at.getTime();
  });
  const normalizedSkus = [...new Set(
    rows
      .map((row) => row.product.sku.trim())
      .filter(Boolean),
  )];
  const catalogRows = await prisma.productCatalog.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      ...(normalizedSkus.length
        ? {
            OR: normalizedSkus.map((sku) => ({
              sku: { equals: sku, mode: "insensitive" as const },
            })),
          }
        : {}),
    },
    select: {
      sku: true,
      name_zh: true,
      name_es: true,
      price: true,
      normal_discount: true,
    },
  });
  const attachments = await orderAttachmentStore.dropshippingOrderAttachment.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      order_id: { in: rows.map((row) => row.id) },
    },
    orderBy: [{ type: "asc" }, { sort_order: "asc" }],
  });
  const attachmentsByOrder = new Map<string, DsOrderAttachment[]>();
  for (const item of attachments) {
    const current = attachmentsByOrder.get(item.order_id) || [];
    current.push({
      id: item.id,
      type: item.type,
      fileName: item.file_name,
      fileUrl: item.file_url,
      sourcePath: item.source_path || "",
      mimeType: item.mime_type || "",
      sortOrder: item.sort_order,
    });
    attachmentsByOrder.set(item.order_id, current);
  }

  const duplicateKeys = new Set<string>();
  const grouped = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.customer_id}::${row.platform}::${row.platform_order_no}::${row.product_id}`;
    grouped.set(key, (grouped.get(key) || 0) + 1);
  }
  for (const [key, count] of grouped.entries()) {
    if (count > 1) duplicateKeys.add(key);
  }

  const inventoryRows = await prisma.dropshippingCustomerInventory.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    select: {
      customer_id: true,
      product_id: true,
      stocked_qty: true,
    },
  });
  const inventoryMap = new Map<string, number>();
  for (const row of inventoryRows) {
    const key = `${row.customer_id}::${row.product_id}`;
    inventoryMap.set(key, (inventoryMap.get(key) || 0) + row.stocked_qty);
  }
  const catalogBySku = new Map(
    catalogRows.map((row) => [normalizeProductCode(row.sku), row]),
  );

  return rows.map((row): DsOrderRow => {
    const key = `${row.customer_id}::${row.platform}::${row.platform_order_no}`;
    const inventoryQty = inventoryMap.get(`${row.customer_id}::${row.product_id}`) ?? null;
    const attachments = attachmentsByOrder.get(row.id) || [];
    const normalizedSku = normalizeProductCode(row.product.sku);
    const catalog = catalogBySku.get(normalizedSku);
    const matchedSku = catalog?.sku?.trim() || row.product.sku;
    return {
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customer.name,
      productId: row.product_id,
      trackingGroupId: row.tracking_group_id || null,
      settlementStatus:
        row.settled_at || toNumber(row.snapshot_unpaid_amount) <= 0
          ? "paid"
          : "unpaid",
      catalogMatched: Boolean(catalog),
      sku: row.product.sku,
      productNameZh: stripTrailingUnitPrice(catalog?.name_zh?.trim() || row.product.name_zh),
      productNameEs: catalog?.name_es?.trim() || row.product.name_es || "",
      productImageUrl: row.product.image_url || buildProductImageUrl(matchedSku, "jpg"),
      platform: row.platform,
      platformOrderNo: row.platform_order_no,
      trackingNo: row.tracking_no || "",
      quantity: row.quantity,
      shippingStatus: row.shipping_status,
      shippedAt: row.shipped_at?.toISOString() || null,
      snapshotStockedQty: row.snapshot_stocked_qty ?? null,
      snapshotStockAmount: row.snapshot_stock_amount ? toNumber(row.snapshot_stock_amount) : null,
      warehouse: row.warehouse || row.product.default_warehouse || "",
      color: row.color || "",
      shippingFee: toNumber(row.shipping_fee),
      shippingLabelFile: row.shipping_label_file || "",
      shippingProofFile: row.shipping_proof_file || "",
      shippingLabelAttachments: attachments.filter((item) => item.type === "label"),
      shippingProofAttachments: attachments.filter((item) => item.type === "proof"),
      createdAt: row.created_at.toISOString(),
      notes: sanitizeOrderNotes(row.notes),
      currentInventoryQty: inventoryQty,
      warnings: getOrderWarnings({
        duplicate: duplicateKeys.has(key),
        shippingStatus: row.shipping_status,
        quantity: row.quantity,
        trackingNo: row.tracking_no || "",
        shippedAt: row.shipped_at,
        shippingProofFile: row.shipping_proof_file || "",
        inventoryQty,
      }),
    };
  });
}

export async function getInventoryRows(session: Session) {
  const shippedOrders = await prisma.dropshippingOrder.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      shipping_status: "shipped",
    },
    include: {
      customer: true,
      product: true,
    },
    orderBy: [{ shipped_at: "desc" }, { created_at: "desc" }],
  });

  const normalizedSkus = [...new Set(
    shippedOrders
      .map((row) => row.product.sku.trim())
      .filter(Boolean),
  )];

  const catalogRows = await prisma.productCatalog.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      ...(normalizedSkus.length
        ? {
            OR: normalizedSkus.map((sku) => ({
              sku: { equals: sku, mode: "insensitive" as const },
            })),
          }
        : {}),
    },
    select: {
      sku: true,
      name_zh: true,
      name_es: true,
      price: true,
      normal_discount: true,
    },
  });

  const yogoSourceRows = await prisma.yogoProductSource.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      ...(normalizedSkus.length
        ? {
            OR: normalizedSkus.map((sku) => ({
              product_code: { equals: sku, mode: "insensitive" as const },
            })),
          }
        : {}),
    },
    select: {
      product_code: true,
      name_cn: true,
      name_es: true,
      source_price: true,
      source_discount: true,
    },
  });

  const inventories = await prisma.dropshippingCustomerInventory.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    select: {
      id: true,
      customer_id: true,
      product_id: true,
      linked_order_id: true,
      stocked_at: true,
      created_at: true,
      warehouse: true,
      is_stocked: true,
      stocked_qty: true,
      locked_unit_price: true,
      locked_discount_rate: true,
    },
    orderBy: [{ stocked_at: "desc" }, { created_at: "desc" }],
  });

  const inventoriesByPair = new Map<string, typeof inventories>();
  for (const inventory of inventories) {
    const key = `${inventory.customer_id}::${inventory.product_id}`;
    const current = inventoriesByPair.get(key) || [];
    current.push(inventory);
    inventoriesByPair.set(key, current);
  }

  const shippedOrdersByPair = new Map<string, typeof shippedOrders>();
  for (const row of shippedOrders) {
    const key = `${row.customer_id}::${row.product_id}`;
    const current = shippedOrdersByPair.get(key) || [];
    current.push(row);
    shippedOrdersByPair.set(key, current);
  }

  const assignedOrderByInventoryId = new Map<string, string>();
  const assignedShippedQtyByInventoryId = new Map<string, number>();
  const remainingCapacityByInventoryId = new Map<string, number>();
  const totalShippedQtyByPair = new Map<string, number>();

  for (const inventory of inventories) {
    remainingCapacityByInventoryId.set(inventory.id, inventory.is_stocked ? inventory.stocked_qty : 0);
    if (inventory.is_stocked && inventory.linked_order_id) {
      assignedOrderByInventoryId.set(inventory.id, inventory.linked_order_id);
    }
  }

  for (const row of shippedOrders) {
    const pairKey = `${row.customer_id}::${row.product_id}`;
    totalShippedQtyByPair.set(pairKey, (totalShippedQtyByPair.get(pairKey) || 0) + row.quantity);
  }

  for (const row of shippedOrders) {
    const pairKey = `${row.customer_id}::${row.product_id}`;
    const candidates = inventoriesByPair.get(pairKey) || [];
    const linkedInventory = candidates.find((inventory) => inventory.linked_order_id === row.id) || null;
    const shippedDate = row.shipped_at?.toISOString()?.slice(0, 10) || "";
    const matchedInventory =
      (linkedInventory && linkedInventory.is_stocked && (remainingCapacityByInventoryId.get(linkedInventory.id) || 0) >= row.quantity
        ? linkedInventory
        : null)
      || candidates.find((inventory) => {
        if (!inventory.is_stocked) return false;
        const remainingCapacity = remainingCapacityByInventoryId.get(inventory.id) || 0;
        if (remainingCapacity < row.quantity) return false;
        const stockedDate = inventory.stocked_at?.toISOString()?.slice(0, 10) || "";
        return Boolean(stockedDate) && stockedDate === shippedDate;
      })
      || candidates.find((inventory) => {
        if (!inventory.is_stocked) return false;
        const remainingCapacity = remainingCapacityByInventoryId.get(inventory.id) || 0;
        return remainingCapacity >= row.quantity;
      })
      || null;

    if (matchedInventory) {
      if (!assignedOrderByInventoryId.has(matchedInventory.id)) {
        assignedOrderByInventoryId.set(matchedInventory.id, row.id);
      }
      assignedShippedQtyByInventoryId.set(
        matchedInventory.id,
        (assignedShippedQtyByInventoryId.get(matchedInventory.id) || 0) + row.quantity,
      );
      remainingCapacityByInventoryId.set(
        matchedInventory.id,
        Math.max((remainingCapacityByInventoryId.get(matchedInventory.id) || 0) - row.quantity, 0),
      );
    }
  }

  const catalogBySku = new Map(
    catalogRows.map((row) => [normalizeProductCode(row.sku), row]),
  );
  const yogoSourceBySku = new Map(
    yogoSourceRows.map((row) => [normalizeProductCode(row.product_code), row]),
  );

  function pickPreferredNumber(...values: Array<number | null | undefined>) {
    for (const value of values) {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
    }
    for (const value of values) {
      if (typeof value === "number" && Number.isFinite(value)) return value;
    }
    return 0;
  }

  const representedStockedInventoryIds = new Set<string>();

  const baseRows = shippedOrders.map((row): DsInventoryRow => {
    const pairKey = `${row.customer_id}::${row.product_id}`;
    const pairInventories = inventoriesByPair.get(pairKey) || [];
    const stockedInventoriesForPair = pairInventories.filter((entry) => entry.is_stocked && entry.stocked_qty > 0);
    const totalStockedQtyForPair = stockedInventoriesForPair
      .reduce((sum, entry) => sum + entry.stocked_qty, 0);
    const aggregateRemainingQty = Math.max(
      totalStockedQtyForPair - (totalShippedQtyByPair.get(pairKey) || 0),
      0,
    );
    const linkedInventory = pairInventories.find((entry) => entry.linked_order_id === row.id) || null;
    const assignedInventory =
      (linkedInventory?.is_stocked ? linkedInventory : null)
      || pairInventories.find((entry) => entry.is_stocked && assignedOrderByInventoryId.get(entry.id) === row.id)
      || null;
    const editableInventory =
      linkedInventory
      || assignedInventory
      || pairInventories.find((entry) => !entry.linked_order_id)
      || pairInventories[0]
      || null;
    const remainingQty = aggregateRemainingQty;
    const normalizedSku = normalizeProductCode(row.product.sku);
    const catalog = catalogBySku.get(normalizedSku);
    const yogoSource = yogoSourceBySku.get(normalizedSku);
    const matchedSku = catalog?.sku?.trim() || yogoSource?.product_code?.trim() || row.product.sku;
    const unitPrice = pickPreferredNumber(
      toOptionalNumber(yogoSource?.source_price),
      toOptionalNumber(catalog?.price),
      toOptionalNumber(row.product.unit_price),
      toOptionalNumber(assignedInventory?.locked_unit_price),
    );
    const rawDiscountRate = pickPreferredNumber(
      toOptionalNumber(yogoSource?.source_discount),
      toOptionalNumber(catalog?.normal_discount),
      toOptionalNumber(row.product.discount_rate),
      toOptionalNumber(assignedInventory?.locked_discount_rate),
    );
    const discountRate = Math.abs(rawDiscountRate) <= 1 ? rawDiscountRate : rawDiscountRate / 100;
    const stockedAt = assignedInventory?.stocked_at?.toISOString() || null;
    const shippedAt = row.shipped_at?.toISOString() || null;
    const assignedOrderId = assignedInventory ? assignedOrderByInventoryId.get(assignedInventory.id) : null;
    const showsStockDetails = Boolean(assignedInventory?.is_stocked) && assignedOrderId === row.id;
    if (showsStockDetails && assignedInventory?.id) {
      representedStockedInventoryIds.add(assignedInventory.id);
    }
    return {
      rowKey: `order:${row.id}:inventory:${assignedInventory?.id || editableInventory?.id || "none"}`,
      orderId: row.id,
      inventoryId: editableInventory?.id || null,
      customerId: row.customer_id,
      customerName: row.customer.name,
      productId: row.product_id,
      sku: row.product.sku,
      productNameZh: stripTrailingUnitPrice(catalog?.name_zh?.trim() || row.product.name_zh),
      productNameEs: catalog?.name_es?.trim() || row.product.name_es || "",
      productImageUrl: row.product.image_url || buildProductImageUrl(matchedSku, "jpg"),
      stockedAt: showsStockDetails ? stockedAt : null,
      shippedAt,
      trackingNo: row.tracking_no || "",
      warehouse: editableInventory?.warehouse || row.warehouse || row.product.default_warehouse || "",
      isStocked: showsStockDetails,
      stockedQty: assignedInventory?.stocked_qty ?? editableInventory?.stocked_qty ?? 0,
      shippedQty: row.quantity,
      remainingQty,
      unitPrice,
      discountRate,
      stockAmount: showsStockDetails ? computeStockAmount(unitPrice, assignedInventory?.stocked_qty ?? 0, discountRate) : 0,
      status: deriveInventoryStatus(Math.max(aggregateRemainingQty, 0)),
    };
  });

  const extraStockRows: DsInventoryRow[] = [];

  for (const [pairKey, pairInventories] of inventoriesByPair.entries()) {
    const pairOrders = shippedOrdersByPair.get(pairKey) || [];
    if (pairOrders.length === 0) continue;

    const stockedInventoriesForPair = pairInventories.filter((entry) => entry.is_stocked && entry.stocked_qty > 0);
    if (stockedInventoriesForPair.length === 0) continue;

    const totalStockedQtyForPair = stockedInventoriesForPair.reduce((sum, entry) => sum + entry.stocked_qty, 0);
    const aggregateRemainingQty = Math.max(
      totalStockedQtyForPair - (totalShippedQtyByPair.get(pairKey) || 0),
      0,
    );

    for (const inventory of stockedInventoriesForPair) {
      if (representedStockedInventoryIds.has(inventory.id)) continue;

      const anchorOrder =
        pairOrders.find((row) => row.id === inventory.linked_order_id)
        || pairOrders[0];
      if (!anchorOrder) continue;

      const normalizedSku = normalizeProductCode(anchorOrder.product.sku);
      const catalog = catalogBySku.get(normalizedSku);
      const yogoSource = yogoSourceBySku.get(normalizedSku);
      const matchedSku = catalog?.sku?.trim() || yogoSource?.product_code?.trim() || anchorOrder.product.sku;
      const unitPrice = pickPreferredNumber(
        toOptionalNumber(inventory.locked_unit_price),
        toOptionalNumber(yogoSource?.source_price),
        toOptionalNumber(catalog?.price),
        toOptionalNumber(anchorOrder.product.unit_price),
      );
      const rawDiscountRate = pickPreferredNumber(
        toOptionalNumber(inventory.locked_discount_rate),
        toOptionalNumber(yogoSource?.source_discount),
        toOptionalNumber(catalog?.normal_discount),
        toOptionalNumber(anchorOrder.product.discount_rate),
      );
      const discountRate = Math.abs(rawDiscountRate) <= 1 ? rawDiscountRate : rawDiscountRate / 100;

      extraStockRows.push({
        rowKey: `inventory:${inventory.id}`,
        orderId: anchorOrder.id,
        inventoryId: inventory.id,
        customerId: anchorOrder.customer_id,
        customerName: anchorOrder.customer.name,
        productId: anchorOrder.product_id,
        sku: anchorOrder.product.sku,
        productNameZh: stripTrailingUnitPrice(catalog?.name_zh?.trim() || anchorOrder.product.name_zh),
        productNameEs: catalog?.name_es?.trim() || anchorOrder.product.name_es || "",
        productImageUrl: anchorOrder.product.image_url || buildProductImageUrl(matchedSku, "jpg"),
        stockedAt: inventory.stocked_at?.toISOString() || null,
        shippedAt: anchorOrder.shipped_at?.toISOString() || null,
        trackingNo: anchorOrder.tracking_no || "",
        warehouse: inventory.warehouse || anchorOrder.warehouse || anchorOrder.product.default_warehouse || "",
        isStocked: true,
        stockedQty: inventory.stocked_qty,
        shippedQty: anchorOrder.quantity,
        remainingQty: aggregateRemainingQty,
        unitPrice,
        discountRate,
        stockAmount: computeStockAmount(unitPrice, inventory.stocked_qty, discountRate),
        status: deriveInventoryStatus(Math.max(aggregateRemainingQty, 0)),
      });
    }
  }

  return [...baseRows, ...extraStockRows];
}

export async function getDropshippingCustomerOptions(session: Session) {
  const rows = await prisma.dropshippingCustomer.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
  }));
}

export async function createInventory(
  session: Session,
  payload: {
    orderId?: string | null;
    customerId: string;
    productCatalogId?: string | null;
    sku: string;
    productNameZh?: string | null;
    productNameEs?: string | null;
    isStocked?: boolean;
    stockedAt?: string | null;
    stockedQty: number;
    unitPrice?: number | null;
    discountRate?: number | null;
    warehouse?: string | null;
  },
) {
  const customer = await prisma.dropshippingCustomer.findFirst({
    where: {
      id: payload.customerId,
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    select: { id: true },
  });

  if (!customer) {
    throw new Error("customer_not_found");
  }

  const normalizedSku = normalizeProductCode(payload.sku);
  if (!normalizedSku) {
    throw new Error("sku_required");
  }

  const catalog = payload.productCatalogId
    ? await prisma.productCatalog.findFirst({
        where: {
          id: payload.productCatalogId,
          tenant_id: session.tenantId,
          company_id: session.companyId,
        },
        select: {
          sku: true,
          name_zh: true,
          name_es: true,
          price: true,
          normal_discount: true,
        },
      })
    : await prisma.productCatalog.findFirst({
        where: {
          tenant_id: session.tenantId,
          company_id: session.companyId,
          sku: { equals: normalizedSku, mode: "insensitive" as const },
        },
        select: {
          sku: true,
          name_zh: true,
          name_es: true,
          price: true,
          normal_discount: true,
        },
      });

  const yogoSource = catalog
    ? null
    : payload.productCatalogId
      ? await prisma.yogoProductSource.findFirst({
          where: {
            id: payload.productCatalogId,
            tenant_id: session.tenantId,
            company_id: session.companyId,
          },
          select: {
            product_code: true,
            name_cn: true,
            name_es: true,
            source_price: true,
            source_discount: true,
          },
        })
      : await prisma.yogoProductSource.findFirst({
          where: {
            tenant_id: session.tenantId,
            company_id: session.companyId,
            product_code: { equals: normalizedSku, mode: "insensitive" as const },
          },
          select: {
            product_code: true,
            name_cn: true,
            name_es: true,
            source_price: true,
            source_discount: true,
          },
        });

  const product = await ensureProduct(session, {
    sku: catalog?.sku || yogoSource?.product_code || normalizedSku,
    nameZh: payload.productNameZh?.trim() || catalog?.name_zh || yogoSource?.name_cn || normalizedSku,
    nameEs: payload.productNameEs?.trim() || catalog?.name_es || yogoSource?.name_es || undefined,
    warehouse: payload.warehouse?.trim() || undefined,
  });

  return prisma.dropshippingCustomerInventory.create({
    data: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      customer_id: payload.customerId,
      product_id: product.id,
      linked_order_id: payload.orderId?.trim() || null,
      stocked_at: payload.stockedAt ? new Date(`${payload.stockedAt}T12:00:00Z`) : null,
      is_stocked: Boolean(payload.isStocked),
      stocked_qty: payload.stockedQty,
      locked_unit_price:
        payload.unitPrice
        ?? toOptionalNumber(catalog?.price)
        ?? toOptionalNumber(yogoSource?.source_price)
        ?? toOptionalNumber(product.unit_price),
      locked_discount_rate:
        payload.discountRate
        ?? toOptionalNumber(catalog?.normal_discount)
        ?? toOptionalNumber(yogoSource?.source_discount)
        ?? toOptionalNumber(product.discount_rate),
      warehouse: payload.warehouse?.trim() || null,
    },
  });
}

export async function updateInventory(
  session: Session,
  payload: {
    id: string;
    orderId?: string | null;
    isStocked?: boolean;
    stockedAt?: string | null;
    stockedQty: number;
    unitPrice?: number | null;
    discountRate?: number | null;
    warehouse?: string | null;
  },
) {
  const inventory = await prisma.dropshippingCustomerInventory.findFirst({
    where: {
      id: payload.id,
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    select: {
      id: true,
      customer_id: true,
      product_id: true,
      linked_order_id: true,
      warehouse: true,
    },
  });

  if (!inventory) {
    throw new Error("inventory_not_found");
  }

  const linkedOrderId = payload.orderId?.trim() || inventory.linked_order_id || null;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.dropshippingCustomerInventory.update({
      where: { id: inventory.id },
      data: {
        linked_order_id: linkedOrderId,
        is_stocked: Boolean(payload.isStocked),
        stocked_at: payload.stockedAt ? new Date(`${payload.stockedAt}T12:00:00Z`) : null,
        stocked_qty: payload.stockedQty,
        locked_unit_price: payload.unitPrice ?? null,
        locked_discount_rate: payload.discountRate ?? null,
        warehouse: payload.warehouse?.trim() || null,
      },
    });

    if (payload.orderId?.trim() && !inventory.linked_order_id) {
      const remainingBase = await tx.dropshippingCustomerInventory.findFirst({
        where: {
          tenant_id: session.tenantId,
          company_id: session.companyId,
          customer_id: inventory.customer_id,
          product_id: inventory.product_id,
          linked_order_id: null,
          id: { not: inventory.id },
        },
        select: { id: true },
      });

      if (!remainingBase) {
        await tx.dropshippingCustomerInventory.create({
          data: {
            tenant_id: session.tenantId,
            company_id: session.companyId,
            customer_id: inventory.customer_id,
            product_id: inventory.product_id,
            linked_order_id: null,
            stocked_qty: 0,
            is_stocked: false,
            warehouse: payload.warehouse?.trim() || inventory.warehouse || null,
          },
        });
      }
    }

    return updated;
  });
}

export async function deleteInventory(session: Session, id: string) {
  const inventory = await prisma.dropshippingCustomerInventory.findFirst({
    where: {
      id,
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    select: { id: true },
  });

  if (!inventory) {
    throw new Error("inventory_not_found");
  }

  await prisma.dropshippingCustomerInventory.delete({
    where: { id: inventory.id },
  });
}

export async function getFinanceRows(session: Session) {
  const [customers, inventoryRows, paymentRows, currentRate, catalogRows, financeOrders] = await Promise.all([
    prisma.dropshippingCustomer.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      orderBy: { name: "asc" },
    }),
    getInventoryRows(session),
    prisma.dropshippingPayment.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      orderBy: { paid_at: "desc" },
    }),
    ensureTodayExchangeRate(session),
    prisma.productCatalog.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      select: {
        sku: true,
        name_zh: true,
      },
    }),
    prisma.dropshippingOrder.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      select: {
        customer_id: true,
        settled_at: true,
        snapshot_stock_amount: true,
        snapshot_total_amount: true,
        snapshot_paid_amount: true,
        snapshot_unpaid_amount: true,
        shipping_fee: true,
      },
    }),
  ]);

  const settledOrders = await prisma.dropshippingOrder.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      OR: [
        { settled_at: { not: null } },
        { snapshot_unpaid_amount: { lte: 0 } },
      ],
    },
    include: {
      product: true,
    },
    orderBy: [{ settled_at: "desc" }, { updated_at: "desc" }],
  });

  const shippingAgg = await prisma.dropshippingOrder.groupBy({
    by: ["customer_id"],
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    _sum: {
      shipping_fee: true,
    },
  });

  const stockByCustomer = new Map<string, number>();
  for (const row of inventoryRows) {
    stockByCustomer.set(row.customerId, (stockByCustomer.get(row.customerId) || 0) + row.stockAmount);
  }

  const shippingByCustomer = new Map<string, number>(
    shippingAgg.map((row) => [row.customer_id, toNumber(row._sum.shipping_fee)]),
  );

  const paidByCustomer = new Map<string, { amount: number; lastPaidAt: string | null }>();
  for (const row of paymentRows) {
    const prev = paidByCustomer.get(row.customer_id) || { amount: 0, lastPaidAt: null };
    paidByCustomer.set(row.customer_id, {
      amount: prev.amount + toNumber(row.amount),
      lastPaidAt: prev.lastPaidAt || row.paid_at.toISOString(),
    });
  }

  const orderSettlementByCustomer = new Map<string, { totalAmount: number; paidAmount: number; unpaidAmount: number; lastPaidAt: string | null }>();
  for (const row of financeOrders) {
    const current = orderSettlementByCustomer.get(row.customer_id) || {
      totalAmount: 0,
      paidAmount: 0,
      unpaidAmount: 0,
      lastPaidAt: null,
    };
    const totalAmount =
      toNumber(row.snapshot_total_amount)
      || (toNumber(row.snapshot_stock_amount) + toNumber(row.shipping_fee));
    const paidAmount =
      toNumber(row.snapshot_paid_amount)
      || (row.settled_at ? totalAmount : 0);
    const unpaidAmount =
      row.settled_at || toNumber(row.snapshot_unpaid_amount) <= 0
        ? 0
        : (toNumber(row.snapshot_unpaid_amount) || Math.max(totalAmount - paidAmount, 0));

    current.totalAmount += totalAmount;
    current.paidAmount += paidAmount;
    current.unpaidAmount += unpaidAmount;
    if (!current.lastPaidAt && row.settled_at) {
      current.lastPaidAt = row.settled_at.toISOString();
    }
    orderSettlementByCustomer.set(row.customer_id, current);
  }

  const catalogBySku = new Map(
    catalogRows.map((row) => [normalizeProductCode(row.sku), row]),
  );

  const settledOrdersByCustomer = new Map<string, DsFinanceRow["settledOrders"]>();
  for (const row of settledOrders) {
    const normalizedSku = normalizeProductCode(row.product.sku);
    const catalog = catalogBySku.get(normalizedSku);
    const matchedSku = catalog?.sku?.trim() || row.product.sku;
    const items = settledOrdersByCustomer.get(row.customer_id) || [];
    items.push({
      orderId: row.id,
      platformOrderNo: row.platform_order_no,
      sku: row.product.sku,
      productNameZh: stripTrailingUnitPrice(catalog?.name_zh?.trim() || row.product.name_zh),
      productImageUrl: row.product.image_url || buildProductImageUrl(matchedSku, "jpg"),
      trackingNo: row.tracking_no || "",
      shippedAt: row.shipped_at?.toISOString() || null,
      settledAt: row.settled_at?.toISOString() || null,
      paidAmount: toNumber(row.snapshot_paid_amount),
      totalAmount: toNumber(row.snapshot_total_amount),
    });
    settledOrdersByCustomer.set(row.customer_id, items);
  }

  return customers.map((customer): DsFinanceRow => {
    const stockAmount = stockByCustomer.get(customer.id) || 0;
    const exchangeRate = toNumber(currentRate.rate_value);
    const exchangedAmount = stockAmount * exchangeRate;
    const shippingAmount = shippingByCustomer.get(customer.id) || 0;
    const totalAmount = exchangedAmount + shippingAmount;
    const paidItem = paidByCustomer.get(customer.id) || { amount: 0, lastPaidAt: null };
    const orderSettlement = orderSettlementByCustomer.get(customer.id);
    const paidAmount = orderSettlement && orderSettlement.totalAmount > 0 ? orderSettlement.paidAmount : paidItem.amount;
    const unpaidAmount = orderSettlement && orderSettlement.totalAmount > 0 ? orderSettlement.unpaidAmount : Math.max(totalAmount - paidItem.amount, 0);
    const lastPaidAt = orderSettlement?.lastPaidAt || paidItem.lastPaidAt;
    return {
      customerId: customer.id,
      customerName: customer.name,
      stockAmount,
      exchangeRate,
      exchangedAmount,
      shippingAmount,
      totalAmount,
      paidAmount,
      unpaidAmount,
      status: deriveFinanceStatus(totalAmount, paidAmount),
      lastPaidAt,
      settledOrders: settledOrdersByCustomer.get(customer.id) || [],
    };
  });
}

export async function getOverview(session: Session) {
  const [orders, financeRows, inventoryRows, rate] = await Promise.all([
    listOrders(session),
    getFinanceRows(session),
    getInventoryRows(session),
    ensureTodayExchangeRate(session),
  ]);

  const todayStart = startOfTodayInMexico();
  const todayEnd = endOfMexicoDay(todayStart);
  const todayOrders = orders.filter((row) => {
    if (!row.shippedAt) return false;
    const shippedAt = new Date(row.shippedAt);
    return shippedAt >= todayStart && shippedAt < todayEnd;
  });
  const stats: DsOverviewStats = {
    todayOrders: todayOrders.length,
    todayShippedOrders: todayOrders.filter((row) => row.shippingStatus === "shipped").length,
    todayPendingOrders: todayOrders.filter((row) => row.shippingStatus !== "shipped").length,
    unsettledCustomers: financeRows.filter((row) => row.status !== "paid").length,
    totalReceivable: financeRows.reduce((sum, row) => sum + row.totalAmount, 0),
    totalPaid: financeRows.reduce((sum, row) => sum + row.paidAmount, 0),
    totalUnpaid: financeRows.reduce((sum, row) => sum + row.unpaidAmount, 0),
    currentRate: toNumber(rate.rate_value),
    rateUpdatedAt: rate.fetched_at?.toISOString() || rate.updated_at.toISOString(),
    rateFailed: rate.fetch_failed,
    rateFailureReason: rate.failure_reason || null,
  };

  const alerts: DsAlertItem[] = [
    { type: "pending_order", count: orders.filter((row) => row.shippingStatus === "pending").length },
    { type: "missing_shipping_proof", count: orders.filter((row) => row.warnings.includes("missing_shipping_proof")).length },
    { type: "low_inventory", count: inventoryRows.filter((row) => row.status !== "healthy").length },
    { type: "duplicate_order", count: orders.filter((row) => row.warnings.includes("duplicate_order")).length },
    { type: "exchange_rate_failed", count: rate.fetch_failed ? 1 : 0 },
    { type: "customer_unsettled", count: financeRows.filter((row) => row.status !== "paid").length },
  ];

  const recentOrders: DsOverviewOrder[] = orders.slice(0, 6).map((row) => ({
    id: row.id,
    customerName: row.customerName,
    platform: row.platform,
    orderNo: row.platformOrderNo,
    sku: row.sku,
    quantity: row.quantity,
    shippingStatus: row.shippingStatus,
    createdAt: row.createdAt,
  }));

  const monthStart = startOfMexicoMonth(new Date());
  const monthEnd = endOfMexicoMonth(monthStart);
  const monthOrders = orders.filter((row) => {
    if (!row.shippedAt) return false;
    const shippedAt = new Date(row.shippedAt);
    return shippedAt >= monthStart && shippedAt < monthEnd;
  });

  const dailyMap = new Map<string, DsOverviewDailyPoint>();
  for (let cursor = new Date(monthStart); cursor < monthEnd; cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)) {
    const key = cursor.toISOString();
    dailyMap.set(key, {
      date: key,
      label: formatMexicoDayLabel(cursor),
      orderCount: 0,
      shippedCount: 0,
      totalAmount: 0,
    });
  }

  const productRankMap = new Map<string, DsOverviewProductRankItem>();
  const customerOrderMap = new Map<string, DsOverviewCustomerRankItem>();
  const platformMap = new Map<string, DsOverviewPlatformRankItem>();

  for (const row of monthOrders) {
    const shippedDay = startOfMexicoDay(new Date(row.shippedAt!));
    const shippedKey = shippedDay.toISOString();
    const dayItem = dailyMap.get(shippedKey);
    if (dayItem) {
      dayItem.orderCount += 1;
      if (row.shippingStatus === "shipped") dayItem.shippedCount += 1;
      dayItem.totalAmount += (row.snapshotStockAmount ?? 0) + row.shippingFee;
    }

    const productKey = normalizeProductCode(row.sku);
    const productItem = productRankMap.get(productKey) || {
      sku: row.sku,
      productNameZh: row.productNameZh || row.sku,
      quantity: 0,
      orderCount: 0,
    };
    productItem.quantity += row.quantity;
    productItem.orderCount += 1;
    productRankMap.set(productKey, productItem);

    const customerItem = customerOrderMap.get(row.customerId) || {
      customerId: row.customerId,
      customerName: row.customerName,
      orderCount: 0,
      totalAmount: 0,
      paidAmount: 0,
      unpaidAmount: 0,
    };
    customerItem.orderCount += 1;
    customerItem.totalAmount += (row.snapshotStockAmount ?? 0) + row.shippingFee;
    if (row.settlementStatus === "paid") {
      customerItem.paidAmount += (row.snapshotStockAmount ?? 0) + row.shippingFee;
    } else {
      customerItem.unpaidAmount += (row.snapshotStockAmount ?? 0) + row.shippingFee;
    }
    customerOrderMap.set(row.customerId, customerItem);

    const platformKey = row.platform || "无";
    const platformItem = platformMap.get(platformKey) || {
      platform: platformKey,
      orderCount: 0,
      quantity: 0,
    };
    platformItem.orderCount += 1;
    platformItem.quantity += row.quantity;
    platformMap.set(platformKey, platformItem);
  }

  for (const row of financeRows) {
    const current = customerOrderMap.get(row.customerId);
    if (current) {
      current.totalAmount = row.totalAmount;
      current.paidAmount = row.paidAmount;
      current.unpaidAmount = row.unpaidAmount;
    } else {
      customerOrderMap.set(row.customerId, {
        customerId: row.customerId,
        customerName: row.customerName,
        orderCount: 0,
        totalAmount: row.totalAmount,
        paidAmount: row.paidAmount,
        unpaidAmount: row.unpaidAmount,
      });
    }
  }

  const analytics: DsOverviewAnalytics = {
    monthLabel: formatMexicoMonthLabel(monthStart),
    dailySeries: [...dailyMap.values()],
    topProducts: [...productRankMap.values()]
      .sort((a, b) => b.quantity - a.quantity || b.orderCount - a.orderCount)
      .slice(0, 6),
    topCustomersByOrders: [...customerOrderMap.values()]
      .sort((a, b) => b.orderCount - a.orderCount || b.totalAmount - a.totalAmount)
      .slice(0, 6),
    topPlatforms: [...platformMap.values()]
      .sort((a, b) => b.orderCount - a.orderCount || b.quantity - a.quantity)
      .slice(0, 6),
    topCustomersByAmount: [...customerOrderMap.values()]
      .sort((a, b) => b.totalAmount - a.totalAmount || b.orderCount - a.orderCount)
      .slice(0, 6),
  };

  return {
    stats,
    recentOrders,
    alerts,
    analytics,
    trends: {
      orderCount: stats.todayOrders,
      shippedCount: stats.todayShippedOrders,
      receivable: stats.totalReceivable,
    },
  };
}

export async function getExchangeRatePayload(session: Session): Promise<DsExchangeRatePayload> {
  const rate = await ensureTodayExchangeRate(session);
  return {
    id: rate.id,
    rateDate: rate.rate_date.toISOString(),
    baseCurrency: "MXN",
    targetCurrency: "RMB",
    rateValue: toNumber(rate.rate_value),
    sourceName: rate.source_name || "",
    fetchedAt: rate.fetched_at?.toISOString() || null,
    isManual: rate.is_manual,
    fetchFailed: rate.fetch_failed,
    failureReason: rate.failure_reason || null,
  };
}
