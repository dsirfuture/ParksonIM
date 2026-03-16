import { prisma } from "@/lib/prisma";
import type { Session } from "@/lib/tenant";
import type {
  DsAlertItem,
  DsExchangeRatePayload,
  DsFinanceRow,
  DsFinanceStatus,
  DsInventoryRow,
  DsInventoryStatus,
  DsOrderRow,
  DsOverviewOrder,
  DsOverviewStats,
  DsShippingStatus,
} from "@/lib/dropshipping-types";

const DEFAULT_RATE_VALUE = 0.08;
const LOW_STOCK_THRESHOLD = 5;

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
        sku: normalizedSku,
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

export async function listOrders(session: Session) {
  const rows = await prisma.dropshippingOrder.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    include: {
      customer: true,
      product: true,
    },
    orderBy: [{ created_at: "desc" }, { platform_order_no: "desc" }],
  });

  const duplicateKeys = new Set<string>();
  const grouped = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.customer_id}::${row.platform}::${row.platform_order_no}`;
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

  return rows.map((row): DsOrderRow => {
    const key = `${row.customer_id}::${row.platform}::${row.platform_order_no}`;
    const inventoryQty = inventoryMap.get(`${row.customer_id}::${row.product_id}`) ?? null;
    return {
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customer.name,
      productId: row.product_id,
      sku: row.product.sku,
      productNameZh: row.product.name_zh,
      productNameEs: row.product.name_es || "",
      productImageUrl: row.product.image_url || "",
      platform: row.platform,
      platformOrderNo: row.platform_order_no,
      trackingNo: row.tracking_no || "",
      quantity: row.quantity,
      shippingStatus: row.shipping_status,
      shippedAt: row.shipped_at?.toISOString() || null,
      warehouse: row.warehouse || row.product.default_warehouse || "",
      color: row.color || "",
      shippingFee: toNumber(row.shipping_fee),
      shippingLabelFile: row.shipping_label_file || "",
      shippingProofFile: row.shipping_proof_file || "",
      createdAt: row.created_at.toISOString(),
      notes: row.notes || "",
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
