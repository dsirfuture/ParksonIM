import { PrismaClient, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { buildProductImageUrl } from "@/lib/product-image-url";
import { extractCategoryCode, stripLeadingCategoryCode } from "@/lib/yogo-product-utils";

type TenantScope = {
  tenantId: string;
  companyId: string;
};

type PosDbClient = PrismaClient | Prisma.TransactionClient;
type PosProductConfigRow = {
  source_product_id: string;
  barcode: string | null;
  clave: string | null;
  name_cn: string | null;
  name_es: string | null;
  spec: string | null;
  origin: string | null;
  importer: string | null;
  short_desc: string | null;
  pos_price: unknown;
  active: boolean;
  allow_discount: boolean;
};

type StoreInventoryLiteRow = {
  product_id: string;
  available_qty: number;
};

type PosProductRowBase = Omit<ReturnType<typeof mapSourceWithConfig>, "sourceKind" | "inventoryManaged" | "stock">;
type PosProductRow = PosProductRowBase & {
  sourceKind: "yogo";
  inventoryManaged: boolean;
  stock: number;
};
type InventoryBackedPosProductRow = PosProductRowBase & {
  sourceKind: "inventory";
  inventoryManaged: true;
  stock: number;
};

function normalizeStoreId(storeId?: string | null) {
  return storeId?.trim() || "default";
}

function buildSpec(input: { spec?: string | null; subcategoryName?: string | null }) {
  return input.spec?.trim() || input.subcategoryName?.trim() || "";
}

function isMeaningfulPosCategory(value?: string | null) {
  if (!value) return false;
  const normalized = value.trim();
  if (!normalized) return false;
  return normalized !== "-" && normalized !== "--" && normalized.toLowerCase() !== "uncategorized";
}

function normalizeCategoryLabel(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function extractConfiguredYogoCodes(value?: string | null) {
  return String(value || "")
    .split(/[,\s，、;；]+/u)
    .map((item) => item.replace(/\D+/g, "").slice(0, 2))
    .filter(Boolean)
    .map((item) => item.padStart(2, "0"));
}

function resolveCategoryFilterCodes(
  rows: Array<{
    category_zh: string | null;
    category_es: string | null;
    yogo_code: string | null;
  }>,
  category?: string | null,
) {
  const target = normalizeCategoryLabel(category);
  if (!target) return [];
  return rows.flatMap((item) => {
    const zh = normalizeCategoryLabel(item.category_zh);
    const es = normalizeCategoryLabel(item.category_es);
    if (target !== zh && target !== es) return [];
    return extractConfiguredYogoCodes(item.yogo_code);
  });
}

function mapCategoryRowsToCodeMap(
  rows: Array<{
    category_zh: string | null;
    category_es: string | null;
    yogo_code: string | null;
  }>,
) {
  const categoryCodeMap = new Map<string, string>();

  for (const item of rows) {
    const configuredCodes = String(item.yogo_code || "")
      .split(/[,\s，、;；]+/u)
      .map((value) => value.replace(/\D+/g, "").slice(0, 2))
      .filter(Boolean)
      .map((value) => value.padStart(2, "0"));

    const zh = String(item.category_zh || "").trim();
    const es = String(item.category_es || "").trim();
    const mappedName = stripLeadingCategoryCode(zh) || stripLeadingCategoryCode(es);

    if (configuredCodes.length && mappedName) {
      for (const code of configuredCodes) categoryCodeMap.set(code, mappedName);
      continue;
    }

    const zhIsPureCode = /^\d+$/u.test(zh);
    const esIsPureCode = /^\d+$/u.test(es);
    if (zhIsPureCode && es && !esIsPureCode) {
      categoryCodeMap.set(zh.padStart(2, "0"), stripLeadingCategoryCode(es));
      continue;
    }
    if (esIsPureCode && zh && !zhIsPureCode) {
      categoryCodeMap.set(es.padStart(2, "0"), stripLeadingCategoryCode(zh));
      continue;
    }

    const zhCode = extractCategoryCode(zh);
    if (zhCode && !zhIsPureCode) {
      categoryCodeMap.set(zhCode.slice(0, 2).padStart(2, "0"), stripLeadingCategoryCode(zh));
      continue;
    }

    const esCode = extractCategoryCode(es);
    if (esCode && !esIsPureCode) {
      categoryCodeMap.set(esCode.slice(0, 2).padStart(2, "0"), stripLeadingCategoryCode(es));
    }
  }

  return categoryCodeMap;
}

function mapSourceCategoryName(
  source: {
    category_name: string | null;
    subcategory_name: string | null;
  },
  categoryCodeMap: Map<string, string>,
) {
  const categoryCode = extractCategoryCode(source.category_name);
  const mapped = categoryCode ? categoryCodeMap.get(categoryCode.slice(0, 2).padStart(2, "0")) : "";
  const category = stripLeadingCategoryCode(mapped || source.category_name);
  const subcategory = stripLeadingCategoryCode(source.subcategory_name);
  return {
    category: category.trim(),
    subcategory: subcategory.trim(),
  };
}

function runPosProductQuery<T>(db: PosDbClient, run: (client: PosDbClient) => Promise<T>) {
  if (db === prisma) return withPrismaRetry(() => run(db));
  return run(db);
}

function mapSourceWithConfig(
  source: {
    id: string;
    product_code: string;
    product_no: string | null;
    name_cn: string | null;
    name_es: string | null;
    category_name: string | null;
    subcategory_name: string | null;
    source_price: unknown;
    source_disabled: boolean;
  },
  config?: {
    barcode: string | null;
    clave: string | null;
    name_cn: string | null;
    name_es: string | null;
    spec: string | null;
    origin: string | null;
    importer: string | null;
    short_desc: string | null;
    pos_price: unknown;
    active: boolean;
    allow_discount: boolean;
  } | null,
  categoryCodeMap: Map<string, string> = new Map(),
) {
  const categoryInfo = mapSourceCategoryName(source, categoryCodeMap);
  return {
    id: source.id,
    sourceProductId: source.id,
    sourceKind: "yogo" as const,
    inventoryManaged: false,
    barcode: config?.barcode || source.product_no,
    clave: config?.clave || source.product_code,
    imageUrl: buildProductImageUrl(source.product_code, "jpg"),
    nameCn: config?.name_cn || source.name_cn,
    nameEs: config?.name_es || source.name_es,
    category: categoryInfo.category,
    subcategory: categoryInfo.subcategory,
    spec: buildSpec({
      spec: config?.spec,
      subcategoryName: source.subcategory_name,
    }),
    origin: config?.origin?.trim() || "",
    importer: config?.importer?.trim() || "",
    shortDescription: config?.short_desc?.trim() || "",
    posPrice: config?.pos_price,
    sourcePrice: source.source_price,
    active: config ? config.active : !source.source_disabled,
    allowDiscount: config?.allow_discount ?? true,
    stock: 9999,
  };
}

function normalizeTake(input: number | undefined, fallback: number, max: number) {
  return Math.min(Math.max(input || fallback, 1), max);
}

function matchesProductKeyword(
  item: {
    barcode?: string | null;
    clave?: string | null;
    nameCn?: string | null;
    nameEs?: string | null;
    category?: string | null;
    subcategory?: string | null;
    spec?: string | null;
  },
  q: string,
) {
  const keyword = q.trim().toLowerCase();
  if (!keyword) return true;
  const haystack = [
    item.barcode,
    item.clave,
    item.nameCn,
    item.nameEs,
    item.category,
    item.subcategory,
    item.spec,
  ].join(" ").toLowerCase();
  return haystack.includes(keyword);
}

async function getStoreInventoryQuantityMap(
  params: TenantScope & { storeId?: string | null; productIds: string[] },
  db: PosDbClient = prisma,
) {
  const storeId = normalizeStoreId(params.storeId);
  const productIds = Array.from(new Set(params.productIds.filter(Boolean)));
  if (!productIds.length) return new Map<string, number>();

  const rows = await runPosProductQuery(db, (client: any) =>
    client.posStoreInventory.findMany({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        store_id: storeId,
        active: true,
        product_id: { in: productIds },
      },
      select: {
        product_id: true,
        available_qty: true,
      },
    }),
  ) as StoreInventoryLiteRow[];

  return new Map<string, number>(rows.map((item: any) => [item.product_id, Number(item.available_qty || 0)]));
}

async function listInventoryBackedPosProductRows(
  params: TenantScope & {
    storeId?: string | null;
    q?: string;
    take?: number;
    category?: string | null;
  },
  db: PosDbClient = prisma,
): Promise<InventoryBackedPosProductRow[]> {
  const storeId = normalizeStoreId(params.storeId);
  const take = normalizeTake(params.take, 60, 1000);
  const inventoryRows = await runPosProductQuery(db, (client: any) =>
    client.posStoreInventory.findMany({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        store_id: storeId,
        active: true,
      },
      orderBy: [{ updated_at: "desc" }, { created_at: "desc" }],
      select: {
        product_id: true,
        available_qty: true,
      },
    }),
  ) as StoreInventoryLiteRow[];

  const productRows = await getPosProductRowsByIds({
    tenantId: params.tenantId,
    companyId: params.companyId,
    storeId,
    ids: inventoryRows.map((item: any) => item.product_id),
  }, db);

  const productMap = new Map(productRows.map((item) => [item.id, item]));
  return inventoryRows
    .map((inventoryItem: any) => {
      const product = productMap.get(inventoryItem.product_id);
      if (!product || !product.active || !product.clave) return null;
      return {
        ...product,
        sourceKind: "inventory" as const,
        inventoryManaged: true,
        stock: Number(inventoryItem.available_qty || 0),
      };
    })
    .filter((item): item is InventoryBackedPosProductRow => Boolean(item))
    .filter((item) => !params.category || normalizeCategoryLabel(item.category) === normalizeCategoryLabel(params.category))
    .filter((item) => matchesProductKeyword(item, params.q || ""))
    .slice(0, take);
}

