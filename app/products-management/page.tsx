import { redirect } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";
import { parseYogoDiscountParts, stripLeadingCategoryCode } from "@/lib/yogo-product-utils";
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

function categoryText(value: string | null) {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
}

function hasProductImage(sku: string) {
  const normalized = String(sku || "").trim();
  if (!normalized) return false;
  const imagePath = path.join(process.cwd(), "public", "products", `${normalized}.jpg`);
  return fs.existsSync(imagePath);
}

function formatZhDateTime(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}年${m}月${d}日 ${hh}:${mm}`;
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

  const skuList = yogoRows.map((row) => row.product_code);
  const inventoryRows = skuList.length
    ? await withPrismaRetry(() =>
        prisma.productCatalog.findMany({
          where: {
            tenant_id: session.tenantId,
            company_id: session.companyId,
            sku: { in: skuList },
            inventory: { gt: 5000 },
          },
          select: { sku: true },
        }),
      )
    : [];

  const blockedSkuSet = new Set(inventoryRows.map((row) => row.sku));
  const visibleRows = yogoRows.filter((row) => !blockedSkuSet.has(row.product_code));
  // Use `last_received_at` as the primary YOGO sync timestamp because it is
  // written on every successful upsert from /api/sync/products.
  const latestYogoUpdatedAt =
    yogoRows.length > 0
      ? yogoRows.reduce(
          (latest, row) =>
            row.last_received_at > latest ? row.last_received_at : latest,
          yogoRows[0].last_received_at,
        )
      : null;
  const yogoLastUpdatedText = latestYogoUpdatedAt
    ? `最近一次友购产品更新时间是：${formatZhDateTime(latestYogoUpdatedAt)}`
    : "最近一次友购产品更新时间是：暂无";

  const initialRows = visibleRows.map((row) => {
    const discount = parseYogoDiscountParts(row.category_name, row.source_discount);
    return {
      id: row.id,
      sku: row.product_code,
      barcode: row.product_no || "",
      nameZh: row.name_cn || "",
      nameEs: row.name_es || "",
      casePack: null,
      cartonPack: null,
      priceText: toNumber(row.source_price)?.toFixed(2) || "-",
      normalDiscountText: discount.normal,
      vipDiscountText: discount.vip,
      category: categoryText(row.category_name),
      subcategory: stripLeadingCategoryCode(row.subcategory_name),
      supplier: row.supplier || "",
      hasImage: hasProductImage(row.product_code),
      available: row.source_disabled ? 1 : 0,
      statusText: row.source_disabled ? "下架" : "上架",
      isNewProduct: null,
    };
  });

  return (
    <AppShell>
      <ProductsManagementClient
        initialRows={initialRows}
        readOnlyMode
        yogoLastUpdatedText={yogoLastUpdatedText}
      />
    </AppShell>
  );
}
