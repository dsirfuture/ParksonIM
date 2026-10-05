import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";

type TenantScope = {
  tenantId: string;
  companyId: string;
};

type PosDbClient = any;

type InventoryAdjustment = {
  inventoryId: string;
  qty: number;
  nextOnHandQty: number;
  nextAvailableQty: number;
};

type InventoryMovementInput = {
  storeId: string;
  productId: string;
  moveType: string;
  qtyChange: number;
  qtyBefore: number;
  qtyAfter: number;
  sourceType: string;
  sourceId?: string | null;
  sourceFolio?: string | null;
  note?: string | null;
  createdBy?: string | null;
};

type PosInventoryListQuery = TenantScope & {
  storeId?: string;
  keyword?: string;
  clave?: string;
  barcode?: string;
  status?: string;
  lowStockOnly?: boolean;
  page?: number;
  limit?: number;
};

type PosInventoryMovementListQuery = TenantScope & {
  storeId?: string;
  productId?: string;
  keyword?: string;
  moveType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

type ProductSourceLite = {
  id: string;
  product_code: string | null;
  product_no: string | null;
  name_cn: string | null;
  name_es: string | null;
  subcategory_name: string | null;
};

type ProductConfigLite = {
  source_product_id: string;
  barcode: string | null;
  clave: string | null;
  name_cn: string | null;
  name_es: string | null;
  spec: string | null;
};

function runInventoryQuery<T>(db: PosDbClient, run: (client: PosDbClient) => Promise<T>) {
  if (db === prisma) return withPrismaRetry(() => run(db));
  return run(db);
}

function normalizeStoreId(input?: string | null) {
  return input?.trim() || "default";
}

function normalizePage(input?: number) {
  return Math.max(1, Number(input || 1));
}

function normalizeLimit(input?: number) {
  return Math.min(100, Math.max(1, Number(input || 20)));
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

async function mapInventoryRowsForList(
  client: PosDbClient,
  params: PosInventoryListQuery,
) {
  const storeId = params.storeId?.trim();
  const rows = await client.posStoreInventory.findMany({
    where: {
      tenant_id: params.tenantId,
      company_id: params.companyId,
      ...(storeId ? { store_id: storeId } : {}),
      active: true,
    },
    orderBy: [{ updated_at: "desc" }, { created_at: "desc" }],
  });

  const { sourceMap, configMap } = await getProductMetaMaps(client, {
    tenantId: params.tenantId,
    companyId: params.companyId,
    storeId,
    productIds: rows.map((item: any) => item.product_id),
  });

  const keyword = params.keyword?.trim().toLowerCase() || "";
  const clave = params.clave?.trim().toLowerCase() || "";
  const barcode = params.barcode?.trim().toLowerCase() || "";
  const status = params.status?.trim().toLowerCase() || "";

  return rows.map((item: any) => {
    const source = sourceMap.get(item.product_id);
    const config = configMap.get(item.product_id);
    const minStock = resolveMinStockThreshold(item.min_stock);
    const inventoryStatus = buildInventoryStatus({ availableQty: item.available_qty, minStock });
    return {
      id: item.id,
      storeId: item.store_id,
      productId: item.product_id,
      clave: cleanText(config?.clave) || cleanText(source?.product_code),
      barcode: cleanText(config?.barcode) || cleanText(source?.product_no),
      productName: cleanText(config?.name_cn) || cleanText(source?.name_cn) || cleanText(config?.name_es) || cleanText(source?.name_es),
      spec: buildProductSpec(config, source),
      onHandQty: item.on_hand_qty,
      reservedQty: item.reserved_qty,
      availableQty: item.available_qty,
      minStock,
      active: item.active,
      status: inventoryStatus,
      updatedAt: item.updated_at.toISOString(),
    };
  }).filter((item: any) => {
    if (params.lowStockOnly && item.status !== "low") return false;
    if (status && item.status !== status) return false;
    if (clave && !item.clave.toLowerCase().includes(clave)) return false;
    if (barcode && !item.barcode.toLowerCase().includes(barcode)) return false;
    if (keyword) {
      const haystack = `${item.clave} ${item.barcode} ${item.productName} ${item.spec}`.toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });
}

async function mapInventoryMovementRowsForList(
  client: PosDbClient,
  params: PosInventoryMovementListQuery,
) {
  const rows = await client.posInventoryMovement.findMany({
    where: {
      tenant_id: params.tenantId,
      company_id: params.companyId,
      ...(params.storeId?.trim() ? { store_id: params.storeId.trim() } : {}),
      ...(params.productId?.trim() ? { product_id: params.productId.trim() } : {}),
      ...(params.moveType?.trim() ? { move_type: params.moveType.trim() } : {}),
      ...(buildCreatedAtRange(params) ? { created_at: buildCreatedAtRange(params) } : {}),
    },
    orderBy: [{ created_at: "desc" }],
  });

  const { sourceMap, configMap } = await getProductMetaMaps(client, {
    tenantId: params.tenantId,
    companyId: params.companyId,
    storeId: params.storeId,
    productIds: rows.map((item: any) => item.product_id),
  });

  const keyword = params.keyword?.trim().toLowerCase() || "";
  return rows.map((item: any) => {
    const source = sourceMap.get(item.product_id);
    const config = configMap.get(item.product_id);
    return {
      id: item.id,
      createdAt: item.created_at.toISOString(),
      storeId: item.store_id,
      productId: item.product_id,
      clave: cleanText(config?.clave) || cleanText(source?.product_code),
      barcode: cleanText(config?.barcode) || cleanText(source?.product_no),
      productName: cleanText(config?.name_cn) || cleanText(source?.name_cn) || cleanText(config?.name_es) || cleanText(source?.name_es),
      moveType: item.move_type,
      qtyChange: item.qty_change,
      qtyBefore: item.qty_before,
      qtyAfter: item.qty_after,
      sourceType: item.source_type,
      sourceId: item.source_id,
      sourceFolio: item.source_folio,
      createdBy: item.created_by,
      note: item.note,
    };
  }).filter((item: any) => {
    if (!keyword) return true;
    const haystack = `${item.clave} ${item.barcode} ${item.productName} ${item.sourceFolio || ""} ${item.note || ""}`.toLowerCase();
    return haystack.includes(keyword);
  });
}

async function findPosProductByBarcodeInternal(
  client: PosDbClient,
  params: TenantScope & {
    storeId?: string | null;
    barcode: string;
  },
) {
  const storeId = normalizeStoreId(params.storeId);
  const barcode = params.barcode.trim();
  if (!barcode) return null;

  const configFirst = await client.posProductConfig.findFirst({
    where: {
      tenant_id: params.tenantId,
      company_id: params.companyId,
      store_id: storeId,
      barcode,
      active: true,
    },
    select: {
      source_product_id: true,
      barcode: true,
      clave: true,
      name_cn: true,
      name_es: true,
      spec: true,
      active: true,
    },
  });

  const source = await client.yogoProductSource.findFirst({
    where: configFirst
      ? {
          tenant_id: params.tenantId,
          company_id: params.companyId,
          id: configFirst.source_product_id,
          source_disabled: false,
        }
      : {
          tenant_id: params.tenantId,
          company_id: params.companyId,
          product_no: barcode,
          source_disabled: false,
        },
    select: {
      id: true,
      product_code: true,
      product_no: true,
      name_cn: true,
      name_es: true,
      subcategory_name: true,
      source_disabled: true,
    },
  });

  if (!source) return null;

  const config = configFirst || await client.posProductConfig.findFirst({
    where: {
      tenant_id: params.tenantId,
      company_id: params.companyId,
      store_id: storeId,
      source_product_id: source.id,
    },
    select: {
      source_product_id: true,
      barcode: true,
      clave: true,
      name_cn: true,
      name_es: true,
      spec: true,
      active: true,
    },
  });

  const row = {
    id: source.id,
    barcode: cleanText(config?.barcode) || cleanText(source.product_no),
    clave: cleanText(config?.clave) || cleanText(source.product_code),
    nameCn: cleanText(config?.name_cn) || cleanText(source.name_cn),
    nameEs: cleanText(config?.name_es) || cleanText(source.name_es),
    spec: buildProductSpec(config, source),
    active: config ? config.active : !source.source_disabled,
  };

  return row.active && (row.clave || row.barcode) ? row : null;
}

async function findPosProductByClaveInternal(
  client: PosDbClient,
  params: TenantScope & {
    storeId?: string | null;
    clave: string;
  },
) {
  const storeId = normalizeStoreId(params.storeId);
  const clave = params.clave.trim();
  if (!clave) return null;

  const configFirst = await client.posProductConfig.findFirst({
    where: {
      tenant_id: params.tenantId,
      company_id: params.companyId,
      store_id: storeId,
      clave,
      active: true,
    },
    select: {
      source_product_id: true,
      barcode: true,
      clave: true,
      name_cn: true,
      name_es: true,
      spec: true,
      active: true,
    },
  });

  const source = await client.yogoProductSource.findFirst({
    where: configFirst
      ? {
          tenant_id: params.tenantId,
          company_id: params.companyId,
          id: configFirst.source_product_id,
          source_disabled: false,
        }
      : {
          tenant_id: params.tenantId,
          company_id: params.companyId,
          product_code: clave,
          source_disabled: false,
        },
    select: {
      id: true,
      product_code: true,
      product_no: true,
      name_cn: true,
      name_es: true,
      subcategory_name: true,
      source_disabled: true,
    },
  });

  if (!source) return null;

  const config = configFirst || await client.posProductConfig.findFirst({
    where: {
      tenant_id: params.tenantId,
      company_id: params.companyId,
      store_id: storeId,
      source_product_id: source.id,
    },
    select: {
      source_product_id: true,
      barcode: true,
      clave: true,
      name_cn: true,
      name_es: true,
      spec: true,
      active: true,
    },
  });

  const row = {
    id: source.id,
    barcode: cleanText(config?.barcode) || cleanText(source.product_no),
    clave: cleanText(config?.clave) || cleanText(source.product_code),
    nameCn: cleanText(config?.name_cn) || cleanText(source.name_cn),
    nameEs: cleanText(config?.name_es) || cleanText(source.name_es),
    spec: buildProductSpec(config, source),
    active: config ? config.active : !source.source_disabled,
  };

  return row.active && (row.clave || row.barcode) ? row : null;
}

export async function listKnownPosStoreIds(
  params: TenantScope,
  db: PosDbClient = prisma,
) {
  return runInventoryQuery(db, async (client) => {
    const [inventoryStores, movementStores, saleStores, quoteStores, suspendedStores, productStores, ticketStores, settingsStores] = await Promise.all([
      client.posStoreInventory.findMany({
        where: { tenant_id: params.tenantId, company_id: params.companyId },
        distinct: ["store_id"],
        select: { store_id: true },
      }),
      client.posInventoryMovement.findMany({
        where: { tenant_id: params.tenantId, company_id: params.companyId },
        distinct: ["store_id"],
        select: { store_id: true },
      }),
      client.posSaleRecord.findMany({
        where: { tenant_id: params.tenantId, company_id: params.companyId },
        distinct: ["store_id"],
        select: { store_id: true },
      }),
      client.posQuoteRecord.findMany({
        where: { tenant_id: params.tenantId, company_id: params.companyId },
        distinct: ["store_id"],
        select: { store_id: true },
      }),
      client.posSuspendedOrderRecord.findMany({
        where: { tenant_id: params.tenantId, company_id: params.companyId },
        distinct: ["store_id"],
        select: { store_id: true },
      }),
      client.posProductConfig.findMany({
        where: { tenant_id: params.tenantId, company_id: params.companyId },
        distinct: ["store_id"],
        select: { store_id: true },
      }),
      client.posTicketSetting.findMany({
        where: { tenant_id: params.tenantId, company_id: params.companyId },
        distinct: ["store_id"],
        select: { store_id: true },
      }),
      client.posStoreSetting.findMany({
        where: { tenant_id: params.tenantId, company_id: params.companyId },
        distinct: ["store_id"],
        select: { store_id: true },
      }),
    ]);

    const values = new Set<string>(["default", "store-demo-001"]);
    for (const item of [
      ...inventoryStores,
      ...movementStores,
      ...saleStores,
      ...quoteStores,
      ...suspendedStores,
      ...productStores,
      ...ticketStores,
      ...settingsStores,
    ]) {
      if (item.store_id?.trim()) values.add(item.store_id.trim());
    }
    return Array.from(values);
  });
}

export async function findPosProductForImport(
  params: TenantScope & {
    storeId?: string | null;
    clave?: string | null;
    barcode?: string | null;
  },
  db: PosDbClient = prisma,
) {
  return runInventoryQuery(db, async (client) => {
    const clave = params.clave?.trim() || "";
    const barcode = params.barcode?.trim() || "";
    if (!clave && !barcode) return null;

    const [byClave, byBarcode] = await Promise.all([
      clave ? findPosProductByClaveInternal(client, { ...params, clave }) : Promise.resolve(null),
      barcode ? findPosProductByBarcodeInternal(client, { ...params, barcode }) : Promise.resolve(null),
    ]);

    if (byClave && byBarcode && byClave.id !== byBarcode.id) {
      return { status: "mismatch" as const };
    }

    const matched = byClave || byBarcode;
    if (!matched) return null;
    return {
      status: "matched" as const,
      productId: matched.id,
      clave: matched.clave,
      barcode: matched.barcode,
      productName: matched.nameCn || matched.nameEs || matched.clave,
      spec: matched.spec,
    };
  });
}

function cleanText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function buildProductSpec(config?: ProductConfigLite | null, source?: ProductSourceLite | null) {
  return cleanText(config?.spec) || cleanText(source?.subcategory_name);
}

function buildInventoryStatus(input: { availableQty: number; minStock: number }) {
  if (input.availableQty <= 0) return "out" as const;
  if (input.minStock > 0 && input.availableQty <= input.minStock) return "low" as const;
  return "ok" as const;
}

function resolveMinStockThreshold(minStock: number | null | undefined) {
  return typeof minStock === "number" && minStock > 0 ? minStock : 0;
}

async function getProductMetaMaps(
  client: PosDbClient,
  params: TenantScope & { storeId?: string; productIds: string[] },
) {
  const uniqueProductIds = Array.from(new Set(params.productIds.filter(Boolean)));
  if (!uniqueProductIds.length) {
    return {
      sourceMap: new Map<string, ProductSourceLite>(),
      configMap: new Map<string, ProductConfigLite>(),
    };
  }

  const [sources, configs] = await Promise.all([
    client.yogoProductSource.findMany({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        id: { in: uniqueProductIds },
      },
      select: {
        id: true,
        product_code: true,
        product_no: true,
        name_cn: true,
        name_es: true,
        subcategory_name: true,
      },
    }),
    client.posProductConfig.findMany({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        store_id: normalizeStoreId(params.storeId),
        source_product_id: { in: uniqueProductIds },
      },
      select: {
        source_product_id: true,
        barcode: true,
        clave: true,
        name_cn: true,
        name_es: true,
        spec: true,
      },
    }),
  ]);

  return {
    sourceMap: new Map<string, ProductSourceLite>(sources.map((item: ProductSourceLite) => [item.id, item])),
    configMap: new Map<string, ProductConfigLite>(configs.map((item: ProductConfigLite) => [item.source_product_id, item])),
  };
}

export async function getPosStoreInventoryRows(
  params: TenantScope & { storeId: string; productIds: string[] },
  db: PosDbClient = prisma,
) {
  const productIds = Array.from(new Set(params.productIds.filter(Boolean)));
  if (productIds.length === 0) return [];
  return runInventoryQuery(db, (client) =>
    client.posStoreInventory.findMany({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        store_id: params.storeId,
        product_id: { in: productIds },
      },
    }),
  );
}