async function listYogoPosProductRows(
  params: TenantScope & {
    storeId?: string | null;
    take?: number;
    category?: string | null;
  },
  db: PosDbClient = prisma,
): Promise<PosProductRow[]> {
  const storeId = normalizeStoreId(params.storeId);
  const take = normalizeTake(params.take, 60, 1000);
  const categoryMapRows = await runPosProductQuery(db, (client) =>
    client.productCategoryMap.findMany({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        active: true,
      },
      select: {
        category_zh: true,
        category_es: true,
        yogo_code: true,
      },
    }),
  );
  const categoryCodes = resolveCategoryFilterCodes(categoryMapRows, params.category);

  const sources = await runPosProductQuery(db, (client) =>
    client.yogoProductSource.findMany({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        source_disabled: false,
        ...(categoryCodes.length
          ? {
              OR: categoryCodes.map((code) => ({
                category_name: { startsWith: code },
              })),
            }
          : {}),
      },
      orderBy: [{ updated_at: "desc" }, { product_code: "asc" }],
      take,
      select: {
        id: true,
        product_code: true,
        product_no: true,
        name_cn: true,
        name_es: true,
        category_name: true,
        subcategory_name: true,
        source_price: true,
        source_disabled: true,
      },
    }),
  );

  const configs = await runPosProductQuery(db, (client) =>
    (client.posProductConfig as any).findMany({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        store_id: storeId,
        source_product_id: { in: sources.map((item) => item.id) },
      },
      select: {
        source_product_id: true,
        barcode: true,
        clave: true,
        name_cn: true,
        name_es: true,
        spec: true,
        origin: true,
        importer: true,
        short_desc: true,
        pos_price: true,
        active: true,
        allow_discount: true,
      },
    }),
  ) as PosProductConfigRow[];

  const configMap = new Map(configs.map((item) => [item.source_product_id, item]));
  const categoryCodeMap = mapCategoryRowsToCodeMap(categoryMapRows);
  return sources
    .map((source) => mapSourceWithConfig(source, configMap.get(source.id), categoryCodeMap))
    .filter((item) => item.active && item.clave);
}

