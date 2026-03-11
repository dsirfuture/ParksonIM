import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";

export const runtime = "nodejs";

function safeFileName(name: string) {
  const normalized = String(name || "products.xlsx").trim();
  return normalized.replace(/[\\/:*?"<>|]+/g, "_");
}

type ParsedProduct = {
  sku: string;
  barcode: string;
  nameZh: string;
  nameEs: string;
  casePack: number | null;
  cartonPack: number | null;
  price: number | null;
  normalDiscount: number | null;
  vipDiscount: number | null;
  category: string;
  supplier: string;
  available: number;
  statusText: "上架" | "下架";
  inventory: number | null;
};

function text(value: unknown) {
  return String(value ?? "").replace(/\r?\n/g, " ").trim();
}

function normalizeHeader(value: string) {
  return value.replace(/\s+/g, "").replace(/[：:]/g, "").trim().toLowerCase();
}

function num(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function int(value: unknown) {
  const parsed = num(value);
  if (parsed === null) return null;
  return Math.trunc(parsed);
}

function parsePercent(raw: string) {
  const value = raw.trim();
  if (!value) return null;
  // VIP 折扣只保留个位数百分比：
  // 例如 23% -> 3%，5% -> 5%。
  // 若字符串里有多个百分比，仍取最后一个百分比片段。
  const matches = Array.from(value.matchAll(/(\d+(?:\.\d+)?)\s*%/g));
  if (matches.length === 0) return null;
  const lastPercentText = matches[matches.length - 1][1];
  const digits = lastPercentText.replace(/\D/g, "");
  if (!digits) return null;
  return Number(digits[digits.length - 1]);
}

function keepCategoryText(raw: string) {
  return raw.replace(/\s+/g, " ").trim();
}

const HEADER_ALIASES = {
  available: ["可用", "上架"],
  supplier: ["位置", "供应商", "vendor"],
  sku: ["编号", "sku", "货号"],
  barcode: ["条形码", "条码", "barcode"],
  name: ["品名", "中文品名", "中文名", "商品名"],
  nameEs: ["西文品名", "西文名", "namees"],
  casePack: ["包装数", "包装"],
  cartonPack: ["装箱数", "装箱"],
  price: ["卖价1", "卖价", "价格"],
  normalDiscount: ["折扣", "普通折扣"],
  vipSource: ["主目录", "vip折扣"],
  category: ["子目录", "分类"],
  inventory: ["库存"],
};

function findHeaderRow(rows: unknown[][]) {
  return rows.findIndex((row) => {
    const cols = row.map((cell) => normalizeHeader(text(cell)));
    const hasSku = HEADER_ALIASES.sku.some((k) => cols.includes(normalizeHeader(k)));
    const hasBarcode = HEADER_ALIASES.barcode.some((k) => cols.includes(normalizeHeader(k)));
    const hasName = HEADER_ALIASES.name.some((k) => cols.includes(normalizeHeader(k)));
    return hasSku && hasBarcode && hasName;
  });
}

function findIndex(header: string[], aliases: string[]) {
  const normAliases = aliases.map((item) => normalizeHeader(item));
  return header.findIndex((item) => normAliases.includes(normalizeHeader(item)));
}

function parseRows(matrix: unknown[][]): ParsedProduct[] {
  const headerRowIndex = findHeaderRow(matrix);
  if (headerRowIndex < 0) return [];

  const header = (matrix[headerRowIndex] || []).map((cell) => text(cell));
  const index = {
    available: findIndex(header, HEADER_ALIASES.available),
    supplier: findIndex(header, HEADER_ALIASES.supplier),
    sku: findIndex(header, HEADER_ALIASES.sku),
    barcode: findIndex(header, HEADER_ALIASES.barcode),
    name: findIndex(header, HEADER_ALIASES.name),
    nameEs: findIndex(header, HEADER_ALIASES.nameEs),
    casePack: findIndex(header, HEADER_ALIASES.casePack),
    cartonPack: findIndex(header, HEADER_ALIASES.cartonPack),
    price: findIndex(header, HEADER_ALIASES.price),
    normalDiscount: findIndex(header, HEADER_ALIASES.normalDiscount),
    vipSource: findIndex(header, HEADER_ALIASES.vipSource),
    category: findIndex(header, HEADER_ALIASES.category),
    inventory: findIndex(header, HEADER_ALIASES.inventory),
  };

  if (index.sku < 0 || index.barcode < 0 || index.name < 0) return [];

  const result: ParsedProduct[] = [];
  for (let i = headerRowIndex + 1; i < matrix.length; i += 1) {
    const row = matrix[i] || [];
    const normalizedRow = row.map((cell) => normalizeHeader(text(cell)));
    const rowText = row.map((cell) => text(cell)).join(" ").trim();

    // 过滤“打印/时间”等非数据整行
    const isMetaRow =
      /打印|打印时间|时间|日期|页码|page|print/i.test(rowText) &&
      !/\d{6,}/.test(rowText);
    if (isMetaRow) continue;

    // 过滤表格中间重复出现的标题行（与表头同名）
    const sameHeaderCount = [
      index.available,
      index.supplier,
      index.sku,
      index.barcode,
      index.name,
      index.casePack,
      index.cartonPack,
      index.price,
      index.normalDiscount,
      index.vipSource,
      index.category,
      index.inventory,
    ]
      .filter((idx) => idx >= 0)
      .filter((idx) => normalizedRow[idx] === normalizeHeader(header[idx] || ""))
      .length;
    if (sameHeaderCount >= 4) continue;

    const sku = text(row[index.sku]);
    const barcode = text(row[index.barcode]);
    const name = text(row[index.name]);

    // Skip repeated header rows in the middle of sheet.
    if (
      HEADER_ALIASES.sku.some((k) => normalizeHeader(sku) === normalizeHeader(k)) &&
      HEADER_ALIASES.barcode.some((k) => normalizeHeader(barcode) === normalizeHeader(k))
    ) {
      continue;
    }

    if (!sku && !barcode && !name) continue;
    if (!sku) continue;

    const available = int(row[index.available]) ?? 0;
    const statusText = available === 1 ? "下架" : "上架";
    const normalDiscount = num(row[index.normalDiscount]);
    const vipRaw =
      index.vipSource >= 0 ? text(row[index.vipSource]) : "";
    const vipDiscount = parsePercent(vipRaw);
    const inventory = int(row[index.inventory]);

    // 过滤库存异常数据：库存大于 3000 的行不导入
    if (inventory !== null && inventory > 3000) {
      continue;
    }

    result.push({
      sku,
      barcode,
      nameZh: name,
      nameEs: index.nameEs >= 0 ? text(row[index.nameEs]) : "",
      casePack: int(row[index.casePack]),
      cartonPack: int(row[index.cartonPack]),
      price: num(row[index.price]),
      normalDiscount,
      vipDiscount,
      category: index.category >= 0 ? keepCategoryText(text(row[index.category])) : "",
      supplier: index.supplier >= 0 ? text(row[index.supplier]) : "",
      available,
      statusText,
      inventory,
    });
  }

  return result;
}

function changedFields(next: ParsedProduct, prev: {
  barcode: string | null;
  case_pack: number | null;
  carton_pack: number | null;
  price: unknown;
  available: number;
}) {
  const fields: string[] = [];
  const prevPrice =
    typeof prev.price === "number"
      ? prev.price
      : prev.price && typeof prev.price === "object" && "toNumber" in prev.price
        ? (prev.price as { toNumber: () => number }).toNumber()
        : Number(prev.price);

  if ((prev.barcode || "") !== next.barcode) fields.push("条形码");
  if ((prev.case_pack ?? null) !== (next.casePack ?? null)) fields.push("包装数");
  if ((prev.carton_pack ?? null) !== (next.cartonPack ?? null)) fields.push("装箱数");
  if ((Number.isFinite(prevPrice) ? prevPrice : null) !== (next.price ?? null)) fields.push("卖价");
  if ((prev.available ?? 0) !== next.available) fields.push("上架状态");

  return fields;
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
    const modeRaw = String(formData.get("mode") || "compare").trim().toLowerCase();
    const mode: "initial" | "compare" = modeRaw === "initial" ? "initial" : "compare";
    const duplicateStrategyRaw = String(formData.get("duplicateStrategy") || "").trim().toLowerCase();
    const duplicateStrategy: "first" | "last" | null =
      duplicateStrategyRaw === "first" || duplicateStrategyRaw === "last"
        ? duplicateStrategyRaw
        : null;
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "请先选择文件" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes, { type: "array" });
    if (workbook.SheetNames.length === 0) {
      return NextResponse.json({ ok: false, error: "未找到工作表" }, { status: 400 });
    }

    let parsed: ParsedProduct[] = [];
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
      return NextResponse.json({ ok: false, error: "未识别到产品数据" }, { status: 400 });
    }

    const duplicateMap = new Map<string, number>();
    for (const item of parsed) {
      duplicateMap.set(item.sku, (duplicateMap.get(item.sku) || 0) + 1);
    }
    const duplicateSkus = Array.from(duplicateMap.entries())
      .filter(([, count]) => count > 1)
      .map(([sku, count]) => ({ sku, count }));

    if (duplicateSkus.length > 0 && !duplicateStrategy) {
      return NextResponse.json(
        {
          ok: false,
          needsResolution: true,
          resolutionType: "duplicate_sku",
          error: "检测到重复 SKU，请先选择保留策略",
          duplicateSkus,
        },
        { status: 409 },
      );
    }

    if (duplicateSkus.length > 0 && duplicateStrategy) {
      const seen = new Set<string>();
      const source = duplicateStrategy === "first" ? parsed : [...parsed].reverse();
      const deduped: ParsedProduct[] = [];
      for (const item of source) {
        if (seen.has(item.sku)) continue;
        seen.add(item.sku);
        deduped.push(item);
      }
      parsed = duplicateStrategy === "first" ? deduped : deduped.reverse();
    }

    const skuList = [...new Set(parsed.map((item) => item.sku))];

    const existing = await prisma.productCatalog.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        sku: { in: skuList },
      },
      select: {
        id: true,
        sku: true,
        barcode: true,
        case_pack: true,
        carton_pack: true,
        price: true,
        available: true,
      },
    });

    const existingMap = new Map(existing.map((item) => [item.sku, item]));

    let createdCount = 0;
    let changedCount = 0;
    let unchangedCount = 0;
    let updatedCount = 0;
    let onShelfCount = 0;
    let offShelfCount = 0;

    const updates = parsed.map((item) => {
      const prev = existingMap.get(item.sku);
      if (mode === "compare") {
        if (item.statusText === "上架") onShelfCount += 1;
        if (item.statusText === "下架") offShelfCount += 1;
      }

      if (!prev) {
        createdCount += 1;
        const defaultAvailable = mode === "initial" ? 1 : item.available;
        const defaultStatusText = mode === "initial" ? "下架" : item.statusText;
        return prisma.productCatalog.create({
          data: {
            tenant_id: session.tenantId,
            company_id: session.companyId,
            sku: item.sku,
            barcode: item.barcode || null,
            name_zh: item.nameZh || null,
            name_es: item.nameEs || null,
            case_pack: item.casePack,
            carton_pack: item.cartonPack,
            price: item.price,
            normal_discount: item.normalDiscount,
            vip_discount: item.vipDiscount,
            category: item.category || null,
            supplier: item.supplier || null,
            available: defaultAvailable,
            status_text: defaultStatusText,
            is_new_product: mode === "compare",
            changed_fields: [],
            inventory: item.inventory,
          },
        });
      }

      if (mode === "initial") {
        updatedCount += 1;
        return prisma.productCatalog.update({
          where: { id: prev.id },
          data: {
            barcode: item.barcode || null,
            name_zh: item.nameZh || null,
            name_es: item.nameEs || null,
            case_pack: item.casePack,
            carton_pack: item.cartonPack,
            price: item.price,
            normal_discount: item.normalDiscount,
            vip_discount: item.vipDiscount,
            category: item.category || null,
            supplier: item.supplier || null,
            available: 1,
            status_text: "下架",
            is_new_product: false,
            changed_fields: [],
            inventory: item.inventory,
          },
        });
      }

      const fields = changedFields(item, prev);
      if (fields.length > 0) changedCount += 1;
      else unchangedCount += 1;

      return prisma.productCatalog.update({
        where: { id: prev.id },
        data: {
          barcode: item.barcode || null,
          name_zh: item.nameZh || null,
          name_es: item.nameEs || null,
          case_pack: item.casePack,
          carton_pack: item.cartonPack,
          price: item.price,
          normal_discount: item.normalDiscount,
          vip_discount: item.vipDiscount,
          category: item.category || null,
          supplier: item.supplier || null,
          available: item.available,
          status_text: item.statusText,
          is_new_product: false,
          changed_fields: fields,
          inventory: item.inventory,
        },
      });
    });

    const batchId = randomUUID();
    const uploadsDir = path.join(
      process.cwd(),
      "storage",
      "product-imports",
      session.tenantId,
      session.companyId,
    );
    await fs.mkdir(uploadsDir, { recursive: true });
    const storedFileName = `${batchId}-${safeFileName(file.name || "products.xlsx")}`;
    const storedFilePath = path.join(uploadsDir, storedFileName);
    await fs.writeFile(storedFilePath, Buffer.from(bytes));

    const batch = await prisma.productImportBatch.create({
      data: {
        id: batchId,
        tenant_id: session.tenantId,
        company_id: session.companyId,
        source_file_name: file.name || "products.xlsx",
        stored_file_path: storedFilePath,
        total_rows: parsed.length,
        created_count: createdCount,
        changed_count: changedCount,
        unchanged_count: mode === "initial" ? updatedCount : unchangedCount,
        on_shelf_count: onShelfCount,
        off_shelf_count: offShelfCount,
        created_by: session.userId || null,
      },
      select: { id: true },
    });

    await prisma.$transaction([
      ...updates,
      prisma.productCatalog.updateMany({
        where: {
          tenant_id: session.tenantId,
          company_id: session.companyId,
          sku: { in: skuList },
        },
        data: {
          last_import_batch: batch.id,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      summary: {
        mode,
        totalRows: parsed.length,
        createdCount,
        changedCount: mode === "initial" ? 0 : changedCount,
        unchangedCount: mode === "initial" ? updatedCount : unchangedCount,
        updatedCount,
        onShelfCount,
        offShelfCount,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "导入失败" },
      { status: 500 },
    );
  }
}
