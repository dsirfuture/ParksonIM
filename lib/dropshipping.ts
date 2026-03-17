import { prisma } from "@/lib/prisma";
import type { Session } from "@/lib/tenant";
import type {
  DsAlertItem,
  DsExchangeRatePayload,
  DsFinanceRow,
  DsFinanceStatus,
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
import { uploadR2Object } from "@/lib/r2-upload";

const DEFAULT_RATE_VALUE = 0.08;
const LOW_STOCK_THRESHOLD = 5;
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
  return unitPrice * stockedQty * (1 - discountRate);
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

  if (existing) return existing;

  return prisma.dropshippingExchangeRate.create({
    data: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      rate_date: today,
      base_currency: "RMB",
      target_currency: "MXN",
      rate_value: DEFAULT_RATE_VALUE,
      source_name: "system-default",
      fetched_at: new Date(),
      is_manual: false,
      fetch_failed: false,
    },
  });
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
  const normalizedSku = input.sku.trim().toUpperCase();
  let product = await prisma.dropshippingProduct.findFirst({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      sku: normalizedSku,
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
        sku: normalizedSku,
        name_zh: input.nameZh.trim() || catalog?.name_zh || normalizedSku,
        name_es: input.nameEs?.trim() || catalog?.name_es || null,
        unit_price: toOptionalNumber(catalog?.price),
        discount_rate: toOptionalNumber(catalog?.normal_discount),
        default_shipping_fee: input.shippingFee ?? null,
        default_warehouse: input.warehouse?.trim() || null,
      },
    });
  }

  const nextData: Record<string, unknown> = {};
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
    sku: string;
    productNameZh: string;
    productNameEs?: string;
    quantity: number;
    trackingNo?: string;
    color?: string;
    warehouse?: string;
    shippedAt?: string | null;
    shippingFee?: number;
    shippingStatus: DsShippingStatus;
    notes?: string;
  },
) {
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

  const data = {
    customer_id: customer.id,
    product_id: product.id,
    platform: payload.platform.trim(),
    platform_order_no: payload.platformOrderNo.trim(),
    tracking_no: payload.trackingNo?.trim() || null,
    quantity: payload.quantity,
    color: payload.color?.trim() || null,
    warehouse: payload.warehouse?.trim() || product.default_warehouse || null,
    shipped_at: payload.shippedAt ? new Date(payload.shippedAt) : null,
    shipping_fee: payload.shippingFee ?? product.default_shipping_fee ?? null,
    shipping_status: payload.shippingStatus,
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

    const nextStockedQty = row.stockedQty ?? inventory.stocked_qty;
    await prisma.dropshippingCustomerInventory.update({
      where: { id: inventory.id },
      data: {
        stocked_qty: nextStockedQty,
        locked_unit_price: row.unitPrice ?? undefined,
        locked_discount_rate: row.discountRate ?? undefined,
        warehouse: row.warehouse || inventory.warehouse || undefined,
        notes:
          row.stockAmount !== null
            ? `legacy-stock-amount:${row.stockAmount.toFixed(2)}`
            : inventory.notes || undefined,
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
  const inventoryMap = new Map<string, number>(
    inventoryRows.map((row) => [`${row.customer_id}::${row.product_id}`, row.stocked_qty]),
  );
  const catalogBySku = new Map(
    catalogRows.map((row) => [row.sku.trim().toUpperCase(), row]),
  );

  return rows.map((row): DsOrderRow => {
    const key = `${row.customer_id}::${row.platform}::${row.platform_order_no}`;
    const inventoryQty = inventoryMap.get(`${row.customer_id}::${row.product_id}`) ?? null;
    const attachments = attachmentsByOrder.get(row.id) || [];
    const normalizedSku = row.product.sku.trim().toUpperCase();
    const catalog = catalogBySku.get(normalizedSku);
    return {
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customer.name,
      productId: row.product_id,
      settlementStatus:
        row.settled_at || toNumber(row.snapshot_unpaid_amount) <= 0
          ? "paid"
          : "unpaid",
      catalogMatched: Boolean(catalog),
      sku: row.product.sku,
      productNameZh: catalog?.name_zh?.trim() || row.product.name_zh,
      productNameEs: catalog?.name_es?.trim() || row.product.name_es || "",
      productImageUrl: catalog ? buildProductImageUrl(row.product.sku, "jpg") : "",
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
  const inventories = await prisma.dropshippingCustomerInventory.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    include: {
      customer: true,
      product: true,
    },
    orderBy: [{ updated_at: "desc" }],
  });

  const shippedOrders = await prisma.dropshippingOrder.groupBy({
    by: ["customer_id", "product_id"],
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      shipping_status: "shipped",
    },
    _sum: {
      quantity: true,
    },
  });

  const shippedMap = new Map<string, number>(
    shippedOrders.map((row) => [`${row.customer_id}::${row.product_id}`, row._sum.quantity || 0]),
  );

  return inventories.map((row): DsInventoryRow => {
    const shippedQty = shippedMap.get(`${row.customer_id}::${row.product_id}`) || 0;
    const remainingQty = row.stocked_qty - shippedQty;
    const unitPrice = toNumber(row.locked_unit_price ?? row.product.unit_price);
    const discountRate = toNumber(row.locked_discount_rate ?? row.product.discount_rate);
    return {
      inventoryId: row.id,
      customerId: row.customer_id,
      customerName: row.customer.name,
      productId: row.product_id,
      sku: row.product.sku,
      productNameZh: row.product.name_zh,
      productNameEs: row.product.name_es || "",
      productImageUrl: row.product.image_url || "",
      warehouse: row.warehouse || row.product.default_warehouse || "",
      stockedQty: row.stocked_qty,
      shippedQty,
      remainingQty,
      unitPrice,
      discountRate,
      stockAmount: computeStockAmount(unitPrice, row.stocked_qty, discountRate),
      status: deriveInventoryStatus(remainingQty),
    };
  });
}

export async function getFinanceRows(session: Session) {
  const [customers, inventoryRows, paymentRows, currentRate] = await Promise.all([
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

  const settledOrdersByCustomer = new Map<string, DsFinanceRow["settledOrders"]>();
  for (const row of settledOrders) {
    const items = settledOrdersByCustomer.get(row.customer_id) || [];
    items.push({
      orderId: row.id,
      platformOrderNo: row.platform_order_no,
      sku: row.product.sku,
      productNameZh: row.product.name_zh,
      productImageUrl: row.product.image_url || buildProductImageUrl(row.product.sku, "jpg"),
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
    const unpaidAmount = totalAmount - paidItem.amount;
    return {
      customerId: customer.id,
      customerName: customer.name,
      stockAmount,
      exchangeRate,
      exchangedAmount,
      shippingAmount,
      totalAmount,
      paidAmount: paidItem.amount,
      unpaidAmount,
      status: deriveFinanceStatus(totalAmount, paidItem.amount),
      lastPaidAt: paidItem.lastPaidAt,
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

  const todayStart = startOfTodayInMexico().getTime();
  const todayOrders = orders.filter((row) => new Date(row.createdAt).getTime() >= todayStart);
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

  return {
    stats,
    recentOrders,
    alerts,
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
    baseCurrency: rate.base_currency,
    targetCurrency: rate.target_currency,
    rateValue: toNumber(rate.rate_value),
    sourceName: rate.source_name || "",
    fetchedAt: rate.fetched_at?.toISOString() || null,
    isManual: rate.is_manual,
    fetchFailed: rate.fetch_failed,
    failureReason: rate.failure_reason || null,
  };
}
