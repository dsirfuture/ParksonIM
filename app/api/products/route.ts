import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { hasPermission } from "@/lib/permissions";
import { hasLocalProductImage } from "@/lib/local-product-image";
import { getSession } from "@/lib/tenant";

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
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
  return hasLocalProductImage(sku, "jpg");
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text : null;
}

function normalizeCategory(value: unknown) {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  const cleaned = normalized.replace(/\s+/g, " ").trim();
  return cleaned || null;
}

function normalizeInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).trim());
  if (!Number.isFinite(parsed)) return null;
  return Math.trunc(parsed);
}

function normalizeNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).trim());
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    }
    if (!(await hasPermission(session, "manageProducts"))) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get("keyword")?.trim() || "";

    const rows = await withPrismaRetry(() =>
      prisma.productCatalog.findMany({
        where: {
          tenant_id: session.tenantId,
          company_id: session.companyId,
          ...(keyword
            ? {
                OR: [
                  { sku: { contains: keyword, mode: "insensitive" } },
                  { barcode: { contains: keyword, mode: "insensitive" } },
                  { name_zh: { contains: keyword, mode: "insensitive" } },
                  { name_es: { contains: keyword, mode: "insensitive" } },
                  { category: { contains: keyword, mode: "insensitive" } },
                  { supplier: { contains: keyword, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: [{ updated_at: "desc" }, { sku: "asc" }],
      }),
    );

    return NextResponse.json({
      ok: true,
      items: rows.map((row) => ({
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
        changedFields: Array.isArray(row.changed_fields)
          ? row.changed_fields.filter(
              (item): item is string =>
                typeof item === "string" && item.trim() !== "新增产品",
            )
          : [],
        inventory: row.inventory ?? null,
        updatedAt: row.updated_at.toISOString(),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "读取失败" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    }
    if (!(await hasPermission(session, "manageProducts"))) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const body = (await request.json()) as {
      sku?: unknown;
      barcode?: unknown;
      nameZh?: unknown;
      nameEs?: unknown;
      casePack?: unknown;
      cartonPack?: unknown;
      price?: unknown;
      normalDiscount?: unknown;
      vipDiscount?: unknown;
      category?: unknown;
      supplier?: unknown;
      available?: unknown;
      isNewProduct?: unknown;
    };

    const sku = normalizeString(body.sku);
    if (!sku) {
      return NextResponse.json({ ok: false, error: "SKU不能为空" }, { status: 400 });
    }

    const available = normalizeInt(body.available) ?? 1;
    const created = await prisma.productCatalog.create({
      data: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        sku,
        barcode: normalizeString(body.barcode),
        name_zh: normalizeString(body.nameZh),
        name_es: normalizeString(body.nameEs),
        case_pack: normalizeInt(body.casePack),
        carton_pack: normalizeInt(body.cartonPack),
        price: normalizeNumber(body.price),
        normal_discount: normalizeNumber(body.normalDiscount),
        vip_discount: normalizeNumber(body.vipDiscount),
        category: normalizeCategory(body.category),
        supplier: normalizeString(body.supplier),
        available,
        status_text: available === 1 ? "下架" : "上架",
        is_new_product: Boolean(body.isNewProduct),
        changed_fields: [],
      },
    });

    return NextResponse.json({ ok: true, id: created.id });
  } catch (error) {
    if (error instanceof Error && /unique/i.test(error.message)) {
      return NextResponse.json({ ok: false, error: "SKU已存在" }, { status: 409 });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "新增失败" },
      { status: 500 },
    );
  }
}
