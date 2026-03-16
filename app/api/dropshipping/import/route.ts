import ExcelJS from "exceljs";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { importLegacyOrders } from "@/lib/dropshipping";
import { deleteR2Object, downloadR2Object } from "@/lib/r2-upload";
import type { DsLegacyImportAsset, DsLegacyImportRow } from "@/lib/dropshipping-types";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";

export const runtime = "nodejs";

type AssetFile = {
  path: string;
  name: string;
  bytes: Uint8Array;
};

type CellMeta = {
  text: string;
  hyperlink: string;
};

function text(value: unknown) {
  return String(value ?? "").replace(/\r?\n/g, " ").trim();
}

function headerKey(value: unknown) {
  return text(value).replace(/\s+/g, "").toLowerCase();
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

function normalizePath(value: string) {
  return value
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\.?\//, "")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
}

function baseName(filePath: string) {
  const normalized = normalizePath(filePath);
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
}

function mimeTypeFromName(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

const COLUMN_ALIASES: Record<keyof Omit<DsLegacyImportRow, "shippingLabelFiles" | "shippingProofFiles">, string[]> = {
  customerName: ["客户名称", "客户"],
  platform: ["下单平台", "平台"],
  platformOrderNo: ["后台订单号", "订单号"],
  trackingNo: ["面单物流号", "物流号", "运单号"],
  shippingLabelFile: ["面单文件"],
  shipped: ["是否发货"],
  shippedAt: ["发货日期"],
  shippingProofFile: ["发货凭据", "发货凭证"],
  sku: ["产品sku", "sku", "产品SKU"],
  quantity: ["下单数", "数量"],
  color: ["发货颜色", "颜色"],
  warehouse: ["发货仓", "仓库"],
  shippingFee: ["代发费"],
  productImageUrl: ["产品图"],
  productNameZh: ["产品中文名"],
  unitPrice: ["产品单价"],
  discountRate: ["普通折扣"],
  stockedQty: ["备货数量"],
  stockAmount: ["备货总金额"],
  rateValue: ["rmb汇率", "汇率", "RMB汇率"],
  exchangedAmount: ["汇率后金额"],
  shippingAmount: ["代发总金额"],
  totalAmount: ["总金额"],
  paidAmount: ["已付款项"],
  unpaidAmount: ["剩余款项"],
  settledAt: ["结账日期"],
};

function findHeaderRow(rows: string[][]) {
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

function buildAssetIndexes(files: AssetFile[]) {
  const byPath = new Map<string, AssetFile>();
  const byName = new Map<string, AssetFile[]>();

  for (const file of files) {
    const normalized = normalizePath(file.path);
    byPath.set(normalized.toLowerCase(), file);
    const list = byName.get(file.name.toLowerCase()) || [];
    list.push(file);
    byName.set(file.name.toLowerCase(), list);
  }

  return { byPath, byName };
}

function splitPossiblePaths(value: string) {
  return value
    .split(/\r?\n|[;,|]/)
    .map((item) => normalizePath(item))
    .filter(Boolean);
}

function resolveAsset(
  rawValue: string,
  hyperlink: string,
  assets: ReturnType<typeof buildAssetIndexes>,
  preferredFolder: "面单文件" | "发货凭据",
) {
  const candidates = [hyperlink, ...splitPossiblePaths(rawValue)];
  for (const candidate of candidates) {
    const normalized = normalizePath(candidate);
    if (!normalized) continue;

    const direct = assets.byPath.get(normalized.toLowerCase());
    if (direct) return direct;

    const preferred = assets.byPath.get(normalizePath(`${preferredFolder}/${baseName(normalized)}`).toLowerCase());
    if (preferred) return preferred;

    const matchedByName = assets.byName.get(baseName(normalized).toLowerCase());
    if (matchedByName?.length) return matchedByName[0];
  }

  return null;
}

async function parseXlsxWorkbook(bytes: Uint8Array, assetFiles: AssetFile[]) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const assets = buildAssetIndexes(assetFiles);
  let parsedRows: DsLegacyImportRow[] = [];

  for (const worksheet of workbook.worksheets) {
    const matrix: string[][] = [];
    const meta = new Map<string, CellMeta>();

    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const current: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const cellValue = cell.value;
        let displayText = "";
        let hyperlink = "";

        if (typeof cellValue === "object" && cellValue && "hyperlink" in cellValue) {
          const linkCell = cellValue as { text?: string; hyperlink?: string };
          displayText = text(linkCell.text || cell.text);
          hyperlink = text(linkCell.hyperlink);
        } else {
          displayText = text(cell.text || cellValue);
          hyperlink = typeof cell.hyperlink === "string" ? cell.hyperlink : "";
        }

        current[colNumber - 1] = displayText;
        if (displayText || hyperlink) {
          meta.set(`${row.number}:${colNumber}`, { text: displayText, hyperlink });
        }
      });
      matrix[row.number - 1] = current;
    });

    const headerRowIndex = findHeaderRow(matrix);
    if (headerRowIndex < 0) continue;

    const headers = (matrix[headerRowIndex] || []).map((cell) => text(cell));
    const indexes = Object.fromEntries(
      Object.entries(COLUMN_ALIASES).map(([key, aliases]) => [key, findColumnIndex(headers, aliases)]),
    ) as Record<keyof typeof COLUMN_ALIASES, number>;

    const items: DsLegacyImportRow[] = [];
    for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
      const row = matrix[rowIndex] || [];
      const customerName = indexes.customerName >= 0 ? text(row[indexes.customerName]) : "";
      const platformOrderNo = indexes.platformOrderNo >= 0 ? text(row[indexes.platformOrderNo]) : "";
      const sku = indexes.sku >= 0 ? text(row[indexes.sku]) : "";
      if (!customerName || !platformOrderNo || !sku) continue;

      const labelMeta =
        indexes.shippingLabelFile >= 0 ? meta.get(`${rowIndex + 1}:${indexes.shippingLabelFile + 1}`) : undefined;
      const proofMeta =
        indexes.shippingProofFile >= 0 ? meta.get(`${rowIndex + 1}:${indexes.shippingProofFile + 1}`) : undefined;

      const shippingLabelFiles: DsLegacyImportAsset[] = [];
      const labelAsset = resolveAsset(labelMeta?.text || "", labelMeta?.hyperlink || "", assets, "面单文件");
      if (labelAsset) {
        shippingLabelFiles.push({
          displayName: labelAsset.name,
          relativePath: labelAsset.path,
          bytes: labelAsset.bytes,
          mimeType: mimeTypeFromName(labelAsset.name),
        });
      }

      const shippingProofFiles: DsLegacyImportAsset[] = [];
      const proofAsset = resolveAsset(proofMeta?.text || "", proofMeta?.hyperlink || "", assets, "发货凭据");
      if (proofAsset) {
        shippingProofFiles.push({
          displayName: proofAsset.name,
          relativePath: proofAsset.path,
          bytes: proofAsset.bytes,
          mimeType: mimeTypeFromName(proofAsset.name),
        });
      }

      items.push({
        customerName,
        platform: indexes.platform >= 0 ? text(row[indexes.platform]) : "",
        platformOrderNo,
        trackingNo: indexes.trackingNo >= 0 ? text(row[indexes.trackingNo]) : "",
        shippingLabelFile: labelMeta?.hyperlink || labelMeta?.text || "",
        shippingLabelFiles,
        shipped: indexes.shipped >= 0 ? parseShipped(row[indexes.shipped]) : false,
        shippedAt: indexes.shippedAt >= 0 ? parseDate(row[indexes.shippedAt]) : null,
        shippingProofFile: proofMeta?.hyperlink || proofMeta?.text || "",
        shippingProofFiles,
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

    if (items.length > parsedRows.length) {
      parsedRows = items;
    }
  }

  return parsedRows;
}

