import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";

type TenantScope = {
  tenantId: string;
  companyId: string;
};

type ReportScope = TenantScope & {
  storeId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

type PosDbClient = any;
type InventorySourceLite = {
  id: string;
  product_code: string | null;
  product_no: string | null;
  name_cn: string | null;
  name_es: string | null;
};

function runReportQuery<T>(db: PosDbClient, run: (client: PosDbClient) => Promise<T>) {
  if (db === prisma) return withPrismaRetry(() => run(db));
  return run(db);
}

function startOfDay(input: Date) {
  const value = new Date(input);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(input: Date) {
  const value = new Date(input);
  value.setHours(23, 59, 59, 999);
  return value;
}

function parseDateFrom(input?: string) {
  if (!input?.trim()) return null;
  return startOfDay(new Date(`${input}T00:00:00`));
}

function parseDateTo(input?: string) {
  if (!input?.trim()) return null;
  return endOfDay(new Date(`${input}T00:00:00`));
}

function buildCreatedAtRange(params: { dateFrom?: string; dateTo?: string }) {
  const from = parseDateFrom(params.dateFrom);
  const to = parseDateTo(params.dateTo);
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };
}

function buildCurrentWeekRange() {
  const now = new Date();
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  const offset = day === 0 ? 6 : day - 1;
  weekStart.setDate(weekStart.getDate() - offset);
  return {
    start: startOfDay(weekStart),
    end: endOfDay(now),
  };
}

function buildCurrentMonthRange() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    start: startOfDay(monthStart),
    end: endOfDay(now),
  };
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number(value.toFixed(2));
  if (typeof value === "string") return Number(Number(value).toFixed(2));
  if (value && typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
    return Number((value as { toNumber: () => number }).toNumber().toFixed(2));
  }
  return 0;
}

function buildSaleWhere(params: ReportScope) {
  return {
    tenant_id: params.tenantId,
    company_id: params.companyId,
    ...(params.storeId?.trim() ? { store_id: params.storeId.trim() } : {}),
    ...(buildCreatedAtRange(params) ? { created_at: buildCreatedAtRange(params) } : {}),
  };
}

function buildRefundWhere(params: ReportScope) {
  return {
    tenant_id: params.tenantId,
    company_id: params.companyId,
    ...(params.storeId?.trim() ? { store_id: params.storeId.trim() } : {}),
    ...(buildCreatedAtRange(params) ? { created_at: buildCreatedAtRange(params) } : {}),
  };
}

function buildWindowStart(anchorEnd: Date, days: number, dateFrom?: string) {
  const start = startOfDay(new Date(anchorEnd));
  start.setDate(start.getDate() - (days - 1));
  const explicitFrom = parseDateFrom(dateFrom);
  if (explicitFrom && explicitFrom > start) return explicitFrom;
  return start;
}

function toBucketDate(input: Date) {
  return input.toISOString().slice(0, 10);
}

function fillTrendDateBuckets<T extends {
  bucket: string;
  salesTotal: number;
  refundTotal: number;
  netSalesTotal: number;
  orderCount: number;
}>(items: T[], params: { dateFrom?: string; dateTo?: string }) {
  const explicitFrom = parseDateFrom(params.dateFrom);
  const explicitTo = parseDateTo(params.dateTo);
  if (!explicitFrom || !explicitTo) return items;

  const map = new Map(items.map((item) => [item.bucket, item]));
  const filled: T[] = [];
  const cursor = startOfDay(explicitFrom);
  const end = endOfDay(explicitTo);

  while (cursor.getTime() <= end.getTime()) {
    const bucket = toBucketDate(cursor);
    const current = map.get(bucket) || {
      bucket,
      salesTotal: 0,
      refundTotal: 0,
      netSalesTotal: 0,
      orderCount: 0,
    };
    filled.push(current as T);
    cursor.setDate(cursor.getDate() + 1);
  }

  return filled;
}

function buildReplenishmentInventoryStatus(input: { currentQty: number; minStock: number }) {
  if (input.currentQty <= 0) return "out" as const;
  if (input.minStock > 0 && input.currentQty <= input.minStock) return "low" as const;
  return "ok" as const;
}