export async function decrementPosStoreInventory(
  params: TenantScope & { storeId: string; adjustment: InventoryAdjustment },
  db: PosDbClient = prisma,
) {
  return runInventoryQuery(db, (client) =>
    client.posStoreInventory.updateMany({
      where: {
        id: params.adjustment.inventoryId,
        tenant_id: params.tenantId,
        company_id: params.companyId,
        store_id: params.storeId,
        on_hand_qty: { gte: params.adjustment.qty },
        active: true,
      },
      data: {
        on_hand_qty: params.adjustment.nextOnHandQty,
        available_qty: params.adjustment.nextAvailableQty,
      },
    }),
  );
}

export async function upsertAndIncrementPosStoreInventory(
  params: TenantScope & {
    storeId: string;
    productId: string;
    qtyChange: number;
  },
  db: PosDbClient = prisma,
) {
  return runInventoryQuery(db, async (client) => {
    const current = await client.posStoreInventory.findFirst({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        store_id: params.storeId,
        product_id: params.productId,
      },
    });

    if (!current) {
      return client.posStoreInventory.create({
        data: {
          tenant_id: params.tenantId,
          company_id: params.companyId,
          store_id: params.storeId,
          product_id: params.productId,
          on_hand_qty: params.qtyChange,
          reserved_qty: 0,
          available_qty: params.qtyChange,
          active: true,
        },
      });
    }

    return client.posStoreInventory.update({
      where: { id: current.id },
      data: {
        on_hand_qty: current.on_hand_qty + params.qtyChange,
        available_qty: Math.max(0, current.available_qty + params.qtyChange),
      },
    });
  });
}