function parseFlatWorkbook(bytes: ArrayBuffer) {
  const workbook = XLSX.read(bytes, { type: "array" });
  let parsedRows: DsLegacyImportRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    }) as unknown[][];
    const headers = matrix.map((row) => row.map((cell) => text(cell)));
    const headerRowIndex = findHeaderRow(headers);
    if (headerRowIndex < 0) continue;

    const rowHeaders = headers[headerRowIndex] || [];
    const indexes = Object.fromEntries(
      Object.entries(COLUMN_ALIASES).map(([key, aliases]) => [key, findColumnIndex(rowHeaders, aliases)]),
    ) as Record<keyof typeof COLUMN_ALIASES, number>;

    const items: DsLegacyImportRow[] = [];
    for (let rowIndex = headerRowIndex + 1; rowIndex < matrix.length; rowIndex += 1) {
      const row = matrix[rowIndex] || [];
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
        shippingLabelFiles: [],
        shipped: indexes.shipped >= 0 ? parseShipped(row[indexes.shipped]) : false,
        shippedAt: indexes.shippedAt >= 0 ? parseDate(row[indexes.shippedAt]) : null,
        shippingProofFile: indexes.shippingProofFile >= 0 ? text(row[indexes.shippingProofFile]) : "",
        shippingProofFiles: [],
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

    if (items.length > parsedRows.length) {
      parsedRows = items;
    }
  }

  return parsedRows;
}