function resolveMinStockThreshold(minStock: number | null | undefined) {
  return typeof minStock === "number" && minStock > 0 ? minStock : 0;
}

function isLowStockAlert(input: { availableQty: number; minStock: number }) {
  if (input.availableQty <= 0) return true;
  if (input.minStock > 0 && input.availableQty <= input.minStock) return true;
  return false;
}

export async function getPosDashboardSummaryAggregate(params: ReportScope, db: PosDbClient = prisma) {
  return runReportQuery(db, async (client) => {
    const today = new Date();
    const week = buildCurrentWeekRange();
    const month = buildCurrentMonthRange();
    const todayRange = { gte: startOfDay(today), lte: endOfDay(today) };

    const [sales, refunds, todaySales, weekSales, monthSales, todayOrders, weekOrders, monthOrders] = await Promise.all([
      client.posSaleRecord.aggregate({
        where: buildSaleWhere(params),
        _sum: { total: true },
        _count: { id: true },
      }),
      client.posRefundRecord.aggregate({
        where: buildRefundWhere(params),
        _sum: { total: true },
        _count: { id: true },
      }),
      client.posSaleRecord.aggregate({
        where: {
          tenant_id: params.tenantId,
          company_id: params.companyId,
          ...(params.storeId?.trim() ? { store_id: params.storeId.trim() } : {}),
          created_at: todayRange,
        },
        _sum: { total: true },
      }),
      client.posSaleRecord.aggregate({
        where: {
          tenant_id: params.tenantId,
          company_id: params.companyId,
          ...(params.storeId?.trim() ? { store_id: params.storeId.trim() } : {}),
          created_at: {
            gte: week.start,
            lte: week.end,
          },
        },
        _sum: { total: true },
      }),
      client.posSaleRecord.aggregate({
        where: {
          tenant_id: params.tenantId,
          company_id: params.companyId,
          ...(params.storeId?.trim() ? { store_id: params.storeId.trim() } : {}),
          created_at: {
            gte: month.start,
            lte: month.end,
          },
        },
        _sum: { total: true },
      }),
      client.posSaleRecord.aggregate({
        where: {
          tenant_id: params.tenantId,
          company_id: params.companyId,
          ...(params.storeId?.trim() ? { store_id: params.storeId.trim() } : {}),
          created_at: todayRange,
        },
        _count: { id: true },
      }),
      client.posSaleRecord.aggregate({
        where: {
          tenant_id: params.tenantId,
          company_id: params.companyId,
          ...(params.storeId?.trim() ? { store_id: params.storeId.trim() } : {}),
          created_at: {
            gte: week.start,
            lte: week.end,
          },
        },
        _count: { id: true },
      }),
      client.posSaleRecord.aggregate({
        where: {
          tenant_id: params.tenantId,
          company_id: params.companyId,
          ...(params.storeId?.trim() ? { store_id: params.storeId.trim() } : {}),
          created_at: {
            gte: month.start,
            lte: month.end,
          },
        },
        _count: { id: true },
      }),
    ]);

    const salesTotal = toNumber(sales._sum.total);
    const refundTotal = toNumber(refunds._sum.total);
    const orderCount = sales._count.id || 0;

    return {
      salesTotal,
      refundTotal,
      netSalesTotal: Number((salesTotal - refundTotal).toFixed(2)),
      orderCount,
      todayOrderCount: todayOrders._count.id || 0,
      weekOrderCount: weekOrders._count.id || 0,
      monthOrderCount: monthOrders._count.id || 0,
      refundedOrderCount: refunds._count.id || 0,
      avgTicket: orderCount > 0 ? Number((salesTotal / orderCount).toFixed(2)) : 0,
      todaySalesTotal: toNumber(todaySales._sum.total),
      weekSalesTotal: toNumber(weekSales._sum.total),
      monthSalesTotal: toNumber(monthSales._sum.total),
    };
  });
}