async function mergePosProductRowsWithInventory(
  params: TenantScope & {
    storeId?: string | null;
    rows: Array<Record<string, any>>;
  },
  db: PosDbClient = prisma,
): Promise<any[]> {
  const inventoryMap = await getStoreInventoryQuantityMap({
    tenantId: params.tenantId,
    companyId: params.companyId,
    storeId: params.storeId,
    productIds: params.rows.map((item) => item.id),
  }, db);

  return params.rows.map((item) => {
    if (inventoryMap.has(item.id)) {
      return {
        ...item,
        sourceKind: "inventory" as const,
        inventoryManaged: true,
        stock: inventoryMap.get(item.id) || 0,
      };
    }
    return {
      ...item,
      sourceKind: item.sourceKind || "yogo",
      inventoryManaged: false,
      stock: 9999,
    };
  });
}

export async function listPosProductRows(params: TenantScope & { storeId?: string | null; take?: number; includeYogo?: boolean; category?: string | null }): Promise<any[]> {
  if (!params.includeYogo) {
    return listInventoryBackedPosProductRows(params);
  }
  const take = normalizeTake(params.take, 60, 1000);
  const [inventoryRows, yogoRows] = await Promise.all([
    listInventoryBackedPosProductRows({ ...params, take }),
    listYogoPosProductRows({ ...params, take }),
  ]);
  const merged = new Map<string, Record<string, any>>();
  for (const item of inventoryRows) merged.set(item.id, item);
  for (const item of yogoRows) {
    if (!merged.has(item.id)) merged.set(item.id, item);
  }
  return mergePosProductRowsWithInventory({
    tenantId: params.tenantId,
    companyId: params.companyId,
    storeId: params.storeId,
    rows: Array.from(merged.values()).slice(0, take),
  });
}