export async function createPosInventoryMovements(
  params: TenantScope & { items: InventoryMovementInput[] },
  db: PosDbClient = prisma,
) {
  if (!params.items.length) return { count: 0 };
  return runInventoryQuery(db, (client) =>
    client.posInventoryMovement.createMany({
      data: params.items.map((item) => ({
        tenant_id: params.tenantId,
        company_id: params.companyId,
        store_id: item.storeId,
        product_id: item.productId,
        move_type: item.moveType,
        qty_change: item.qtyChange,
        qty_before: item.qtyBefore,
        qty_after: item.qtyAfter,
        source_type: item.sourceType,
        source_id: item.sourceId || null,
        source_folio: item.sourceFolio || null,
        note: item.note || null,
        created_by: item.createdBy || null,
      })),
    }),
  );
}

export async function listPosStoreInventories(
  params: PosInventoryListQuery,
  db: PosDbClient = prisma,
) {
  return runInventoryQuery(db, async (client) => {
    const page = normalizePage(params.page);
    const limit = normalizeLimit(params.limit);
    const mapped = await mapInventoryRowsForList(client, params);
    const total = mapped.length;
    const start = (page - 1) * limit;
    return {
      items: mapped.slice(start, start + limit),
      total,
      page,
      limit,
    };
  });
}

