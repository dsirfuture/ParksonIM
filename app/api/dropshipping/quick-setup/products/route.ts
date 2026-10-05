// @ts-nocheck
import { NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import { hasAppPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { hasLocalProductImage } from "@/lib/local-product-image";
import {
  extractCategoryCode,
  parseYogoDiscountParts,
  stripLeadingCategoryCode,
} from "@/lib/yogo-product-utils";

function hasProductImage(sku: string) {
  return hasLocalProductImage(sku, "jpg");
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  }
  if (!(await hasAppPermission(session, "dropshipping.quick_setup.product_selection.view"))) {
    return NextResponse.json({ ok: false, error: "您暂无访问该页面的权限" }, { status: 403 });
  }

  const url = new URL(req.url);
  const keyword = String(url.searchParams.get("keyword") || "").trim();
  const platform = String(url.searchParams.get("platform") || "").trim();
  const category = String(url.searchParams.get("category") || "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = 10;

  const where = {
    tenant_id: session.tenantId,
    company_id: session.companyId,
    source_disabled: false,
    ...(keyword
      ? {
          OR: [
            { product_code: { contains: keyword, mode: "insensitive" } },
            { product_no: { contains: keyword, mode: "insensitive" } },
            { name_cn: { contains: keyword, mode: "insensitive" } },
            { name_es: { contains: keyword, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, categoryMapRows] = await Promise.all([
    prisma.yogoProductSource.findMany({
      where,
      orderBy: [{ updated_at: "desc" }, { product_code: "asc" }],
    }),
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
      },
    }),
  ]);

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

  const mappedRows = rows.map((row) => {
    const categoryCode = extractCategoryCode(row.category_name);
    const yogoCode = categoryCode ? categoryCode.slice(0, 2).padStart(2, "0") : "-";
    const mappedCategoryName = yogoCode === "-" ? "" : categoryCodeMap.get(yogoCode) || "";
    const discount = parseYogoDiscountParts(row.category_name, row.source_discount);
    return {
      id: row.id,
      platform,
      sku: row.product_code,
      barcode: row.product_no || "",
      nameZh: row.name_cn || "",
      nameEs: row.name_es || "",
      casePack: row.case_pack ?? null,
      cartonPack: row.carton_pack ?? null,
      price: row.source_price ? Number(row.source_price) : null,
      category: yogoCode,
      categoryName: mappedCategoryName || "-",
      subcategory: stripLeadingCategoryCode(row.subcategory_name) || "-",
      hasImage: hasProductImage(row.product_code),
      normalDiscount: discount.normal,
      vipDiscount: discount.vip,
    };
  });

  const filteredRows = category
    ? mappedRows.filter((row) => String(row.categoryName || "").trim() === category)
    : mappedRows;
  const total = filteredRows.length;
  const pagedRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const categoryOptions = Array.from(
    new Set(
      mappedRows
        .map((row) => String(row.categoryName || "").trim())
        .filter((value) => value && value !== "-"),
    ),
  ).sort((a, b) => a.localeCompare(b, "zh-CN"));

  return NextResponse.json({
    ok: true,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    categoryOptions,
    items: pagedRows,
  });
}