export async function searchPosProductRows(params: TenantScope & {
  storeId?: string | null;
  q: string;
  take?: number;
  includeYogo?: boolean;
}): Promise<any[]> {
  const q = params.q.trim();
  if (!q) return [];
  const take = normalizeTake(params.take, 30, 100);
  if (!params.includeYogo) {
    return listInventoryBackedPosProductRows({ ...params, q, take });
  }
  const storeId = normalizeStoreId(params.storeId);
  const [sources, categoryMapRows] = await Promise.all([
    withPrismaRetry(() =>
      prisma.yogoProductSource.findMany({
        where: {
          tenant_id: params.tenantId,
          company_id: params.companyId,
          source_disabled: false,
          OR: [
            { product_code: { contains: q, mode: "insensitive" } },
            { product_no: { contains: q, mode: "insensitive" } },
            { name_cn: { contains: q, mode: "insensitive" } },
            { name_es: { contains: q, mode: "insensitive" } },
            { category_name: { contains: q, mode: "insensitive" } },
            { subcategory_name: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: [{ updated_at: "desc" }, { product_code: "asc" }],
        take,
        select: {
          id: true,
          product_code: true,
          product_no: true,
          name_cn: true,
          name_es: true,
          category_name: true,
          subcategory_name: true,
          source_price: true,
          source_disabled: true,
        },
      }),
    ),
    withPrismaRetry(() =>
      prisma.productCategoryMap.findMany({
        where: {
          tenant_id: params.tenantId,
          company_id: params.companyId,
          active: true,
        },
        select: {
          category_zh: true,
          category_es: true,
          yogo_code: true,
        },
      }),
    ),
  ]);
  const configs = await withPrismaRetry(() =>
    (prisma.posProductConfig as any).findMany({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        store_id: storeId,
        source_product_id: { in: sources.map((item) => item.id) },
      },
      select: {
        source_product_id: true,
        barcode: true,
        clave: true,
        name_cn: true,
        name_es: true,
        spec: true,
        origin: true,
        importer: true,
        short_desc: true,
        pos_price: true,
        active: true,
        allow_discount: true,
      },
    }),
  ) as PosProductConfigRow[];

  const configMap = new Map(configs.map((item) => [item.source_product_id, item]));
  const categoryCodeMap = mapCategoryRowsToCodeMap(categoryMapRows);
  const rows = sources
    .map((source) => mapSourceWithConfig(source, configMap.get(source.id), categoryCodeMap))
    .filter((item) => item.active && item.clave);
  return mergePosProductRowsWithInventory({
    tenantId: params.tenantId,
    companyId: params.companyId,
    storeId: params.storeId,
    rows,
  });
}

export async function listPosPrimaryCategoryRows(
  params: TenantScope & { storeId?: string | null; includeYogo?: boolean },
  db: PosDbClient = prisma,
): Promise<Array<{ categoryZh: string; categoryEs: string }>> {
  const inventoryRows = await listInventoryBackedPosProductRows(
    { ...params, take: 1000 },
    db,
  );

  const categoryMapRows = params.includeYogo
    ? await runPosProductQuery(db, (client) =>
        client.productCategoryMap.findMany({
          where: {
            tenant_id: params.tenantId,
            company_id: params.companyId,
            active: true,
          },
          orderBy: [{ category_zh: "asc" }],
          select: {
            category_zh: true,
            category_es: true,
          },
        }),
      )
    : [];

  const seen = new Set<string>();
  const rows: Array<{ categoryZh: string; categoryEs: string }> = [];

  for (const item of categoryMapRows) {
    const categoryZh = String(item.category_zh || "").trim();
    const categoryEs = String(item.category_es || "").trim();
    if (!isMeaningfulPosCategory(categoryZh)) continue;
    if (seen.has(categoryZh)) continue;
    seen.add(categoryZh);
    rows.push({ categoryZh, categoryEs });
  }

  for (const item of inventoryRows) {
    const categoryZh = String(item.category || "").trim();
    if (!isMeaningfulPosCategory(categoryZh)) continue;
    if (seen.has(categoryZh)) continue;
    seen.add(categoryZh);
    rows.push({ categoryZh, categoryEs: categoryZh });
  }

  return rows;
}

export async function findPosProductRowByBarcode(params: TenantScope & {
  storeId?: string | null;
  barcode: string;
  includeYogo?: boolean;
}): Promise<any | null> {
  if (!params.includeYogo) {
    const rows = await listInventoryBackedPosProductRows({
      tenantId: params.tenantId,
      companyId: params.companyId,
      storeId: params.storeId,
      q: params.barcode,
      take: 100,
    });
    const barcode = params.barcode.trim().toLowerCase();
    return rows.find((item) => item.barcode?.toLowerCase() === barcode) || null;
  }
  const storeId = normalizeStoreId(params.storeId);
  const barcode = params.barcode.trim();
  if (!barcode) return null;

  const configFirst = await withPrismaRetry(() =>
    (prisma.posProductConfig as any).findFirst({
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
        origin: true,
        importer: true,
        short_desc: true,
        pos_price: true,
        active: true,
        allow_discount: true,
      },
    }),
  ) as PosProductConfigRow | null;

  const [source, categoryMapRows] = await Promise.all([
    withPrismaRetry(() =>
      prisma.yogoProductSource.findFirst({
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
        category_name: true,
        subcategory_name: true,
        source_price: true,
        source_disabled: true,
      },
      }),
    ),
    withPrismaRetry(() =>
      prisma.productCategoryMap.findMany({
        where: {
          tenant_id: params.tenantId,
          company_id: params.companyId,
          active: true,
        },
        select: {
          category_zh: true,
          category_es: true,
          yogo_code: true,
        },
      }),
    ),
  ]);
  if (!source) return null;

  const config = configFirst || await withPrismaRetry(() =>
    (prisma.posProductConfig as any).findFirst({
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
        origin: true,
        importer: true,
        short_desc: true,
        pos_price: true,
        active: true,
        allow_discount: true,
      },
    }),
  ) as PosProductConfigRow | null;

  const row = {
    ...mapSourceWithConfig(source, config, mapCategoryRowsToCodeMap(categoryMapRows)),
  };
  if (!row.active || !row.clave) return null;
  const [merged] = await mergePosProductRowsWithInventory({
    tenantId: params.tenantId,
    companyId: params.companyId,
    storeId: params.storeId,
    rows: [row],
  });
  return merged || null;
}