export async function getPosStoreInventoryDetail(
  params: TenantScope & { id: string },
  db: PosDbClient = prisma,
) {
  return runInventoryQuery(db, async (client) => {
    const row = await client.posStoreInventory.findFirst({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        id: params.id,
      },
    });
    if (!row) return null;
    const { sourceMap, configMap } = await getProductMetaMaps(client, {
      tenantId: params.tenantId,
      companyId: params.companyId,
      storeId: row.store_id,
      productIds: [row.product_id],
    });
    const source = sourceMap.get(row.product_id);
    const config = configMap.get(row.product_id);
    const minStock = resolveMinStockThreshold(row.min_stock);
    return {
      id: row.id,
      storeId: row.store_id,
      productId: row.product_id,
      clave: cleanText(config?.clave) || cleanText(source?.product_code),
      barcode: cleanText(config?.barcode) || cleanText(source?.product_no),
      productName: cleanText(config?.name_cn) || cleanText(source?.name_cn) || cleanText(config?.name_es) || cleanText(source?.name_es),
      spec: buildProductSpec(config, source),
      onHandQty: row.on_hand_qty,
      reservedQty: row.reserved_qty,
      availableQty: row.available_qty,
      minStock,
      active: row.active,
      status: buildInventoryStatus({ availableQty: row.available_qty, minStock }),
      updatedAt: row.updated_at.toISOString(),
    };
  });
}

