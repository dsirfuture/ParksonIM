// @ts-nocheck
﻿import { redirect } from "next/navigation";
import { hasLocalProductImage } from "@/lib/local-product-image";
import { normalizeProductCode } from "@/lib/product-code";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";
import {
  extractCategoryCode,
  parseYogoDiscountParts,
  stripLeadingCategoryCode,
} from "@/lib/yogo-product-utils";
import { ProductsManagementClient } from "./ProductsManagementClient";

function toNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  ) {
    try {
      return (value as { toNumber: () => number }).toNumber();
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeSku(value: string | null | undefined) {
  return normalizeProductCode(value);
}

function trailing3Digits(value: string | null | undefined) {
  const text = normalizeSku(value);
  const match = text.match(/(\d{3})$/);
  return match ? match[1] : "";
}

function hasProductImage(sku: string) {
  return hasLocalProductImage(sku, "jpg");
}

function formatZhDateTime(date: Date) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}年${values.month}月${values.day}日 ${values.hour}:${values.minute}`;
}

function maxDate(values: Array<Date | null | undefined>) {
  let latest: Date | null = null;
  for (const value of values) {
    if (!value) continue;
    if (!latest || value > latest) latest = value;
  }
  return latest;
}

export default async function ProductsManagementPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await hasPermission(session, "manageProducts"))) redirect("/dashboard");

  const yogoRows = await withPrismaRetry(() =>
    prisma.yogoProductSource.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      orderBy: [{ updated_at: "desc" }, { product_code: "asc" }],
    }),
  );
  const categoryMapRows = await withPrismaRetry(() =>
    prisma.productCategoryMap.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        active: true,
      },
      select: {
        category_zh: true,
        category_es: true,
        yogo_code: true,
        active: true,
      },
    }),
  );
  const enabledSupplierRows = await withPrismaRetry(() =>
    prisma.supplierProfile.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        enabled: true,
      },
      select: { short_name: true },
      orderBy: [{ short_name: "asc" }],
    }),
  );

  const inventoryRows = await withPrismaRetry(() =>
    prisma.productCatalog.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        inventory: { gt: 5000 },
      },
      select: { sku: true },
    }),
  );

  const blockedTail3Set = new Set(
    inventoryRows
      .map((row) => trailing3Digits(row.sku))
      .filter(Boolean),
  );
  const visibleRows = yogoRows.filter((row) => {
    const tail3 = trailing3Digits(row.product_code);
    if (!tail3) return true;
    return !blockedTail3Set.has(tail3);
  });
  // For "latest sync to website", always use synced_at first (all rows in tenant/company scope).
  const latestSyncedAt = maxDate(yogoRows.map((row) => row.synced_at));
  const fallbackSourceUpdatedAt = maxDate(yogoRows.map((row) => row.source_updated_at));
  const fallbackUpdatedAt = maxDate(yogoRows.map((row) => row.updated_at));
  let yogoLastUpdatedText = "最近一次友购产品更新时间是：暂无";
  if (latestSyncedAt) {
    yogoLastUpdatedText = `最近一次友购产品更新时间是：${formatZhDateTime(latestSyncedAt)}`;
  } else if (fallbackSourceUpdatedAt) {
    yogoLastUpdatedText = `最近一次友购产品更新时间是：${formatZhDateTime(fallbackSourceUpdatedAt)}（回退：source_updated_at）`;
  } else if (fallbackUpdatedAt) {
    yogoLastUpdatedText = `最近一次友购产品更新时间是：${formatZhDateTime(fallbackUpdatedAt)}（回退：updated_at）`;
  }
  const categoryCodeMap = new Map<string, string>();
  for (const item of categoryMapRows) {
    const configuredCodes = String(item.yogo_code || "")
      .split(/[,\s，、;；]+/u)
      .map((value) => value.replace(/\D+/g, "").slice(0, 2))
      .filter(Boolean)
      .map((value) => value.padStart(2, "0"));
    if (configuredCodes.length) {
      const zh = String(item.category_zh || "").trim();
      const es = String(item.category_es || "").trim();
      const mapped = stripLeadingCategoryCode(zh) || stripLeadingCategoryCode(es);
      if (mapped) {
        for (const code of configuredCodes) {
          categoryCodeMap.set(code, mapped);
        }
        continue;
      }
    }
    const zh = String(item.category_zh || "").trim();
    const es = String(item.category_es || "").trim();
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

  const initialRows = visibleRows.map((row) => {
    const discount = parseYogoDiscountParts(row.category_name, row.source_discount);
    const categoryCode = extractCategoryCode(row.category_name);
    const yogoCode = categoryCode ? categoryCode.slice(0, 2).padStart(2, "0") : "-";
    const mappedCategoryName = yogoCode === "-" ? "" : categoryCodeMap.get(yogoCode) || "";
    return {
      id: row.id,
      sku: row.product_code,
      barcode: row.product_no || "",
      nameZh: row.name_cn || "",
      nameEs: row.name_es || "",
      casePack: row.case_pack ?? null,
      cartonPack: row.carton_pack ?? null,
      priceText: toNumber(row.source_price)?.toFixed(2) || "-",
      normalDiscountText: discount.normal,
      vipDiscountText: discount.vip,
      category: yogoCode,
      categoryName: mappedCategoryName || "-",
      subcategory: stripLeadingCategoryCode(row.subcategory_name),
      supplier: row.supplier || "",
      hasImage: hasProductImage(row.product_code),
      available: row.source_disabled ? 1 : 0,
      statusText: row.source_disabled ? "下架" : "上架",
      isNewProduct: null,
    };
  });
  const visibleCategoryOptions = Array.from(
    new Set(
      categoryMapRows
        .filter((item) => item.active)
        .map((item) => stripLeadingCategoryCode(item.category_zh))
        .filter((value) => value && value !== "-"),
    ),
  );
  const visibleSupplierOptions = Array.from(
    new Set(
      enabledSupplierRows
        .map((item) => String(item.short_name || "").trim())
        .filter(Boolean),
    ),
  );

  return (
    <AppShell>
      <ProductsManagementClient
        initialRows={initialRows}
        readOnlyMode
        yogoLastUpdatedText={yogoLastUpdatedText}
        visibleCategoryOptions={visibleCategoryOptions}
        visibleSupplierOptions={visibleSupplierOptions}
      />
    </AppShell>
  );
}