export async function findPosProductRowByClave(params: TenantScope & {
  storeId?: string | null;
  clave: string;
  includeYogo?: boolean;
}): Promise<any | null> {
  if (!params.includeYogo) {
    const rows = await listInventoryBackedPosProductRows({
      tenantId: params.tenantId,
      companyId: params.companyId,
      storeId: params.storeId,
      q: params.clave,
      take: 100,
    });
    const clave = params.clave.trim().toLowerCase();
    return rows.find((item) => item.clave?.toLowerCase() === clave) || null;
  }
  const storeId = normalizeStoreId(params.storeId);
  const clave = params.clave.trim();
  if (!clave) return null;

  const configFirst = await withPrismaRetry(() =>
    (prisma.posProductConfig as any).findFirst({
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
        origin: true,
        importer: true,
        short_desc: true,
        pos_price: true,
        active: true,
        allow_discount: true,
      },
    }),
  ) as PosProductConfigRow | null;

  const [source, categoryMapRows] = await Promise.all([
    withPrismaRetry(() =>
      prisma.yogoProductSource.findFirst({
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
        category_name: true,
        subcategory_name: true,
        source_price: true,
        source_disabled: true,
      },
      }),
    ),
    withPrismaRetry(() =>
      prisma.productCategoryMap.findMany({
        where: {
          tenant_id: params.tenantId,
          company_id: params.companyId,
          active: true,
        },
        select: {
          category_zh: true,
          category_es: true,
          yogo_code: true,
        },
      }),
    ),
  ]);
  if (!source) return null;

  const config = configFirst || await withPrismaRetry(() =>
    (prisma.posProductConfig as any).findFirst({
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
        pos_price: true,
        active: true,
        allow_discount: true,
      },
    }),
  ) as PosProductConfigRow | null;

  const row = {
    ...mapSourceWithConfig(source, config, mapCategoryRowsToCodeMap(categoryMapRows)),
  };
  if (!row.active || !row.clave) return null;
  const [merged] = await mergePosProductRowsWithInventory({
    tenantId: params.tenantId,
    companyId: params.companyId,
    storeId: params.storeId,
    rows: [row],
  });
  return merged || null;
}