export async function listPosInventoryMovements(
  params: PosInventoryMovementListQuery,
  db: PosDbClient = prisma,
) {
  return runInventoryQuery(db, async (client) => {
    const page = normalizePage(params.page);
    const limit = normalizeLimit(params.limit);
    const mapped = await mapInventoryMovementRowsForList(client, params);
    const total = mapped.length;
    const start = (page - 1) * limit;
    return {
      items: mapped.slice(start, start + limit),
      total,
      page,
      limit,
    };
  });
}

export async function listAllPosStoreInventories(
  params: PosInventoryListQuery,
  db: PosDbClient = prisma,
) {
  return runInventoryQuery(db, async (client) => mapInventoryRowsForList(client, params));
}

export async function listAllPosInventoryMovements(
  params: PosInventoryMovementListQuery,
  db: PosDbClient = prisma,
) {
  return runInventoryQuery(db, async (client) => mapInventoryMovementRowsForList(client, params));
}

export async function adjustPosStoreInventory(
  params: TenantScope & {
    id: string;
    adjustType: "increase" | "decrease";
    qty: number;
    reason?: string | null;
    note?: string | null;
    operator?: string | null;
  },
  db: PosDbClient = prisma,
) {
  return runInventoryQuery(db, async (client) => {
    const current = await client.posStoreInventory.findFirst({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        id: params.id,
      },
    });
    if (!current) throw new Error("POS_INVENTORY_NOT_FOUND");
    if (!Number.isFinite(params.qty) || params.qty <= 0) throw new Error("POS_INVENTORY_INVALID_ADJUST_QTY");

    const product = await client.yogoProductSource.findFirst({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        id: current.product_id,
      },
      select: { id: true },
    });
    if (!product) throw new Error("POS_PRODUCT_NOT_FOUND");

    const qtyBefore = current.on_hand_qty;
    const qtyAfter = params.adjustType === "increase"
      ? qtyBefore + params.qty
      : qtyBefore - params.qty;
    if (qtyAfter < 0) throw new Error("POS_INVENTORY_NEGATIVE_NOT_ALLOWED");

    const nextAvailableQty = Math.max(0, qtyAfter - current.reserved_qty);
    const updated = await client.posStoreInventory.update({
      where: { id: current.id },
      data: {
        on_hand_qty: qtyAfter,
        available_qty: nextAvailableQty,
      },
    });

    await client.posInventoryMovement.create({
      data: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        store_id: current.store_id,
        product_id: current.product_id,
        move_type: "adjust",
        qty_change: params.adjustType === "increase" ? params.qty : -params.qty,
        qty_before: qtyBefore,
        qty_after: qtyAfter,
        source_type: "adjust",
        source_id: current.id,
        source_folio: null,
        note: [params.reason?.trim(), params.note?.trim()].filter(Boolean).join(" | ") || null,
        created_by: params.operator?.trim() || null,
      },
    });

    return {
      current,
      updated,
      qtyBefore,
      qtyAfter,
    };
  });
}

