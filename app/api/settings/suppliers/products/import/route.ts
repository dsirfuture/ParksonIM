// @ts-nocheck
import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";

export const runtime = "nodejs";

type ParsedSupplierProduct = {
  sku: string;
  barcode: string;
  nameZh: string;
  nameEs: string;
  casePack: number;
  cartonPack: number | null;
  unitPrice: number | null;
};

const HEADER_ALIASES = {
  sku: ["编码", "商品编码", "产品编码", "sku", "code"],
  barcode: ["条形码", "条码", "barcode"],
  nameZh: ["中文名", "中文名称", "品名", "namezh", "name_cn"],
  nameEs: ["西文名", "西文名称", "西语名", "namees", "name_es"],
  casePack: ["中包数", "中包", "包装数", "casepack", "case_pack"],
  cartonPack: ["装箱数", "装箱", "cartonpack", "carton_pack"],
  unitPrice: ["单价", "价格", "price", "unitprice", "unit_price"],
};

function text(value: unknown) {
  return String(value ?? "").replace(/\r?\n/g, " ").trim();
}

function normalizeHeader(value: string) {
  return value.replace(/\s+/g, "").replace(/[：:]/g, "").trim().toLowerCase();
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function toInt(value: unknown) {
  const parsed = toNumber(value);
  if (parsed === null) return null;
  if (!Number.isInteger(parsed)) return null;
  return parsed;
}

function findHeaderRow(rows: unknown[][]) {
  return rows.findIndex((row) => {
    const cols = row.map((cell) => normalizeHeader(text(cell)));
    const hasSku = HEADER_ALIASES.sku.some((item) => cols.includes(normalizeHeader(item)));
    const hasCasePack = HEADER_ALIASES.casePack.some((item) => cols.includes(normalizeHeader(item)));
    return hasSku && hasCasePack;
  });
}

function findIndex(header: string[], aliases: string[]) {
  const normalizedAliases = aliases.map((item) => normalizeHeader(item));
  return header.findIndex((item) => normalizedAliases.includes(normalizeHeader(item)));
}

function parseRows(matrix: unknown[][]) {
  const headerRowIndex = findHeaderRow(matrix);
  if (headerRowIndex < 0) {
    throw new Error("未识别到导入表头，请检查“编码”和“中包数”列");
  }

  const header = (matrix[headerRowIndex] || []).map((cell) => text(cell));
  const index = {
    sku: findIndex(header, HEADER_ALIASES.sku),
    barcode: findIndex(header, HEADER_ALIASES.barcode),
    nameZh: findIndex(header, HEADER_ALIASES.nameZh),
    nameEs: findIndex(header, HEADER_ALIASES.nameEs),
    casePack: findIndex(header, HEADER_ALIASES.casePack),
    cartonPack: findIndex(header, HEADER_ALIASES.cartonPack),
    unitPrice: findIndex(header, HEADER_ALIASES.unitPrice),
  };

  if (index.sku < 0 || index.casePack < 0) {
    throw new Error("导入表必须包含“编码”和“中包数”列");
  }

  const rows = new Map<string, ParsedSupplierProduct>();

  for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
    const row = matrix[rowIndex] || [];
    const sku = text(row[index.sku]);
    const barcode = index.barcode >= 0 ? text(row[index.barcode]) : "";
    const nameZh = index.nameZh >= 0 ? text(row[index.nameZh]) : "";
    const nameEs = index.nameEs >= 0 ? text(row[index.nameEs]) : "";
    const casePack = toInt(row[index.casePack]);
    const cartonPack = index.cartonPack >= 0 ? toInt(row[index.cartonPack]) : null;
    const unitPrice = index.unitPrice >= 0 ? toNumber(row[index.unitPrice]) : null;

    if (!sku && !barcode && !nameZh && !nameEs && casePack === null && cartonPack === null && unitPrice === null) {
      continue;
    }

    if (!sku) {
      throw new Error(`第 ${rowIndex + 1} 行缺少“编码”`);
    }

    if (casePack === null) {
      throw new Error(`第 ${rowIndex + 1} 行缺少有效的“中包数”`);
    }

    rows.set(sku, {
      sku,
      barcode,
      nameZh,
      nameEs,
      casePack,
      cartonPack,
      unitPrice,
    });
  }

  return Array.from(rows.values());
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    }

    const allowed = await hasPermission(session, "manageSuppliers");
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const supplierId = String(formData.get("supplierId") || "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "请选择导入文件" }, { status: 400 });
    }

    if (!supplierId) {
      return NextResponse.json({ ok: false, error: "缺少供应商" }, { status: 400 });
    }

    const supplier = await prisma.supplierProfile.findFirst({
      where: {
        id: supplierId,
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      select: {
        id: true,
        short_name: true,
        full_name: true,
      },
    });

    if (!supplier) {
      return NextResponse.json({ ok: false, error: "供应商不存在" }, { status: 404 });
    }

    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes, { type: "array" });
    if (workbook.SheetNames.length === 0) {
      return NextResponse.json({ ok: false, error: "未找到工作表" }, { status: 400 });
    }

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json(firstSheet, {
      header: 1,
      raw: false,
      defval: "",
    }) as unknown[][];

    const parsedRows = parseRows(matrix);
    if (parsedRows.length === 0) {
      return NextResponse.json({ ok: false, error: "未识别到可导入的数据" }, { status: 400 });
    }

    const batchId = `supplier-import-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const skuList = parsedRows.map((item) => item.sku);
    const existingRows = await prisma.supplierProductSource.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        supplier_profile_id: supplier.id,
        sku: { in: skuList },
      },
      select: {
        id: true,
        sku: true,
      },
    });
    const existingMap = new Map(existingRows.map((item) => [item.sku, item.id]));

    let createdCount = 0;
    let updatedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const row of parsedRows) {
        const data = {
          supplier_name: supplier.short_name || supplier.full_name || "",
          barcode: row.barcode || null,
          name_zh: row.nameZh || null,
          name_es: row.nameEs || null,
          case_pack: row.casePack,
          carton_pack: row.cartonPack,
          unit_price: row.unitPrice,
          last_import_batch: batchId,
        };

        const existingId = existingMap.get(row.sku);
        if (existingId) {
          updatedCount += 1;
          await tx.supplierProductSource.update({
            where: { id: existingId },
            data,
          });
        } else {
          createdCount += 1;
          await tx.supplierProductSource.create({
            data: {
              tenant_id: session.tenantId,
              company_id: session.companyId,
              supplier_profile_id: supplier.id,
              sku: row.sku,
              ...data,
            },
          });
        }
      }
    });

    return NextResponse.json({
      ok: true,
      total: parsedRows.length,
      createdCount,
      updatedCount,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "导入供应商产品资料失败" },
      { status: 500 },
    );
  }
}
