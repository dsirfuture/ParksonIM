import { redirect } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";
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

function pctText(value: unknown) {
  const num = toNumber(value);
  if (num === null) return "-";
  return `${Number.isInteger(num) ? num : num.toFixed(2)}%`;
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

export default async function ProductsManagementPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await hasPermission(session, "manageProducts"))) redirect("/dashboard");

  const rows = await withPrismaRetry(() =>
    prisma.productCatalog.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      orderBy: [{ updated_at: "desc" }, { sku: "asc" }],
    }),
  );

  const initialRows = rows.map((row) => ({
    id: row.id,
    sku: row.sku,
    barcode: row.barcode || "",
    nameZh: row.name_zh || "",
    nameEs: row.name_es || "",
    casePack: row.case_pack ?? null,
    cartonPack: row.carton_pack ?? null,
    priceText: toNumber(row.price)?.toFixed(2) || "-",
    normalDiscountText: pctText(row.normal_discount),
    vipDiscountText: pctText(row.vip_discount),
    category: categoryText(row.category),
    supplier: row.supplier || "",
    hasImage: hasProductImage(row.sku),
    available: row.available,
    statusText: row.status_text,
    isNewProduct: row.is_new_product,
    changedFields:
      Array.isArray(row.changed_fields)
        ? row.changed_fields.filter(
            (item): item is string =>
              typeof item === "string" && item.trim() !== "新增产品",
          )
        : [],
    inventory: row.inventory ?? null,
    updatedAt: row.updated_at.toISOString(),
  }));

  return (
    <AppShell>
      <ProductsManagementClient initialRows={initialRows} />
    </AppShell>
  );
}
