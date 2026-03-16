import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { importLegacyOrders } from "@/lib/dropshipping";
import type { DsLegacyImportRow } from "@/lib/dropshipping-types";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";

export const runtime = "nodejs";

function text(value: unknown) {
  return String(value ?? "").replace(/\r?\n/g, " ").trim();
}

function headerKey(value: unknown) {
  return text(value)
    .replace(/\s+/g, "")
    .replace(/[：:]/g, "")
    .toLowerCase();
}

function parseNumber(value: unknown) {
  const raw = text(value).replace(/[,$￥¥\s]/g, "");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const normalized = raw.replace(/[年/.]/g, "-").replace(/月/g, "-").replace(/日/g, "");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseShipped(value: unknown) {
  const raw = text(value).toLowerCase();
  return ["已发", "已发货", "是", "yes", "true", "shipped"].some((item) => raw.includes(item));
}

function parseDiscount(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  if (raw.includes("%")) {
    const parsed = parseNumber(raw.replace("%", ""));
    return parsed === null ? null : parsed / 100;
  }
  const parsed = parseNumber(raw);
  if (parsed === null) return null;
  return parsed > 1 ? parsed / 100 : parsed;
}

const COLUMN_ALIASES: Record<keyof DsLegacyImportRow, string[]> = {
  customerName: ["客户名称"],
  platform: ["下单平台"],
  platformOrderNo: ["后台订单号"],
  trackingNo: ["面单物流号", "物流号"],
  shippingLabelFile: ["面单文件"],
  shipped: ["是否发货"],
  shippedAt: ["发货日期"],
  shippingProofFile: ["发货凭据", "发货凭证"],
  sku: ["产品sku", "sku", "产品sku"],
  quantity: ["下单数", "数量"],
  color: ["发货颜色", "颜色"],
  warehouse: ["发货仓", "仓库"],
  shippingFee: ["代发费"],
  productImageUrl: ["产品图"],
  productNameZh: ["产品中文名"],
  unitPrice: ["产品单价"],
  discountRate: ["普通折扣", "普通折扣%"],
  stockedQty: ["备货数量"],
  stockAmount: ["备货总金额"],
  rateValue: ["rmb汇率", "汇率", "rmb汇率"],
  exchangedAmount: ["汇率后金额"],
  shippingAmount: ["代发总金额"],
  totalAmount: ["总金额"],
  paidAmount: ["已付款项"],
  unpaidAmount: ["剩余款项"],
  settledAt: ["结账日期"],
};

function findHeaderRow(rows: unknown[][]) {
  return rows.findIndex((row) => {
    const keys = row.map((cell) => headerKey(cell));
    return (
      keys.includes(headerKey("客户名称")) &&
      keys.includes(headerKey("下单平台")) &&
      keys.includes(headerKey("后台订单号")) &&
      keys.includes(headerKey("产品SKU"))
    );
  });
}

function findColumnIndex(headers: string[], aliases: string[]) {
  const normalizedAliases = aliases.map((item) => headerKey(item));
  return headers.findIndex((item) => normalizedAliases.includes(headerKey(item)));
}

function parseRows(sheetRows: unknown[][]) {
  const headerRowIndex = findHeaderRow(sheetRows);
  if (headerRowIndex < 0) return [] as DsLegacyImportRow[];

  const headers = (sheetRows[headerRowIndex] || []).map((cell) => text(cell));
  const indexes = Object.fromEntries(
    Object.entries(COLUMN_ALIASES).map(([key, aliases]) => [key, findColumnIndex(headers, aliases)]),
  ) as Record<keyof DsLegacyImportRow, number>;

  const items: DsLegacyImportRow[] = [];
  for (let index = headerRowIndex + 1; index < sheetRows.length; index += 1) {
    const row = sheetRows[index] || [];
    const customerName = indexes.customerName >= 0 ? text(row[indexes.customerName]) : "";
    const platformOrderNo = indexes.platformOrderNo >= 0 ? text(row[indexes.platformOrderNo]) : "";
    const sku = indexes.sku >= 0 ? text(row[indexes.sku]) : "";
    if (!customerName || !platformOrderNo || !sku) continue;

    items.push({
      customerName,
      platform: indexes.platform >= 0 ? text(row[indexes.platform]) : "",
      platformOrderNo,
      trackingNo: indexes.trackingNo >= 0 ? text(row[indexes.trackingNo]) : "",
      shippingLabelFile: indexes.shippingLabelFile >= 0 ? text(row[indexes.shippingLabelFile]) : "",
      shipped: indexes.shipped >= 0 ? parseShipped(row[indexes.shipped]) : false,
      shippedAt: indexes.shippedAt >= 0 ? parseDate(row[indexes.shippedAt]) : null,
      shippingProofFile: indexes.shippingProofFile >= 0 ? text(row[indexes.shippingProofFile]) : "",
      sku,
      quantity: parseNumber(indexes.quantity >= 0 ? row[indexes.quantity] : null) ?? 0,
      color: indexes.color >= 0 ? text(row[indexes.color]) : "",
      warehouse: indexes.warehouse >= 0 ? text(row[indexes.warehouse]) : "",
      shippingFee: parseNumber(indexes.shippingFee >= 0 ? row[indexes.shippingFee] : null),
      productImageUrl: indexes.productImageUrl >= 0 ? text(row[indexes.productImageUrl]) : "",
      productNameZh: indexes.productNameZh >= 0 ? text(row[indexes.productNameZh]) : "",
      unitPrice: parseNumber(indexes.unitPrice >= 0 ? row[indexes.unitPrice] : null),
      discountRate: parseDiscount(indexes.discountRate >= 0 ? row[indexes.discountRate] : null),
      stockedQty: parseNumber(indexes.stockedQty >= 0 ? row[indexes.stockedQty] : null),
      stockAmount: parseNumber(indexes.stockAmount >= 0 ? row[indexes.stockAmount] : null),
      rateValue: parseNumber(indexes.rateValue >= 0 ? row[indexes.rateValue] : null),
      exchangedAmount: parseNumber(indexes.exchangedAmount >= 0 ? row[indexes.exchangedAmount] : null),
      shippingAmount: parseNumber(indexes.shippingAmount >= 0 ? row[indexes.shippingAmount] : null),
      totalAmount: parseNumber(indexes.totalAmount >= 0 ? row[indexes.totalAmount] : null),
      paidAmount: parseNumber(indexes.paidAmount >= 0 ? row[indexes.paidAmount] : null),
      unpaidAmount: parseNumber(indexes.unpaidAmount >= 0 ? row[indexes.unpaidAmount] : null),
      settledAt: indexes.settledAt >= 0 ? parseDate(row[indexes.settledAt]) : null,
    });
  }

  return items;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    if (!(await hasPermission(session, "viewReports"))) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "请先选择导入文件" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const workbook = XLSX.read(bytes, { type: "array" });
    if (workbook.SheetNames.length === 0) {
      return NextResponse.json({ ok: false, error: "未找到工作表" }, { status: 400 });
    }

    let parsedRows: DsLegacyImportRow[] = [];
    for (const sheetName of workbook.SheetNames) {
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
        header: 1,
        raw: false,
        defval: "",
        blankrows: false,
      });
      const current = parseRows(matrix);
      if (current.length > parsedRows.length) parsedRows = current;
    }

    if (parsedRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "未识别到可导入数据，请确认列标题与模板一致" },
        { status: 400 },
      );
    }

    const summary = await importLegacyOrders(session, parsedRows);
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "导入失败" },
      { status: 500 },
    );
  }
}