export async function countPosStoreInventory(
  params: TenantScope & {
    id: string;
    finalQty: number;
    reason?: string | null;
    note?: string | null;
    operator?: string | null;
  },
  db: PosDbClient = prisma,
) {
  return runInventoryQuery(db, async (client) => {
    const current = await client.posStoreInventory.findFirst({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        id: params.id,
      },
    });
    if (!current) throw new Error("POS_INVENTORY_NOT_FOUND");
    if (!Number.isFinite(params.finalQty) || params.finalQty < 0) throw new Error("POS_COUNT_INVALID_FINAL_QTY");

    const product = await client.yogoProductSource.findFirst({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        id: current.product_id,
      },
      select: { id: true },
    });
    if (!product) throw new Error("POS_PRODUCT_NOT_FOUND");

    const qtyBefore = current.on_hand_qty;
    const qtyAfter = Math.floor(params.finalQty);
    const qtyChange = qtyAfter - qtyBefore;
    const nextAvailableQty = Math.max(0, qtyAfter - current.reserved_qty);

    const updated = await client.posStoreInventory.update({
      where: { id: current.id },
      data: {
        on_hand_qty: qtyAfter,
        available_qty: nextAvailableQty,
      },
    });

    await client.posInventoryMovement.create({
      data: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        store_id: current.store_id,
        product_id: current.product_id,
        move_type: "count",
        qty_change: qtyChange,
        qty_before: qtyBefore,
        qty_after: qtyAfter,
        source_type: "count",
        source_id: current.id,
        source_folio: null,
        note: [params.reason?.trim(), params.note?.trim()].filter(Boolean).join(" | ") || null,
        created_by: params.operator?.trim() || null,
      },
    });

    return {
      current,
      updated,
      qtyBefore,
      qtyAfter,
      qtyChange,
    };
  });
}

