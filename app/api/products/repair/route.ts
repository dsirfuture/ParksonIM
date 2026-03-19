// @ts-nocheck
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";

type RepairRow = {
  sku: string;
  barcode?: string | null;
  nameZh?: string | null;
  nameEs?: string | null;
  casePack?: number | null;
  cartonPack?: number | null;
  price?: number | null;
  normalDiscount?: number | null;
  vipDiscount?: number | null;
  category?: string | null;
  supplier?: string | null;
  available?: number | null;
  isNewProduct?: boolean;
};

const HEADER_ALIASES: Record<string, string[]> = {
  sku: ["编号", "sku", "货号"],
  barcode: ["条形码", "条码", "barcode"],
  nameZh: ["中文名", "中文品名", "品名"],
  nameEs: ["西文名", "西文品名"],
  casePack: ["包装数", "包装"],
  cartonPack: ["装箱数", "装箱"],
  price: ["卖价", "卖价1", "价格"],
  normalDiscount: ["普通折扣", "折扣"],
  vipDiscount: ["VIP折扣", "vip折扣"],
  category: ["分类", "子目录"],
  supplier: ["供应商", "位置", "vendor"],
  status: ["是否上架", "可用", "上架状态"],
  isNew: ["是否新增", "变化", "标记"],
};

function text(value: unknown) {
  return String(value ?? "").replace(/\r?\n/g, " ").trim();
}

function normalizeHeader(value: string) {
  return value.replace(/\s+/g, "").trim().toLowerCase();
}

function findIndex(headers: string[], aliases: string[]) {
  const target = aliases.map((a) => normalizeHeader(a));
  return headers.findIndex((h) => target.includes(normalizeHeader(h)));
}

function toNumber(raw: string) {
  if (!raw) return null;
  const v = Number(raw.replace(/,/g, "").replace(/%/g, "").trim());
  return Number.isFinite(v) ? v : null;
}

function toInt(raw: string) {
  const n = toNumber(raw);
  return n === null ? null : Math.trunc(n);
}

function toAvailable(raw: string) {
  const v = text(raw).toLowerCase();
  if (!v) return null;
  if (v === "0" || v.includes("上架")) return 0;
  if (v === "1" || v.includes("下架")) return 1;
  return null;
}

function toIsNew(raw: string) {
  const v = text(raw);
  if (!v) return undefined;
  return v === "新";
}

function parseRows(matrix: unknown[][]): RepairRow[] {
  if (matrix.length === 0) return [];
  const headers = (matrix[0] || []).map((c) => text(c));
  const idx = {
    sku: findIndex(headers, HEADER_ALIASES.sku),
    barcode: findIndex(headers, HEADER_ALIASES.barcode),
    nameZh: findIndex(headers, HEADER_ALIASES.nameZh),
    nameEs: findIndex(headers, HEADER_ALIASES.nameEs),
    casePack: findIndex(headers, HEADER_ALIASES.casePack),
    cartonPack: findIndex(headers, HEADER_ALIASES.cartonPack),
    price: findIndex(headers, HEADER_ALIASES.price),
    normalDiscount: findIndex(headers, HEADER_ALIASES.normalDiscount),
    vipDiscount: findIndex(headers, HEADER_ALIASES.vipDiscount),
    category: findIndex(headers, HEADER_ALIASES.category),
    supplier: findIndex(headers, HEADER_ALIASES.supplier),
    status: findIndex(headers, HEADER_ALIASES.status),
    isNew: findIndex(headers, HEADER_ALIASES.isNew),
  };
  if (idx.sku < 0) return [];

  const rows: RepairRow[] = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const row = matrix[i] || [];
    const sku = text(row[idx.sku]);
    if (!sku) continue;
    rows.push({
      sku,
      barcode: idx.barcode >= 0 ? text(row[idx.barcode]) || null : undefined,
      nameZh: idx.nameZh >= 0 ? text(row[idx.nameZh]) || null : undefined,
      nameEs: idx.nameEs >= 0 ? text(row[idx.nameEs]) || null : undefined,
      casePack: idx.casePack >= 0 ? toInt(text(row[idx.casePack])) : undefined,
      cartonPack: idx.cartonPack >= 0 ? toInt(text(row[idx.cartonPack])) : undefined,
      price: idx.price >= 0 ? toNumber(text(row[idx.price])) : undefined,
      normalDiscount:
        idx.normalDiscount >= 0 ? toNumber(text(row[idx.normalDiscount])) : undefined,
      vipDiscount: idx.vipDiscount >= 0 ? toNumber(text(row[idx.vipDiscount])) : undefined,
      category: idx.category >= 0 ? text(row[idx.category]) || null : undefined,
      supplier: idx.supplier >= 0 ? text(row[idx.supplier]) || null : undefined,
      available: idx.status >= 0 ? toAvailable(text(row[idx.status])) : undefined,
      isNewProduct: idx.isNew >= 0 ? toIsNew(text(row[idx.isNew])) : undefined,
    });
  }
  return rows;
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

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "请先选择文件" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes, { type: "array" });
    if (workbook.SheetNames.length === 0) {
      return NextResponse.json({ ok: false, error: "未找到工作表" }, { status: 400 });
    }

    let parsed: RepairRow[] = [];
    for (const sheetName of workbook.SheetNames) {
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
        header: 1,
        raw: false,
        defval: "",
        blankrows: false,
      });
      const current = parseRows(matrix);
      if (current.length > parsed.length) parsed = current;
    }
    if (parsed.length === 0) {
      return NextResponse.json({ ok: false, error: "未识别到可修复的数据" }, { status: 400 });
    }

    const skuSet = [...new Set(parsed.map((r) => r.sku))];
    const existed = await prisma.productCatalog.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        sku: { in: skuSet },
      },
      select: { id: true, sku: true },
    });
    const existedMap = new Map(existed.map((r) => [r.sku, r.id]));

    let updatedCount = 0;
    let skippedCount = 0;
    const updates = parsed.flatMap((row) => {
      const id = existedMap.get(row.sku);
      if (!id) {
        skippedCount += 1;
        return [];
      }
      const data: Record<string, unknown> = {};
      if (row.barcode !== undefined) data.barcode = row.barcode;
      if (row.nameZh !== undefined) data.name_zh = row.nameZh;
      if (row.nameEs !== undefined) data.name_es = row.nameEs;
      if (row.casePack !== undefined) data.case_pack = row.casePack;
      if (row.cartonPack !== undefined) data.carton_pack = row.cartonPack;
      if (row.price !== undefined) data.price = row.price;
      if (row.normalDiscount !== undefined) data.normal_discount = row.normalDiscount;
      if (row.vipDiscount !== undefined) data.vip_discount = row.vipDiscount;
      if (row.category !== undefined) data.category = row.category;
      if (row.supplier !== undefined) data.supplier = row.supplier;
      if (row.available !== undefined && row.available !== null) {
        data.available = row.available;
        data.status_text = row.available === 1 ? "下架" : "上架";
      }
      if (row.isNewProduct !== undefined) data.is_new_product = row.isNewProduct;
      if (Object.keys(data).length === 0) {
        skippedCount += 1;
        return [];
      }
      updatedCount += 1;
      return [prisma.productCatalog.update({ where: { id }, data })];
    });

    if (updates.length > 0) {
      await prisma.$transaction(updates);
    }

    return NextResponse.json({
      ok: true,
      summary: {
        totalRows: parsed.length,
        updatedCount,
        skippedCount,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "修复失败" },
      { status: 500 },
    );
  }
}
