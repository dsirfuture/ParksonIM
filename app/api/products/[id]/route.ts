import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";

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

function percentText(value: unknown) {
  const num = normalizeNumber(value);
  if (num === null) return "-";
  return `${Number.isInteger(num) ? num : num.toFixed(2)}%`;
}

function hasProductImage(sku: string) {
  const normalized = String(sku || "").trim();
  if (!normalized) return false;
  const imagePath = path.join(process.cwd(), "public", "products", `${normalized}.jpg`);
  return fs.existsSync(imagePath);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    }
    if (!(await hasPermission(session, "manageProducts"))) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const { id } = await params;
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
      statusText?: unknown;
      isNewProduct?: unknown;
      inventory?: unknown;
    };

    const target = await prisma.productCatalog.findFirst({
      where: {
        id,
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json({ ok: false, error: "记录不存在" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if ("sku" in body) data.sku = normalizeString(body.sku) || "";
    if ("barcode" in body) data.barcode = normalizeString(body.barcode);
    if ("nameZh" in body) data.name_zh = normalizeString(body.nameZh);
    if ("nameEs" in body) data.name_es = normalizeString(body.nameEs);
    if ("casePack" in body) data.case_pack = normalizeInt(body.casePack);
    if ("cartonPack" in body) data.carton_pack = normalizeInt(body.cartonPack);
    if ("price" in body) data.price = normalizeNumber(body.price);
    if ("normalDiscount" in body) data.normal_discount = normalizeNumber(body.normalDiscount);
    if ("vipDiscount" in body) data.vip_discount = normalizeNumber(body.vipDiscount);
    if ("category" in body) data.category = normalizeCategory(body.category);
    if ("supplier" in body) data.supplier = normalizeString(body.supplier);
    if ("isNewProduct" in body) data.is_new_product = Boolean(body.isNewProduct);
    if ("inventory" in body) data.inventory = normalizeInt(body.inventory);

    if ("available" in body) {
      const available = normalizeInt(body.available) ?? 0;
      data.available = available;
      data.status_text = available === 1 ? "下架" : "上架";
    } else if ("statusText" in body && typeof body.statusText === "string") {
      data.status_text = body.statusText;
    }

    const updated = await prisma.productCatalog.update({
      where: { id: target.id },
      data,
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: updated.id,
        sku: updated.sku,
        barcode: updated.barcode || "",
        nameZh: updated.name_zh || "",
        nameEs: updated.name_es || "",
        casePack: updated.case_pack ?? null,
        cartonPack: updated.carton_pack ?? null,
        priceText:
          updated.price !== null && updated.price !== undefined
            ? Number(updated.price).toFixed(2)
            : "-",
        normalDiscountText: percentText(updated.normal_discount),
        vipDiscountText: percentText(updated.vip_discount),
        category: normalizeCategory(updated.category) || "",
        supplier: updated.supplier || "",
        hasImage: hasProductImage(updated.sku),
        available: updated.available,
        statusText: updated.status_text,
        isNewProduct: updated.is_new_product,
        changedFields: [],
        inventory: updated.inventory ?? null,
        updatedAt: updated.updated_at.toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "保存失败" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    }
    if (!(await hasPermission(session, "manageProducts"))) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const { id } = await params;
    const target = await prisma.productCatalog.findFirst({
      where: {
        id,
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      select: { id: true },
    });

    if (!target) {
      return NextResponse.json({ ok: false, error: "记录不存在" }, { status: 404 });
    }

    await prisma.productCatalog.delete({ where: { id: target.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "删除失败" },
      { status: 500 },
    );
  }
}