export async function getPosPaymentsSummaryAggregate(params: ReportScope, db: PosDbClient = prisma) {
  return runReportQuery(db, async (client) => {
    const [sales, refunds] = await Promise.all([
      client.posSaleRecord.findMany({
        where: buildSaleWhere(params),
        select: {
          payment_method: true,
          total: true,
        },
      }),
      client.posRefundRecord.aggregate({
        where: buildRefundWhere(params),
        _sum: { total: true },
      }),
    ]);

    let cashTotal = 0;
    let transferTotal = 0;
    let cardTotal = 0;
    for (const row of sales) {
      const amount = toNumber(row.total);
      if (row.payment_method === "cash") cashTotal += amount;
      else if (row.payment_method === "transfer") transferTotal += amount;
      else if (row.payment_method === "card") cardTotal += amount;
    }

    return {
      cashTotal: Number(cashTotal.toFixed(2)),
      transferTotal: Number(transferTotal.toFixed(2)),
      cardTotal: Number(cardTotal.toFixed(2)),
      refundTotal: toNumber(refunds._sum.total),
    };
  });
}

export async function getPosTopProductsAggregate(params: ReportScope, db: PosDbClient = prisma) {
  return runReportQuery(db, async (client) => {
    const rows = await client.posSaleLine.findMany({
      where: {
        saleRecord: buildSaleWhere(params),
      },
      select: {
        product_id: true,
        clave_snapshot: true,
        name_cn_snapshot: true,
        name_es_snapshot: true,
        qty: true,
        subtotal: true,
      },
    });

    const map = new Map<string, {
      productId: string;
      clave: string;
      productName: string;
      qtyTotal: number;
      salesTotal: number;
    }>();

    for (const row of rows) {
      const key = row.product_id;
      const current = map.get(key) || {
        productId: row.product_id,
        clave: row.clave_snapshot || "-",
        productName: row.name_cn_snapshot || row.name_es_snapshot || "-",
        qtyTotal: 0,
        salesTotal: 0,
      };
      current.qtyTotal += row.qty;
      current.salesTotal = Number((current.salesTotal + toNumber(row.subtotal)).toFixed(2));
      map.set(key, current);
    }

    const items = Array.from(map.values());
    const limit = Math.min(Math.max(params.limit || 8, 1), 20);
    return {
      topByQty: [...items].sort((a, b) => b.qtyTotal - a.qtyTotal || b.salesTotal - a.salesTotal).slice(0, limit),
      topBySales: [...items].sort((a, b) => b.salesTotal - a.salesTotal || b.qtyTotal - a.qtyTotal).slice(0, limit),
    };
  });
}

export async function getPosInventoryOverviewAggregate(params: ReportScope, db: PosDbClient = prisma) {
  return runReportQuery(db, async (client) => {
    const items = await client.posStoreInventory.findMany({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        ...(params.storeId?.trim() ? { store_id: params.storeId.trim() } : {}),
        active: true,
      },
      orderBy: [{ available_qty: "asc" }, { updated_at: "asc" }],
      take: 200,
    });

    const productIds = Array.from(new Set(items.map((item: any) => item.product_id)));
    const sources: InventorySourceLite[] = productIds.length
      ? await client.yogoProductSource.findMany({
          where: {
            tenant_id: params.tenantId,
            company_id: params.companyId,
            id: { in: productIds },
          },
        select: {
          id: true,
          product_code: true,
          product_no: true,
          name_cn: true,
          name_es: true,
        },
        })
      : [];

    const sourceMap = new Map<string, InventorySourceLite>(sources.map((item: InventorySourceLite) => [item.id, item]));
    const lowStockItems = items
      .filter((item: any) => isLowStockAlert({
        availableQty: item.available_qty,
        minStock: resolveMinStockThreshold(item.min_stock),
      }))
      .slice(0, 12)
      .map((item: any) => {
        const source = sourceMap.get(item.product_id);
        const minStock = resolveMinStockThreshold(item.min_stock);
        return {
          storeId: item.store_id,
          productId: item.product_id,
          clave: source?.product_code || "-",
          productName: source?.name_cn || source?.name_es || "-",
          onHandQty: item.on_hand_qty,
          availableQty: item.available_qty,
          minStock,
        };
      });

    return {
      totalActiveInventoryItems: items.length,
      lowStockCount: items.filter((item: any) => isLowStockAlert({
        availableQty: item.available_qty,
        minStock: resolveMinStockThreshold(item.min_stock),
      })).length,
      outOfStockCount: items.filter((item: any) => item.available_qty <= 0).length,
      lowStockItems,
    };
  });
}