export async function damagePosStoreInventory(
  params: TenantScope & {
    id: string;
    qty: number;
    reason?: string | null;
    note?: string | null;
    operator?: string | null;
  },
  db: PosDbClient = prisma,
) {
  return runInventoryQuery(db, async (client) => {
    const current = await client.posStoreInventory.findFirst({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        id: params.id,
      },
    });
    if (!current) throw new Error("POS_INVENTORY_NOT_FOUND");
    if (!Number.isFinite(params.qty) || params.qty <= 0) throw new Error("POS_DAMAGE_INVALID_QTY");

    const product = await client.yogoProductSource.findFirst({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        id: current.product_id,
      },
      select: { id: true },
    });
    if (!product) throw new Error("POS_PRODUCT_NOT_FOUND");

    const qtyBefore = current.on_hand_qty;
    const qtyAfter = qtyBefore - Math.floor(params.qty);
    if (qtyAfter < 0) throw new Error("POS_DAMAGE_NEGATIVE_NOT_ALLOWED");

    const nextAvailableQty = Math.max(0, qtyAfter - current.reserved_qty);
    const updated = await client.posStoreInventory.update({
      where: { id: current.id },
      data: {
        on_hand_qty: qtyAfter,
        available_qty: nextAvailableQty,
      },
    });

    await client.posInventoryMovement.create({
      data: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        store_id: current.store_id,
        product_id: current.product_id,
        move_type: "damage",
        qty_change: -Math.floor(params.qty),
        qty_before: qtyBefore,
        qty_after: qtyAfter,
        source_type: "damage",
        source_id: current.id,
        source_folio: null,
        note: [params.reason?.trim(), params.note?.trim()].filter(Boolean).join(" | ") || null,
        created_by: params.operator?.trim() || null,
      },
    });

    return {
      current,
      updated,
      qtyBefore,
      qtyAfter,
      qtyChange: -Math.floor(params.qty),
    };
  });
}