export async function getPosProductRowsByIds(
  params: TenantScope & {
    storeId?: string | null;
    ids: string[];
  },
  db: PosDbClient = prisma,
) {
  const storeId = normalizeStoreId(params.storeId);
  const ids = Array.from(new Set(params.ids.filter(Boolean)));
  if (ids.length === 0) return [];

  const [sources, categoryMapRows] = await Promise.all([
    runPosProductQuery(db, (client) =>
      client.yogoProductSource.findMany({
        where: {
          tenant_id: params.tenantId,
          company_id: params.companyId,
          id: { in: ids },
        },
        select: {
          id: true,
          product_code: true,
          product_no: true,
          name_cn: true,
          name_es: true,
          category_name: true,
          subcategory_name: true,
          source_price: true,
          source_disabled: true,
        },
      }),
    ),
    runPosProductQuery(db, (client) =>
      client.productCategoryMap.findMany({
        where: {
          tenant_id: params.tenantId,
          company_id: params.companyId,
          active: true,
        },
        select: {
          category_zh: true,
          category_es: true,
          yogo_code: true,
        },
      }),
    ),
  ]);

  const configs = await runPosProductQuery(db, (client) =>
    (client.posProductConfig as any).findMany({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        store_id: storeId,
        source_product_id: { in: ids },
      },
      select: {
        source_product_id: true,
        barcode: true,
        clave: true,
        name_cn: true,
        name_es: true,
        spec: true,
        origin: true,
        importer: true,
        short_desc: true,
        pos_price: true,
        active: true,
        allow_discount: true,
      },
    }),
  ) as PosProductConfigRow[];

  const configMap = new Map(configs.map((item) => [item.source_product_id, item]));
  const categoryCodeMap = mapCategoryRowsToCodeMap(categoryMapRows);
  return sources.map((source) => mapSourceWithConfig(source, configMap.get(source.id), categoryCodeMap));
}
