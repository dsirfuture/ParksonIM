import ExcelJS from "exceljs";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { deriveInventoryStatus } from "@/lib/dropshipping";
import { buildProductImageUrls } from "@/lib/product-image-url";
import type { DsInventoryRow, DsInventoryStatus } from "@/lib/dropshipping-types";

export type InventoryExportFilters = {
  stocked: "all" | "stocked" | "unstocked";
  status: "all" | DsInventoryStatus;
  skuKeyword: string;
  includeAllShipped: boolean;
  customerName?: string;
};

type EmbeddedFonts = {
  zhRegular: PDFFont;
  zhBold: PDFFont;
  latinRegular: PDFFont;
  latinBold: PDFFont;
};

type FontRole = keyof EmbeddedFonts;

type LoadedProductImage = {
  buffer: Buffer;
  extension: "png" | "jpeg";
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
  const normalizedCustomer = String(filters.customerName || "").trim().toLowerCase();
  let next = rows.filter((row) => {
    const customerHit =
      !normalizedCustomer
      || row.customerName.trim().toLowerCase() === normalizedCustomer;
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
    return customerHit && stockedHit && statusHit && skuHit;
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

export function buildDropshippingStockTagPdfName(customerName?: string | null) {
  const stamp = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()).replace(/-/g, "");
  const safeCustomerName = sanitizeFileName(String(customerName || "").trim()) || "全部客户";
  return sanitizeFileName(`${safeCustomerName}-备货详情-${stamp}`);
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
    const zhRegular = await pdfDoc.embedFont(regularBytes);
    const zhBold = zhRegular;
    return { zhRegular, zhBold, latinRegular, latinBold };
  }
  return { zhRegular: latinRegular, zhBold: latinBold, latinRegular, latinBold };
}

async function loadProductImageBuffer(imageUrl: string, sku: string): Promise<LoadedProductImage | null> {
  const keys = [sku].map((item) => item.trim()).filter(Boolean);

  const localExts = ["jpg", "jpeg", "png", "webp", "JPG", "JPEG", "PNG", "WEBP"];
  for (const key of keys) {
    for (const ext of localExts) {
      const filePath = path.join(process.cwd(), "public", "products", `${key}.${ext}`);
      try {
        const buffer = await fs.readFile(filePath);
        return {
          buffer,
          extension: (ext.toLowerCase() === "png" ? "png" : "jpeg") as "png" | "jpeg",
        };
      } catch {
        // try next candidate
      }
    }
  }

  const remoteUrls = [
    imageUrl,
    ...keys.flatMap((key) => buildProductImageUrls(key, ["jpg", "jpeg", "png", "webp"])),
  ].filter(Boolean);

  for (const url of remoteUrls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;
      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      if (!contentType.includes("image")) continue;
      const data = await response.arrayBuffer();
      if (data.byteLength === 0) continue;
      return {
        buffer: Buffer.from(data),
        extension: (contentType.includes("png") ? "png" : "jpeg") as "png" | "jpeg",
      };
    } catch {
      // try next url
    }
  }

  return null;
}

async function getCachedProductImageBuffer(
  cache: Map<string, Promise<LoadedProductImage | null>>,
  imageUrl: string,
  sku: string,
) {
  const cacheKey = `${String(sku || "").trim().toUpperCase()}::${String(imageUrl || "").trim()}`;
  const current = cache.get(cacheKey);
  if (current) return current;
  const pending = loadProductImageBuffer(imageUrl, sku);
  cache.set(cacheKey, pending);
  return pending;
}