async function parseZipBytes(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const workbookEntry = entries.find((entry) => /\.xlsx$/i.test(entry.name));
  if (!workbookEntry) {
    throw new Error("压缩包里没有找到 xlsx 表格");
  }

  const workbookBytes = await workbookEntry.async("uint8array");
  const assetFiles: AssetFile[] = [];
  for (const entry of entries) {
    if (entry.name === workbookEntry.name) continue;
    assetFiles.push({
      path: entry.name,
      name: baseName(entry.name),
      bytes: await entry.async("uint8array"),
    });
  }

  return parseXlsxWorkbook(workbookBytes, assetFiles);
}

async function parseZipFile(file: File) {
  return parseZipBytes(new Uint8Array(await file.arrayBuffer()));
}

function uint8ArrayToArrayBuffer(value: Uint8Array) {
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    if (!(await hasPermission(session, "viewReports"))) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const contentType = request.headers.get("content-type") || "";
    let parsedRows: DsLegacyImportRow[] = [];
    let importedR2Key = "";

    if (contentType.includes("application/json")) {
      const body = (await request.json()) as { r2Key?: string; fileName?: string };
      importedR2Key = String(body.r2Key || "").trim();
      if (!importedR2Key) {
        return NextResponse.json({ ok: false, error: "缺少历史导入文件 key" }, { status: 400 });
      }

      const object = await downloadR2Object(importedR2Key);
      const sourceName = String(body.fileName || importedR2Key).toLowerCase();
      parsedRows = sourceName.endsWith(".zip")
        ? await parseZipBytes(object.body)
        : sourceName.endsWith(".xlsx")
          ? await parseXlsxWorkbook(object.body, [])
          : parseFlatWorkbook(uint8ArrayToArrayBuffer(object.body));
    } else {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ ok: false, error: "请先选择历史导入文件" }, { status: 400 });
      }

      const lowerName = file.name.toLowerCase();
      parsedRows = lowerName.endsWith(".zip")
        ? await parseZipFile(file)
        : lowerName.endsWith(".xlsx")
          ? await parseXlsxWorkbook(new Uint8Array(await file.arrayBuffer()), [])
          : parseFlatWorkbook(await file.arrayBuffer());
    }

    if (parsedRows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "没有识别到可导入数据，请确认列标题与模板一致" },
        { status: 400 },
      );
    }

    const summary = await importLegacyOrders(session, parsedRows);
    if (importedR2Key) {
      await deleteR2Object(importedR2Key).catch(() => undefined);
    }

    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "历史导入失败" },
      { status: 500 },
    );
  }
}
