import ExcelJS from "exceljs";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { DsInventoryRow, DsInventoryStatus } from "@/lib/dropshipping-types";

export type InventoryExportFilters = {
  stocked: "all" | "stocked" | "unstocked";
  status: "all" | DsInventoryStatus;
  skuKeyword: string;
  includeAllShipped: boolean;
};

type EmbeddedFonts = {
  zhRegular: PDFFont;
  zhBold: PDFFont;
  latinRegular: PDFFont;
  latinBold: PDFFont;
};

function sanitizeFileName(value: string) {
  return String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDateOnly(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatMoney(value: number | null | undefined) {
  const number = Number(value || 0);
  return number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number | null | undefined) {
  const normalized = Math.abs(Number(value || 0)) <= 1 ? Number(value || 0) * 100 : Number(value || 0);
  return `${normalized.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

function getStatusLabel(status: DsInventoryStatus) {
  if (status === "healthy") return "充足";
  if (status === "low") return "偏低";
  return "售罄";
}

function parseDateTime(value: string | null | undefined) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

export function filterInventoryExportRows(rows: DsInventoryRow[], filters: InventoryExportFilters) {
  const normalizedSku = filters.skuKeyword.trim().toLowerCase();
  let next = rows.filter((row) => {
    const stockedHit =
      filters.stocked === "all"
      || (filters.stocked === "stocked" && row.isStocked)
      || (filters.stocked === "unstocked" && !row.isStocked);
    const statusHit =
      filters.status === "all"
      || (row.isStocked && row.status === filters.status);
    const skuHit =
      !normalizedSku
      || row.sku.toLowerCase().includes(normalizedSku);
    return stockedHit && statusHit && skuHit;
  });

  if (!filters.includeAllShipped) {
    next = next.filter((row) => row.isStocked);
  }

  return next.sort((a, b) => {
    const stockedCompare = parseDateTime(b.stockedAt) - parseDateTime(a.stockedAt);
    if (stockedCompare !== 0) return stockedCompare;
    const shippedCompare = parseDateTime(b.shippedAt) - parseDateTime(a.shippedAt);
    if (shippedCompare !== 0) return shippedCompare;
    return a.sku.localeCompare(b.sku, "en");
  });
}

export function buildDropshippingInventoryExportBaseName() {
  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()).replace(/-/g, "");
  return sanitizeFileName(`dropshipping-inventory-${stamp}`);
}

export async function buildDropshippingInventoryXlsx(rows: DsInventoryRow[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("已发商品");

  sheet.columns = [
    { header: "客户名称", key: "customerName", width: 18 },
    { header: "编码", key: "sku", width: 14 },
    { header: "中文名", key: "productNameZh", width: 28 },
    { header: "单价", key: "unitPrice", width: 12 },
    { header: "普通折扣", key: "discountRate", width: 12 },
    { header: "备货数量", key: "stockedQty", width: 12 },
    { header: "备货金额", key: "stockAmount", width: 14 },
    { header: "备货时间", key: "stockedAt", width: 14 },
    { header: "备货剩余", key: "remainingQty", width: 12 },
    { header: "备货状态", key: "status", width: 12 },
    { header: "已发", key: "shippedQty", width: 10 },
    { header: "发货时间", key: "shippedAt", width: 14 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { name: "Noto Sans SC", size: 11, bold: true, color: { argb: "FF000000" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
    cell.border = {
      top: { style: "thin", color: { argb: "FFDDDDDD" } },
      left: { style: "thin", color: { argb: "FFDDDDDD" } },
      bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
      right: { style: "thin", color: { argb: "FFDDDDDD" } },
    };
  });

  rows.forEach((row) => {
    const excelRow = sheet.addRow({
      customerName: row.customerName,
      sku: row.sku,
      productNameZh: row.productNameZh,
      unitPrice: `$${formatMoney(row.unitPrice)}`,
      discountRate: formatPercent(row.discountRate),
      stockedQty: row.isStocked ? row.stockedQty : "-",
      stockAmount: row.isStocked ? `$${formatMoney(row.stockAmount)}` : "-",
      stockedAt: row.isStocked ? formatDateOnly(row.stockedAt) : "-",
      remainingQty: row.isStocked ? row.remainingQty : "-",
      status: row.isStocked ? getStatusLabel(row.status) : "-",
      shippedQty: row.shippedQty,
      shippedAt: formatDateOnly(row.shippedAt),
    });
    excelRow.height = 20;
    excelRow.eachCell((cell, colNumber) => {
      const isNumberCol = [4, 5, 6, 7, 9, 11, 12].includes(colNumber);
      cell.font = {
        name: /[\u3400-\u9FFF]/.test(String(cell.value || "")) ? "Noto Sans SC" : "Inter",
        size: 11,
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: isNumberCol ? "center" : "left",
      };
      cell.border = {
        left: { style: "thin", color: { argb: "FFDDDDDD" } },
        bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
        right: { style: "thin", color: { argb: "FFDDDDDD" } },
      };
    });
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function loadFontCandidates(candidates: string[]) {
  for (const candidate of candidates) {
    try {
      return await fs.readFile(candidate);
    } catch {
      // try next
    }
  }
  return null;
}

async function embedFonts(pdfDoc: PDFDocument): Promise<EmbeddedFonts> {
  pdfDoc.registerFontkit(fontkit);
  const regularBytes = await loadFontCandidates([
    path.join(process.cwd(), "public", "fonts", "NotoSansCJKsc-Regular.otf"),
    "C:\\Windows\\Fonts\\msyh.ttf",
  ]);
  const latinRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const latinBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  if (regularBytes) {
    const zhRegular = await pdfDoc.embedFont(regularBytes, { subset: false });
    return { zhRegular, zhBold: zhRegular, latinRegular, latinBold };
  }
  return { zhRegular: latinRegular, zhBold: latinBold, latinRegular, latinBold };
}

function hasChineseGlyph(value: string) {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(String(value || ""));
}

function requiresUnicodeFont(value: string) {
  return /[^\u0000-\u00FF]/.test(String(value || ""));
}

function getFontForText(fonts: EmbeddedFonts, value: string, bold = false) {
  if (hasChineseGlyph(value) || requiresUnicodeFont(value)) {
    return bold ? fonts.zhBold : fonts.zhRegular;
  }
  return bold ? fonts.latinBold : fonts.latinRegular;
}

function drawText(page: PDFPage, value: string, options: {
  x: number;
  y: number;
  size?: number;
  fonts: EmbeddedFonts;
  bold?: boolean;
  color?: ReturnType<typeof rgb>;
}) {
  const chunks = String(value || "").match(/([^\u0000-\u00FF]+|[\u0000-\u00FF]+)/g) || [];
  let cursorX = options.x;
  for (const chunk of chunks) {
    const font = getFontForText(options.fonts, chunk, options.bold);
    page.drawText(chunk, {
      x: cursorX,
      y: options.y,
      size: options.size || 9,
      font,
      color: options.color || rgb(0, 0, 0),
    });
    cursorX += font.widthOfTextAtSize(chunk, options.size || 9);
  }
}

function drawPdfHeader(page: PDFPage, fonts: EmbeddedFonts, total: number) {
  drawText(page, "已发商品筛选导出", {
    x: 32,
    y: 560,
    size: 16,
    fonts,
    bold: true,
  });
  drawText(page, `共 ${total} 条记录`, {
    x: 32,
    y: 542,
    size: 9.5,
    fonts,
  });
}

function drawPdfTableHeader(page: PDFPage, fonts: EmbeddedFonts, y: number) {
  const columns = [
    { label: "编码", x: 20 },
    { label: "中文名", x: 80 },
    { label: "单价", x: 210 },
    { label: "折扣", x: 260 },
    { label: "备货数量", x: 305 },
    { label: "备货金额", x: 365 },
    { label: "备货时间", x: 445 },
    { label: "剩余", x: 515 },
    { label: "状态", x: 555 },
    { label: "已发", x: 605 },
    { label: "发货时间", x: 645 },
  ];
  page.drawRectangle({
    x: 18,
    y: y - 8,
    width: 800,
    height: 22,
    color: rgb(0.96, 0.96, 0.96),
    borderColor: rgb(0.87, 0.87, 0.87),
    borderWidth: 1,
  });
  columns.forEach((column) => {
    drawText(page, column.label, {
      x: column.x,
      y,
      size: 8.5,
      fonts,
      bold: true,
    });
  });
}

export async function buildDropshippingInventoryPdf(rows: DsInventoryRow[]) {
  const pdfDoc = await PDFDocument.create();
  const fonts = await embedFonts(pdfDoc);
  let page = pdfDoc.addPage([842, 595]);
  let cursorY = 520;

  drawPdfHeader(page, fonts, rows.length);
  drawPdfTableHeader(page, fonts, cursorY);
  cursorY -= 28;

  for (const row of rows) {
    if (cursorY < 34) {
      page = pdfDoc.addPage([842, 595]);
      cursorY = 560;
      drawPdfTableHeader(page, fonts, cursorY);
      cursorY -= 28;
    }

    const values = [
      { text: row.sku, x: 20 },
      { text: row.productNameZh, x: 80 },
      { text: `$${formatMoney(row.unitPrice)}`, x: 210 },
      { text: formatPercent(row.discountRate), x: 260 },
      { text: row.isStocked ? String(row.stockedQty) : "-", x: 320 },
      { text: row.isStocked ? `$${formatMoney(row.stockAmount)}` : "-", x: 365 },
      { text: row.isStocked ? formatDateOnly(row.stockedAt) : "-", x: 445 },
      { text: row.isStocked ? String(row.remainingQty) : "-", x: 520 },
      { text: row.isStocked ? getStatusLabel(row.status) : "-", x: 555 },
      { text: String(row.shippedQty), x: 610 },
      { text: formatDateOnly(row.shippedAt), x: 645 },
    ];

    values.forEach((entry) => {
      drawText(page, entry.text, {
        x: entry.x,
        y: cursorY,
        size: 8.5,
        fonts,
      });
    });
    page.drawLine({
      start: { x: 18, y: cursorY - 6 },
      end: { x: 818, y: cursorY - 6 },
      thickness: 0.6,
      color: rgb(0.87, 0.87, 0.87),
    });
    cursorY -= 22;
  }

  return Buffer.from(await pdfDoc.save());
}