async function getCachedEmbeddedPdfImage(
  pdfDoc: PDFDocument,
  embeddedCache: Map<string, Promise<PDFImage | null>>,
  imageKey: string,
  image: LoadedProductImage | null,
) {
  const current = embeddedCache.get(imageKey);
  if (current) return current;
  const pending = (async () => {
    if (!image) return null;
    try {
      return image.extension === "png"
        ? await pdfDoc.embedPng(image.buffer)
        : await pdfDoc.embedJpg(image.buffer);
    } catch {
      return null;
    }
  })();
  embeddedCache.set(imageKey, pending);
  return pending;
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

function getFontByRole(fonts: EmbeddedFonts, fontRole?: FontRole) {
  return fontRole ? fonts[fontRole] : null;
}

function resolveDrawFont(
  fonts: EmbeddedFonts,
  value: string,
  bold = false,
  fontRole?: FontRole,
) {
  const forced = getFontByRole(fonts, fontRole);
  if (!forced) return getFontForText(fonts, value, bold);

  const requestsLatin = fontRole === "latinRegular" || fontRole === "latinBold";
  if (requestsLatin && (hasChineseGlyph(value) || requiresUnicodeFont(value))) {
    return getFontForText(fonts, value, bold);
  }

  return forced;
}

function drawText(page: PDFPage, value: string, options: {
  x: number;
  y: number;
  size?: number;
  fonts: EmbeddedFonts;
  bold?: boolean;
  color?: ReturnType<typeof rgb>;
  fontRole?: FontRole;
}) {
  const chunks = String(value || "").match(/([^\u0000-\u00FF]+|[\u0000-\u00FF]+)/g) || [];
  let cursorX = options.x;
  for (const chunk of chunks) {
    const font = resolveDrawFont(options.fonts, chunk, options.bold, options.fontRole);
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

function truncateTextForWidth(fonts: EmbeddedFonts, value: string, maxWidth: number, size = 8.5, bold = false) {
  const text = String(value || "");
  const ellipsis = "…";
  const ellipsisWidth = getFontForText(fonts, ellipsis, bold).widthOfTextAtSize(ellipsis, size);
  let width = 0;
  let result = "";
  for (const char of text) {
    const font = getFontForText(fonts, char, bold);
    const charWidth = font.widthOfTextAtSize(char, size);
    if (width + charWidth > maxWidth) {
      return `${result}${width + ellipsisWidth <= maxWidth ? ellipsis : ""}` || text.slice(0, 1);
    }
    result += char;
    width += charWidth;
  }
  return result;
}

function measureTextWidth(value: string, options: { fonts: EmbeddedFonts; size?: number; bold?: boolean }) {
  const chunks = String(value || "").match(/([^\u0000-\u00FF]+|[\u0000-\u00FF]+)/g) || [];
  return chunks.reduce((sum, chunk) => {
    const font = getFontForText(options.fonts, chunk, options.bold);
    return sum + font.widthOfTextAtSize(chunk, options.size || 10);
  }, 0);
}

function drawSpacedText(
  page: PDFPage,
  value: string,
  options: {
    x: number;
    y: number;
    size?: number;
    fonts: EmbeddedFonts;
    bold?: boolean;
    color?: ReturnType<typeof rgb>;
    letterSpacing?: number;
    fontRole?: FontRole;
  },
) {
  const text = String(value || "");
  const size = options.size || 10;
  const spacing = options.letterSpacing ?? 0;
  let cursorX = options.x;
  for (const char of text) {
    const font = resolveDrawFont(options.fonts, char, options.bold, options.fontRole);
    page.drawText(char, {
      x: cursorX,
      y: options.y,
      size,
      font,
      color: options.color || rgb(0, 0, 0),
    });
    cursorX += font.widthOfTextAtSize(char, size) + spacing;
  }
}

function measureSpacedTextWidth(
  value: string,
  options: { fonts: EmbeddedFonts; size?: number; bold?: boolean; letterSpacing?: number },
) {
  const text = String(value || "");
  if (!text) return 0;
  const size = options.size || 10;
  const spacing = options.letterSpacing ?? 0;
  let width = 0;
  for (const char of text) {
    const font = getFontForText(options.fonts, char, options.bold);
    width += font.widthOfTextAtSize(char, size);
  }
  return width + spacing * Math.max(text.length - 1, 0);
}

function drawPdfHeader(page: PDFPage, fonts: EmbeddedFonts, total: number) {
  drawText(page, "已发商品筛选导出", {
    x: 32,
    y: 560,
    size: 16,
    fonts,
    bold: true,
    fontRole: "zhBold",
  });
  drawText(page, `共 ${total} 条记录`, {
    x: 32,
    y: 542,
    size: 9.5,
    fonts,
    fontRole: "zhRegular",
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
      fontRole: "zhBold",
    });
  });
}

function groupInventoryRowsByCustomer(rows: DsInventoryRow[]) {
  const groups = new Map<string, DsInventoryRow[]>();
  for (const row of rows) {
    const key = String(row.customerName || "").trim() || "未命名客户";
    const current = groups.get(key) || [];
    current.push(row);
    groups.set(key, current);
  }
  return [...groups.entries()]
    .map(([customerName, items]) => ({
      customerName,
      items: [...items].sort((a, b) => {
        const stockedCompare = parseDateTime(b.stockedAt) - parseDateTime(a.stockedAt);
        if (stockedCompare !== 0) return stockedCompare;
        const shippedCompare = parseDateTime(b.shippedAt) - parseDateTime(a.shippedAt);
        if (shippedCompare !== 0) return shippedCompare;
        return a.sku.localeCompare(b.sku, "en");
      }),
    }))
    .sort((a, b) => a.customerName.localeCompare(b.customerName, "zh"));
}

function aggregateStockTagRows(rows: DsInventoryRow[]) {
  const grouped = new Map<string, DsInventoryRow>();
  for (const row of rows) {
    const key = `${String(row.customerId || "").trim()}::${String(row.sku || "").trim().toUpperCase()}`;
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, { ...row });
      continue;
    }
    const nextStockedAt = parseDateTime(row.stockedAt) < parseDateTime(current.stockedAt) ? current.stockedAt : row.stockedAt;
    const nextShippedAt = parseDateTime(row.shippedAt) < parseDateTime(current.shippedAt) ? current.shippedAt : row.shippedAt;
    const stockedQty = Math.max(current.stockedQty, 0) + Math.max(row.stockedQty, 0);
    const shippedQty = Math.max(current.shippedQty, 0) + Math.max(row.shippedQty, 0);
    const remainingQty = Math.max(current.remainingQty, 0) + Math.max(row.remainingQty, 0);
    grouped.set(key, {
      ...current,
      stockedAt: nextStockedAt,
      shippedAt: nextShippedAt,
      stockedQty,
      shippedQty,
      remainingQty,
      stockAmount: current.stockAmount + row.stockAmount,
      status: deriveInventoryStatus(Math.max(remainingQty, 0)),
    });
  }

  return [...grouped.values()].sort((a, b) => {
    if (a.customerName !== b.customerName) return a.customerName.localeCompare(b.customerName, "zh");
    const stockedCompare = parseDateTime(b.stockedAt) - parseDateTime(a.stockedAt);
    if (stockedCompare !== 0) return stockedCompare;
    return a.sku.localeCompare(b.sku, "en");
  });
}