export async function getPosSalesTrendAggregate(params: ReportScope, db: PosDbClient = prisma) {
  return runReportQuery(db, async (client) => {
    const saleRows = await client.posSaleRecord.findMany({
      where: buildSaleWhere(params),
      select: {
        created_at: true,
        total: true,
      },
      orderBy: { created_at: "asc" },
    });

    const refundRows = await client.posRefundRecord.findMany({
      where: buildRefundWhere(params),
      select: {
        created_at: true,
        total: true,
      },
      orderBy: { created_at: "asc" },
    });

    const map = new Map<string, {
      bucket: string;
      salesTotal: number;
      refundTotal: number;
      netSalesTotal: number;
      orderCount: number;
    }>();

    for (const row of saleRows) {
      const bucket = row.created_at.toISOString().slice(0, 10);
      const current = map.get(bucket) || { bucket, salesTotal: 0, refundTotal: 0, netSalesTotal: 0, orderCount: 0 };
      current.salesTotal = Number((current.salesTotal + toNumber(row.total)).toFixed(2));
      current.orderCount += 1;
      current.netSalesTotal = Number((current.salesTotal - current.refundTotal).toFixed(2));
      map.set(bucket, current);
    }

    for (const row of refundRows) {
      const bucket = row.created_at.toISOString().slice(0, 10);
      const current = map.get(bucket) || { bucket, salesTotal: 0, refundTotal: 0, netSalesTotal: 0, orderCount: 0 };
      current.refundTotal = Number((current.refundTotal + toNumber(row.total)).toFixed(2));
      current.netSalesTotal = Number((current.salesTotal - current.refundTotal).toFixed(2));
      map.set(bucket, current);
    }

    const items = Array.from(map.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));
    return fillTrendDateBuckets(items, params);
  });
}