function drawStockTagPdfHeader(
  page: PDFPage,
  fonts: EmbeddedFonts,
  options: {
    totalRows: number;
    totalCustomers: number;
    totalStockedQty: number;
    emptyCount: number;
    healthyCount: number;
    lowCount: number;
    customerName?: string | null;
  },
) {
  drawSpacedText(page, "PARKSONMX", {
    x: 28,
    y: 568,
    size: 13.5,
    fonts,
    bold: true,
    color: rgb(0.15, 0.18, 0.25),
    letterSpacing: 1.8,
    fontRole: "latinBold",
  });
  drawText(page, "备 货 详 情", {
    x: 28,
    y: 526,
    size: 18,
    fonts,
    bold: true,
    color: rgb(0, 0, 0),
    fontRole: "zhBold",
  });
  drawText(page, "备 货 详 情", {
    x: 28.35,
    y: 526,
    size: 18,
    fonts,
    bold: true,
    color: rgb(0, 0, 0),
    fontRole: "zhBold",
  });
  const customerLabel = options.customerName
    ? `客户：${options.customerName}`
    : `客户：全部客户`;
  drawText(page, customerLabel, {
    x: 28,
    y: 490,
    size: 9.5,
    fonts,
    color: rgb(0.32, 0.38, 0.5),
    fontRole: "zhRegular",
  });
  drawText(page, `目前备货：${options.totalRows} SKU`, {
    x: 186,
    y: 490,
    size: 9.5,
    fonts,
    color: rgb(0.32, 0.38, 0.5),
    fontRole: "zhRegular",
  });
  drawText(page, `商品数量：${options.totalStockedQty} 个`, {
    x: 360,
    y: 490,
    size: 9.5,
    fonts,
    color: rgb(0.32, 0.38, 0.5),
    fontRole: "zhRegular",
  });
  drawText(page, `售罄SKU：${options.emptyCount}`, {
    x: 526,
    y: 490,
    size: 9.5,
    fonts,
    color: rgb(0.88, 0.17, 0.28),
    fontRole: "zhRegular",
  });
  drawText(page, `充足SKU：${options.healthyCount}`, {
    x: 620,
    y: 490,
    size: 9.5,
    fonts,
    color: rgb(0.02, 0.6, 0.34),
    fontRole: "zhRegular",
  });
  drawText(page, `偏低SKU：${options.lowCount}`, {
    x: 714,
    y: 490,
    size: 9.5,
    fonts,
    color: rgb(0.85, 0.52, 0.04),
    fontRole: "zhRegular",
  });
  const exportDate = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const exportLabel = `导出日期：${exportDate}`;
  const exportLabelWidth = measureTextWidth(exportLabel, { fonts, size: 9.5, bold: false });
  drawText(page, exportLabel, {
    x: 814 - exportLabelWidth,
    y: 568,
    size: 9.5,
    fonts,
    color: rgb(0.32, 0.38, 0.5),
    fontRole: "zhRegular",
  });
}