export async function getPosReplenishmentSuggestionsAggregate(params: ReportScope & {
  keyword?: string;
  lowStockOnly?: boolean;
  suggestedOnly?: boolean;
}, db: PosDbClient = prisma) {
  return runReportQuery(db, async (client) => {
    const limit = Math.min(Math.max(params.limit || 100, 1), 500);
    const anchorEnd = parseDateTo(params.dateTo) || endOfDay(new Date());
    const range7 = { gte: buildWindowStart(anchorEnd, 7, params.dateFrom), lte: anchorEnd };
    const range30 = { gte: buildWindowStart(anchorEnd, 30, params.dateFrom), lte: anchorEnd };
    const targetDays = 7;

    const inventoryRows = await client.posStoreInventory.findMany({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        ...(params.storeId?.trim() ? { store_id: params.storeId.trim() } : {}),
        active: true,
      },
      orderBy: [{ available_qty: "asc" }, { updated_at: "desc" }],
    });

    if (!inventoryRows.length) return [];

    const productIds = Array.from(new Set(inventoryRows.map((item: any) => item.product_id)));
    const storeIds = Array.from(new Set(inventoryRows.map((item: any) => item.store_id)));

    const [sources, configs, sales7Rows, sales30Rows] = await Promise.all([
      client.yogoProductSource.findMany({
        where: {
          tenant_id: params.tenantId,
          company_id: params.companyId,
          id: { in: productIds },
        },
        select: {
          id: true,
          product_code: true,
          product_no: true,
          name_cn: true,
          name_es: true,
        },
      }),
      client.posProductConfig.findMany({
        where: {
          tenant_id: params.tenantId,
          company_id: params.companyId,
          store_id: { in: storeIds },
          source_product_id: { in: productIds },
        },
        select: {
          store_id: true,
          source_product_id: true,
          barcode: true,
          clave: true,
          name_cn: true,
          name_es: true,
        },
      }),
      client.posSaleLine.findMany({
        where: {
          product_id: { in: productIds },
          saleRecord: {
            tenant_id: params.tenantId,
            company_id: params.companyId,
            ...(params.storeId?.trim() ? { store_id: params.storeId.trim() } : {}),
            created_at: range7,
          },
        },
        select: {
          product_id: true,
          qty: true,
          saleRecord: { select: { store_id: true } },
        },
      }),
      client.posSaleLine.findMany({
        where: {
          product_id: { in: productIds },
          saleRecord: {
            tenant_id: params.tenantId,
            company_id: params.companyId,
            ...(params.storeId?.trim() ? { store_id: params.storeId.trim() } : {}),
            created_at: range30,
          },
        },
        select: {
          product_id: true,
          qty: true,
          saleRecord: { select: { store_id: true } },
        },
      }),
    ]);

    const sourceMap = new Map<string, InventorySourceLite>(sources.map((item: InventorySourceLite) => [item.id, item]));
    const configMap = new Map<string, {
      barcode: string | null;
      clave: string | null;
      name_cn: string | null;
      name_es: string | null;
    }>(configs.map((item: any) => [`${item.store_id}::${item.source_product_id}`, item]));
    const sales7Map = new Map<string, number>();
    const sales30Map = new Map<string, number>();

    for (const row of sales7Rows) {
      const key = `${row.saleRecord.store_id}::${row.product_id}`;
      sales7Map.set(key, (sales7Map.get(key) || 0) + row.qty);
    }
    for (const row of sales30Rows) {
      const key = `${row.saleRecord.store_id}::${row.product_id}`;
      sales30Map.set(key, (sales30Map.get(key) || 0) + row.qty);
    }

    const keyword = params.keyword?.trim().toLowerCase() || "";

    const items = inventoryRows.map((item: any) => {
      const source = sourceMap.get(item.product_id);
      const config = configMap.get(`${item.store_id}::${item.product_id}`);
      const currentQty = Number(item.available_qty || 0);
      const minStock = resolveMinStockThreshold(item.min_stock);
      const sales7d = sales7Map.get(`${item.store_id}::${item.product_id}`) || 0;
      const sales30d = sales30Map.get(`${item.store_id}::${item.product_id}`) || 0;
      const avgDailySales = Number((sales7d / 7).toFixed(2));
      const suggestedQty = Math.max(0, Math.ceil(targetDays * avgDailySales - currentQty));
      const inventoryStatus = buildReplenishmentInventoryStatus({ currentQty, minStock });
      const suggestionStatus = suggestedQty > 0 ? "suggested" as const : "none" as const;
      const productName = (config?.name_cn || source?.name_cn || config?.name_es || source?.name_es || "-").trim();
      const clave = (config?.clave || source?.product_code || "").trim();
      const barcode = (config?.barcode || source?.product_no || "").trim();
      const statusParts = [];
      if (inventoryStatus === "out") statusParts.push("out");
      else if (inventoryStatus === "low") statusParts.push("low");
      else statusParts.push("ok");
      if (suggestionStatus === "suggested") statusParts.push("suggested");

      return {
        storeId: item.store_id,
        productId: item.product_id,
        clave,
        barcode,
        productName,
        currentQty,
        minStock,
        sales7d,
        sales30d,
        avgDailySales,
        suggestedQty,
        inventoryStatus,
        suggestionStatus,
        combinedStatus: statusParts.join("|"),
      };
    }).filter((item: any) => {
      if (params.lowStockOnly && item.inventoryStatus === "ok") return false;
      if (params.suggestedOnly && item.suggestedQty <= 0) return false;
      if (!keyword) return true;
      const haystack = `${item.storeId} ${item.productName} ${item.clave} ${item.barcode}`.toLowerCase();
      return haystack.includes(keyword);
    });

    return items
      .sort((a: any, b: any) =>
        b.suggestedQty - a.suggestedQty
        || (a.inventoryStatus === "out" ? -1 : a.inventoryStatus === "low" ? 0 : 1) - (b.inventoryStatus === "out" ? -1 : b.inventoryStatus === "low" ? 0 : 1)
        || b.sales7d - a.sales7d
        || a.productName.localeCompare(b.productName))
      .slice(0, limit);
  });
}