function getInventoryStatusColor(status: DsInventoryStatus) {
  if (status === "healthy") return rgb(0.02, 0.6, 0.34);
  if (status === "empty") return rgb(0.88, 0.17, 0.28);
  return rgb(0.85, 0.52, 0.04);
}

function drawStockTagTableHeader(page: PDFPage, fonts: EmbeddedFonts, y: number) {
  const columns = [
    { label: "产品图", x: 36 },
    { label: "编码", x: 82 },
    { label: "中文名", x: 150 },
    { label: "单价", x: 378 },
    { label: "折扣", x: 438 },
    { label: "备货数量", x: 486 },
    { label: "备货金额", x: 554 },
    { label: "备货时间", x: 638 },
    { label: "已发", x: 724 },
    { label: "剩余", x: 760 },
    { label: "状态", x: 796 },
  ];
  page.drawRectangle({
    x: 28,
    y: y - 8,
    width: 786,
    height: 24,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.86, 0.89, 0.94),
    borderWidth: 1,
  });
  columns.forEach((column) => {
    drawText(page, column.label, {
      x: column.x,
      y,
      size: 8.5,
      fonts,
      bold: true,
      color: rgb(0.39, 0.45, 0.56),
      fontRole: "zhBold",
    });
  });
}

export async function buildDropshippingStockTagPdf(rows: DsInventoryRow[], customerName?: string | null) {
  const stockedRows = aggregateStockTagRows(rows.filter((row) => row.isStocked));
  const groups = groupInventoryRowsByCustomer(stockedRows);
  const totalStockedQty = stockedRows.reduce((sum, row) => sum + Math.max(row.stockedQty, 0), 0);
  const healthyCount = stockedRows.filter((row) => row.status === "healthy").length;
  const lowCount = stockedRows.filter((row) => row.status === "low").length;
  const emptyCount = stockedRows.filter((row) => row.status === "empty").length;
  const pdfDoc = await PDFDocument.create();
  const fonts = await embedFonts(pdfDoc);
  const imageBufferCache = new Map<string, Promise<LoadedProductImage | null>>();
  const embeddedImageCache = new Map<string, Promise<PDFImage | null>>();
  let page = pdfDoc.addPage([842, 595]);
  let cursorY = 452;

  drawStockTagPdfHeader(page, fonts, {
    totalRows: stockedRows.length,
    totalCustomers: groups.length,
    totalStockedQty,
    emptyCount,
    healthyCount,
    lowCount,
    customerName,
  });
  drawStockTagTableHeader(page, fonts, cursorY);
  cursorY -= 28;

  for (const group of groups) {
    for (const row of group.items) {
      if (cursorY < 34) {
        page = pdfDoc.addPage([842, 595]);
        cursorY = 560;
        drawStockTagTableHeader(page, fonts, cursorY);
        cursorY -= 28;
      }

      const imageKey = `${String(row.sku || "").trim().toUpperCase()}::${String(row.productImageUrl || "").trim()}`;
      const image = await getCachedProductImageBuffer(imageBufferCache, row.productImageUrl, row.sku);
      const embedded = await getCachedEmbeddedPdfImage(pdfDoc, embeddedImageCache, imageKey, image);
      if (embedded) {
        try {
          const dimensions = embedded.scale(1);
          const maxSize = 18;
          const scale = Math.min(maxSize / dimensions.width, maxSize / dimensions.height);
          const width = dimensions.width * scale;
          const height = dimensions.height * scale;
          page.drawImage(embedded, {
            x: 36,
            y: cursorY - 4,
            width,
            height,
          });
        } catch {
          // ignore invalid image
        }
      }

      const values = [
        { text: row.sku, x: 82, color: rgb(0.15, 0.18, 0.25), fontRole: "latinRegular" as FontRole },
        { text: truncateTextForWidth(fonts, row.productNameZh, 220), x: 150, color: rgb(0.15, 0.18, 0.25), fontRole: "zhRegular" as FontRole },
        { text: `$${formatMoney(row.unitPrice)}`, x: 378, color: rgb(0.15, 0.18, 0.25), fontRole: "latinRegular" as FontRole },
        { text: formatPercent(row.discountRate), x: 438, color: rgb(0.15, 0.18, 0.25), fontRole: "latinRegular" as FontRole },
        { text: String(row.stockedQty), x: 500, color: rgb(0.15, 0.18, 0.25), fontRole: "latinRegular" as FontRole },
        { text: `$${formatMoney(row.stockAmount)}`, x: 554, color: rgb(0.15, 0.18, 0.25), fontRole: "latinRegular" as FontRole },
        { text: formatDateOnly(row.stockedAt), x: 638, color: rgb(0.15, 0.18, 0.25), fontRole: "latinRegular" as FontRole },
        { text: String(Math.max(row.shippedQty, 0)), x: 728, color: rgb(0.15, 0.18, 0.25), fontRole: "latinRegular" as FontRole },
        { text: String(Math.max(row.remainingQty, 0)), x: 764, color: rgb(0.15, 0.18, 0.25), fontRole: "latinRegular" as FontRole },
        { text: getStatusLabel(row.status), x: 796, color: getInventoryStatusColor(row.status), fontRole: "zhRegular" as FontRole },
      ];

      values.forEach((entry) => {
        drawText(page, entry.text, {
          x: entry.x,
          y: cursorY + 1,
          size: 8.5,
          fonts,
          color: entry.color,
          fontRole: entry.fontRole,
        });
      });
      page.drawLine({
        start: { x: 28, y: cursorY - 6 },
        end: { x: 814, y: cursorY - 6 },
        thickness: 0.8,
        color: rgb(0.86, 0.89, 0.94),
      });
      cursorY -= 22;
    }
  }

  return Buffer.from(await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    updateFieldAppearances: false,
  }));
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
        fontRole: /[\u3400-\u9FFF\uF900-\uFAFF]/.test(entry.text) ? "zhRegular" : "latinRegular",
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

  return Buffer.from(await pdfDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    updateFieldAppearances: false,
  }));
}
