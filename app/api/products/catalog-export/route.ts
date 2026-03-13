import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { buildProductImageUrls, HAS_REMOTE_PRODUCT_IMAGE_BASE } from "@/lib/product-image-url";

export const runtime = "nodejs";
const REMOTE_IMAGE_FETCH_TIMEOUT_MS = 2500;

type ProductRow = {
  sku: string;
  barcode: string | null;
  name_zh: string | null;
  name_es: string | null;
  case_pack: number | null;
  carton_pack: number | null;
  price: unknown;
};

type DocumentSettings = {
  headerText: string;
  footerText: string;
  phone: string;
  logoUrl: string;
  logoPosition: "left" | "right" | "center" | "top" | "bottom";
  headerAlign: "left" | "center" | "right";
  footerAlign: "left" | "center" | "right";
  whatsapp: string;
  wechat: string;
  showWhatsapp: boolean;
  showWechat: boolean;
  showContact: boolean;
  showHeader: boolean;
  showFooter: boolean;
  showLogo: boolean;
};
type ExportLang = "zh" | "es";

function hasChineseGlyph(value: string) {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(String(value || ""));
}

function getDocumentFontName(value: string, options?: { chineseBold?: boolean }) {
  if (hasChineseGlyph(value)) {
    return options?.chineseBold ? "Noto Sans SC Bold" : "Noto Sans SC";
  }
  return "Source Sans 3";
}

function toNumber(value: unknown): number | null {
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

function cleanCategory(value: string) {
  const text = value.trim();
  if (!text || text === "all") return "all";
  return text;
}

function parseBilingualCategory(value: string) {
  const raw = String(value || "").trim();
  if (!raw || raw === "all") {
    return { zh: "全部品类", es: "ALL CATEGORIES" };
  }
  const delimiters = ["|", "｜", "/", "／", ";", "；"];
  for (const delimiter of delimiters) {
    if (raw.includes(delimiter)) {
      const parts = raw
        .split(delimiter)
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        return { zh: parts[0], es: parts[1] };
      }
    }
  }
  return { zh: raw, es: raw };
}

function normalizeCategory(value: string | null | undefined) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractYogoCategoryCode(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/^(\d{1,2})/u);
  return match ? match[1].padStart(2, "0") : "";
}

function parseYogoCodeList(value: string | null | undefined) {
  return String(value || "")
    .split(/[,\s，、;；]+/u)
    .map((item) => item.replace(/\D+/g, "").slice(0, 2))
    .filter(Boolean)
    .map((item) => item.padStart(2, "0"));
}

function safeName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "_");
}

function toExportLang(value: string | null): ExportLang {
  return value === "es" ? "es" : "zh";
}

async function loadImageBySku(sku: string) {
  const exts: Array<"jpg" | "jpeg" | "png" | "webp"> = ["jpg", "jpeg", "png", "webp"];
  // 1) local public/products fallback
  for (const ext of exts) {
    const file = path.join(process.cwd(), "public", "products", `${sku}.${ext}`);
    try {
      const buffer = await fs.readFile(file);
      return {
        buffer,
        ext: ext === "png" ? ("png" as const) : ("jpeg" as const),
      };
    } catch {
      // try next extension
    }
  }
  // 2) remote CDN/R2 source for deployed environments
  if (HAS_REMOTE_PRODUCT_IMAGE_BASE) {
    // Keep remote attempts minimal to avoid long export stalls per SKU.
    const candidates = buildProductImageUrls(sku, ["jpg", "png"]);
    for (const url of candidates) {
      const remote = await loadImageFromUrl(url);
      if (remote) return remote;
    }
  }
  return null;
}

function resolveDisplayNames(item: ProductRow) {
  const normalizeName = (value: string | null | undefined) => {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return "";
    const upper = text.toUpperCase();
    if (
      upper === "0" ||
      upper === "-" ||
      upper === "--" ||
      upper === "N/A" ||
      upper === "NA" ||
      upper === "NULL" ||
      upper === "SIN CONFIGURAR" ||
      text === "未设置"
    ) {
      return "";
    }
    return text;
  };
  const zhRaw = normalizeName(item.name_zh);
  const esRaw = normalizeName(item.name_es);
  const zh = zhRaw || esRaw || "-";
  const es = esRaw || zhRaw || "-";
  return { zh, es };
}

async function loadPdfFont() {
  const candidates = [
    path.join(process.cwd(), "public", "fonts", "NotoSansSC-Regular.ttf"),
    "C:\\Windows\\Fonts\\msyh.ttf",
    "C:\\Windows\\Fonts\\simhei.ttf",
  ];
  for (const file of candidates) {
    try {
      return await fs.readFile(file);
    } catch {
      // continue
    }
  }
  return null;
}

async function loadPdfBoldFont() {
  const candidates = [
    path.join(process.cwd(), "public", "fonts", "NotoSansSC-Bold.ttf"),
    "C:\\Windows\\Fonts\\msyhbd.ttf",
    "C:\\Windows\\Fonts\\simhei.ttf",
  ];
  for (const file of candidates) {
    try {
      return await fs.readFile(file);
    } catch {
      // continue
    }
  }
  return null;
}

function getImageSizeFromBuffer(buffer: Buffer): { width: number; height: number } | null {
  if (!buffer || buffer.length < 24) return null;

  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    if (width > 0 && height > 0) return { width, height };
    return null;
  }

  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      const blockLength = buffer.readUInt16BE(offset + 2);
      const isSof =
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc;
      if (isSof && offset + 8 < buffer.length) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        if (width > 0 && height > 0) return { width, height };
        return null;
      }
      if (blockLength < 2) break;
      offset += 2 + blockLength;
    }
  }

  return null;
}

function columnWidthToPixels(width: number) {
  return Math.floor(width * 7 + 5);
}

function rowHeightToPixels(heightPt: number) {
  return Math.floor((heightPt * 96) / 72);
}

async function loadPdfLatinSansFont() {
  const candidates = [
    path.join(process.cwd(), "public", "fonts", "SourceSans3-Regular.ttf"),
    path.join(process.cwd(), "public", "fonts", "SourceSans3-VariableFont_wght.ttf"),
    path.join(process.cwd(), "public", "fonts", "Arial.ttf"),
    path.join(process.cwd(), "public", "fonts", "Calibri.ttf"),
    "C:\\Windows\\Fonts\\arial.ttf",
    "C:\\Windows\\Fonts\\calibri.ttf",
  ];
  for (const file of candidates) {
    try {
      return await fs.readFile(file);
    } catch {
      // continue
    }
  }
  return null;
}

async function loadPdfLatinBoldFont() {
  const candidates = [
    path.join(process.cwd(), "public", "fonts", "SourceSans3-Bold.ttf"),
    path.join(process.cwd(), "public", "fonts", "SourceSans3-SemiBold.ttf"),
    path.join(process.cwd(), "public", "fonts", "SourceSans3-VariableFont_wght.ttf"),
    "C:\\Windows\\Fonts\\arialbd.ttf",
    "C:\\Windows\\Fonts\\calibrib.ttf",
  ];
  for (const file of candidates) {
    try {
      return await fs.readFile(file);
    } catch {
      // continue
    }
  }
  return null;
}

function shortText(value: string, max = 28) {
  const t = (value || "").trim();
  if (!t) return "-";
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function safePdfText(value: string, unicodeSafe: boolean) {
  if (unicodeSafe) return value || "";
  return (value || "").replace(/[^\x20-\x7E]/g, " ").trim();
}

function formatExportDateEs(date: Date) {
  const yyyy = date.getFullYear();
  const dd = String(date.getDate()).padStart(2, "0");
  const monthsEs = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  const monthEs = monthsEs[date.getMonth()] || "";
  return `${dd} de ${monthEs} de ${yyyy} - Actualizacion de productos`;
}

async function buildCatalogXlsx(
  rows: ProductRow[],
  category: string,
  _onShelfOnly: boolean,
  doc: DocumentSettings,
  lang: ExportLang,
  categoryZh: string,
  categoryEs: string,
) {
  const wb = new ExcelJS.Workbook();
  const sheetName = lang === "es" ? "Catalogo" : "产品清单";
  const ws = wb.addWorksheet(sheetName);

  const labels = {
    headers: {
      image: { zh: "图片", es: "Imagen" },
      code: { zh: "编号", es: "Codigo" },
      nameZh: { zh: "中文名", es: "Nombre CN" },
      nameEs: { zh: "西文名", es: "Nombre ES" },
      pack: { zh: "中包", es: "Paq" },
      carton: { zh: "装箱", es: "Caja" },
      price: { zh: "价格", es: "Precio" },
    },
    updatedZh: "更新于",
    updatedEs: "Actualizado",
    unset: lang === "es" ? "Sin configurar" : "未设置",
    allZh: "全部品类",
    allEs: "TODAS LAS CATEGORIAS",
  };

  const dateText = new Intl.DateTimeFormat(lang === "es" ? "es-MX" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const subtitleLine = `${labels.updatedZh} / ${labels.updatedEs} ${dateText}`;
  const titleZh = categoryZh || (category === "all" ? labels.allZh : category);
  const titleEs = categoryEs || (category === "all" ? labels.allEs : category);

  ws.columns = [
    { key: "image", width: 12.5 },
    { key: "sku", width: 14 },
    { key: "nameZh", width: 30 },
    { key: "nameEs", width: 30 },
    { key: "pack", width: 8 },
    { key: "carton", width: 8 },
    { key: "price", width: 11 },
  ];
  ws.views = [{ state: "frozen", ySplit: 5 }];
  ws.pageSetup = {
    paperSize: 9, // A4
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.35,
      right: 0.35,
      top: 0.45,
      bottom: 0.45,
      header: 0.2,
      footer: 0.2,
    },
  };

  ws.getRow(1).height = 10;

  ws.mergeCells("A2:B3");
  ws.getCell("A2").value = doc.showHeader ? (doc.headerText || "PARKSONMX") : "";
  ws.getCell("A2").font = {
    name: getDocumentFontName(String(ws.getCell("A2").value || ""), { chineseBold: true }),
    size: 15,
    bold: true,
    color: { argb: "FF2F3C7E" },
  };
  ws.getCell("A2").alignment = { horizontal: "left", vertical: "middle" };

  ws.mergeCells("C2:G2");
  ws.getCell("C2").value = titleEs;
  ws.getCell("C2").font = {
    name: "Source Sans 3",
    size: 20,
    bold: true,
    color: { argb: "FF1E293B" },
  };
  ws.getCell("C2").alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells("C3:G3");
  ws.getCell("C3").value = `${titleZh}  ·  ${subtitleLine}`;
  ws.getCell("C3").font = {
    name: getDocumentFontName(titleZh),
    size: 11,
    color: { argb: "FF64748B" },
  };
  ws.getCell("C3").alignment = { horizontal: "center", vertical: "middle" };

  [1, 2, 3].forEach((rowNo) => {
    const row = ws.getRow(rowNo);
    if (rowNo === 1) row.height = 10;
    if (rowNo === 2) row.height = 30;
    if (rowNo === 3) row.height = 22;
    for (let col = 1; col <= 7; col += 1) {
      const cell = row.getCell(col);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBEAEB" } };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    }
  });

  const headerRow = ws.getRow(5);
  headerRow.values = [
    `${labels.headers.image.es}\n${labels.headers.image.zh}`,
    `${labels.headers.code.es}\n${labels.headers.code.zh}`,
    `${labels.headers.nameZh.es}\n${labels.headers.nameZh.zh}`,
    `${labels.headers.nameEs.es}\n${labels.headers.nameEs.zh}`,
    `${labels.headers.pack.es}\n${labels.headers.pack.zh}`,
    `${labels.headers.carton.es}\n${labels.headers.carton.zh}`,
    `${labels.headers.price.es}\n${labels.headers.price.zh}`,
  ];
  headerRow.height = 34;
  headerRow.eachCell((cell) => {
    cell.font = {
      name: getDocumentFontName(String(cell.value || ""), { chineseBold: true }),
      size: 10,
      bold: true,
      color: { argb: "FF334155" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBEAEB" } };
    cell.border = {
      top: { style: "thin", color: { argb: "FFE2E8F0" } },
      left: { style: "thin", color: { argb: "FFE2E8F0" } },
      bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
      right: { style: "thin", color: { argb: "FFE2E8F0" } },
    };
  });

  for (let i = 0; i < rows.length; i += 1) {
    const item = rows[i];
    const rowNo = 6 + i;
    const priceValue = toNumber(item.price);
    const names = resolveDisplayNames(item);
    const nameZh = names.zh;
    const nameEs = names.es === "-" ? labels.unset : names.es;
    const row = ws.getRow(rowNo);
    row.values = [
      "",
      item.sku,
      nameZh || labels.unset,
      nameEs,
      item.case_pack ?? "",
      item.carton_pack ?? "",
      priceValue === null ? "" : `$${priceValue.toFixed(2)}`,
    ];
    row.height = 84;

    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const text = String(cell.value ?? "");
      let fontName = getDocumentFontName(text);
      if (col === 4) {
        fontName = "Source Sans 3";
      } else if (col === 3) {
        fontName = "Noto Sans SC";
      }
      cell.font = {
        name: fontName,
        size: col === 3 ? 10.5 : 10,
        bold: col === 3 || col === 7,
        color: col === 4 ? { argb: "FF475569" } : { argb: "FF111827" },
      };
      if (col === 3 || col === 4) {
        cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      } else if (col >= 5) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      }
      cell.border = {
        top: { style: "thin", color: { argb: "FFE6EBF2" } },
        left: { style: "thin", color: { argb: "FFE6EBF2" } },
        bottom: { style: "thin", color: { argb: "FFE6EBF2" } },
        right: { style: "thin", color: { argb: "FFE6EBF2" } },
      };
    });

    const image = await loadImageBySku(item.sku);
    if (image) {
      const imageId = wb.addImage({
        base64: `data:image/${image.ext};base64,${image.buffer.toString("base64")}`,
        extension: image.ext,
      });
      const natural = getImageSizeFromBuffer(image.buffer);
      const cellWidth = columnWidthToPixels(Number(ws.columns[0]?.width || 18));
      const cellHeight = rowHeightToPixels(Number(row.height || 76));
      const targetWidth = Math.max(1, cellWidth - 6);
      const targetHeight = Math.max(1, cellHeight - 6);
      let drawWidth = targetWidth;
      let drawHeight = targetHeight;
      if (natural && natural.width > 0 && natural.height > 0) {
        const ratio = Math.min(targetWidth / natural.width, targetHeight / natural.height);
        drawWidth = Math.max(1, Math.floor(natural.width * ratio));
        drawHeight = Math.max(1, Math.floor(natural.height * ratio));
      }
      const offsetX = Math.max(0, Math.floor((cellWidth - drawWidth) / 2));
      const offsetY = Math.max(0, Math.floor((cellHeight - drawHeight) / 2));
      ws.addImage(imageId, {
        tl: { col: 0 + offsetX / cellWidth, row: (rowNo - 1) + offsetY / cellHeight },
        ext: { width: drawWidth, height: drawHeight },
      });
    } else {
      row.getCell(1).value = "";
    }
  }

  if (doc.showFooter && doc.footerText) {
    const phonePart = doc.showContact && doc.phone ? `  Tel: ${doc.phone}` : "";
    const waPart = doc.showContact && doc.showWhatsapp && doc.whatsapp ? `  WA: ${doc.whatsapp}` : "";
    const wxPart = doc.showContact && doc.showWechat && doc.wechat ? `  WX: ${doc.wechat}` : "";
    const text = `${doc.footerText}${phonePart}${waPart}${wxPart}`;
    const alignMark = doc.footerAlign === "left" ? "&L" : doc.footerAlign === "center" ? "&C" : "&R";
    ws.headerFooter.oddFooter = `${alignMark}${text}`;
  }
  return wb.xlsx.writeBuffer();
}

async function buildCatalogPdf(
  rows: ProductRow[],
  category: string,
  _onShelfOnly: boolean,
  categoryZh: string,
  categoryEs: string,
  doc: DocumentSettings,
) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = await loadPdfFont();
  const boldFontBytes = await loadPdfBoldFont();
  const unicodeSafe = Boolean(fontBytes);
  const baseFont = fontBytes
    ? await pdfDoc.embedFont(fontBytes, { subset: false })
    : await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = boldFontBytes
    ? await pdfDoc.embedFont(boldFontBytes, { subset: false })
    : fontBytes
      ? baseFont
      : await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const latinSansBytes = await loadPdfLatinSansFont();
  const esFont = latinSansBytes
    ? await pdfDoc.embedFont(latinSansBytes, { subset: false })
    : await pdfDoc.embedFont(StandardFonts.Helvetica);
  const latinBoldBytes = await loadPdfLatinBoldFont();
  const esBoldFont = latinBoldBytes
    ? await pdfDoc.embedFont(latinBoldBytes, { subset: false })
    : await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontForText = (text: string, preferBold = false) => {
    if (hasChineseGlyph(text)) return preferBold ? boldFont : baseFont;
    return preferBold ? esBoldFont : esFont;
  };

  const width = 595.28;
  const height = 841.89;
  const margin = 24;
  const headerH = 148;
  const footerH = 24;
  const cols = 4;
  const colGap = 12;
  const rowGap = 1;
  const cardW = (width - margin * 2 - colGap * (cols - 1)) / cols;
  const cardH = 196;
  const imageBoxH = 90;
  const imageSize = 66;
  const descLineGap = 10.5;
  const metaLineGap = 9;
  const textPad = 6;
  const categoryOffsetY = 36;

  const wrapLines = (
    text: string,
    maxWidth: number,
    size: number,
    font: { widthOfTextAtSize: (v: string, s: number) => number },
  ) => {
    const value = text || "";
    const lines: string[] = [];
    let current = "";
    for (const ch of value) {
      if (ch === "\n") {
        lines.push(current);
        current = "";
        continue;
      }
      const next = `${current}${ch}`;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = ch;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : ["-"];
  };

  const clampWithEllipsis = (lines: string[], limit: number) => {
    if (limit <= 0) return [];
    if (lines.length <= limit) return lines;
    const sliced = lines.slice(0, limit);
    const last = sliced[limit - 1] || "";
    sliced[limit - 1] = last.length > 1 ? `${last.slice(0, -1)}...` : "...";
    return sliced;
  };

  const categoryLineRaw =
    category === "all"
      ? "全部品类 / ALL CATEGORIES"
      : categoryZh && categoryEs && categoryZh !== categoryEs
        ? `${categoryZh} / ${categoryEs}`
        : categoryZh || categoryEs || category;
  const categoryLine = safePdfText(categoryLineRaw, unicodeSafe);
  const titleZh = safePdfText(categoryZh || "-", unicodeSafe) || "-";
  const titleEs = safePdfText(categoryEs || categoryZh || "-", unicodeSafe) || "-";
  const exportDateEs = safePdfText(formatExportDateEs(new Date()), unicodeSafe);
  const spacedEs = /^[\x20-\x7E]+$/.test(titleEs)
    ? titleEs
        .split("")
        .map((ch) => (ch === " " ? "   " : `${ch} `))
        .join("")
        .trim()
    : titleEs;

  const logo = doc.showLogo && doc.logoUrl ? await loadImageFromUrl(doc.logoUrl) : null;

  let page = pdfDoc.addPage([width, height]);

  const drawPageChrome = () => {
    const getAlignedX = (text: string, size: number, align: "left" | "center" | "right") => {
      if (align === "left") return margin;
      const w = fontForText(text).widthOfTextAtSize(text, size);
      if (align === "center") return (width - w) / 2;
      return width - margin - w;
    };
    if (doc.showHeader) {
      const header = doc.headerText || "PARKSONMX";
      page.drawText(header, {
        x: getAlignedX(header, 8, doc.headerAlign),
        y: height - margin - 2,
        size: 8,
        font: fontForText(header),
        color: rgb(0.45, 0.45, 0.45),
      });
    }
    if (categoryLine) {
      const small = titleZh;
      const big = spacedEs;
      const smallW = fontForText(small, true).widthOfTextAtSize(small, 10);
      const bigW = fontForText(big, true).widthOfTextAtSize(big, 22);
      const centerX = width / 2;
      page.drawText(small, {
        x: centerX - smallW / 2,
        y: height - margin - 10 - categoryOffsetY,
        size: 10,
        font: fontForText(small, true),
        color: rgb(0.23, 0.25, 0.3),
      });
      page.drawLine({
        start: { x: centerX - 18, y: height - margin - 20 - categoryOffsetY },
        end: { x: centerX + 18, y: height - margin - 20 - categoryOffsetY },
        thickness: 1.2,
        color: rgb(0.15, 0.15, 0.18),
      });
      page.drawText(big, {
        x: centerX - bigW / 2,
        y: height - margin - 58 - categoryOffsetY,
        size: 22,
        font: fontForText(big, true),
        color: rgb(0.05, 0.05, 0.08),
      });
      const dateW = fontForText(exportDateEs).widthOfTextAtSize(exportDateEs, 8);
      page.drawText(exportDateEs, {
        x: centerX - dateW / 2,
        y: height - margin - 74 - categoryOffsetY,
        size: 8,
        font: fontForText(exportDateEs),
        color: rgb(0.42, 0.45, 0.5),
      });
    }
    if (doc.showFooter) {
      const phonePart = doc.showContact && doc.phone ? `  Tel: ${doc.phone}` : "";
      const waPart = doc.showContact && doc.showWhatsapp && doc.whatsapp ? `  WA: ${doc.whatsapp}` : "";
      const wxPart = doc.showContact && doc.showWechat && doc.wechat ? `  WX: ${doc.wechat}` : "";
      const footer = `${doc.footerText || "BS DU S.A. DE C.V."}${phonePart}${waPart}${wxPart}`;
      page.drawText(footer, {
        x: getAlignedX(footer, 8, doc.footerAlign),
        y: margin - 2,
        size: 8,
        font: fontForText(footer),
        color: rgb(0.45, 0.45, 0.45),
      });
    }
  };

  const drawLogo = async () => {
    if (!logo) return;
    const embedded = logo.ext === "png" ? await pdfDoc.embedPng(logo.buffer) : await pdfDoc.embedJpg(logo.buffer);
    const maxW = 72;
    const maxH = 24;
    const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1);
    const drawW = embedded.width * scale;
    const drawH = embedded.height * scale;
    let x = width - margin - drawW;
    let y = height - margin - drawH - 2;
    switch (doc.logoPosition) {
      case "left":
        x = margin;
        y = height - margin - drawH - 2;
        break;
      case "center":
      case "top":
        x = (width - drawW) / 2;
        y = height - margin - drawH - 2;
        break;
      case "bottom":
        x = (width - drawW) / 2;
        y = margin + 10;
        break;
      case "right":
      default:
        x = width - margin - drawW;
        y = height - margin - drawH - 2;
        break;
    }
    page.drawImage(embedded, { x, y, width: drawW, height: drawH });
  };

  drawPageChrome();
  await drawLogo();
  let y = height - margin - headerH;
  let col = 0;

  for (const item of rows) {
    const sku = safePdfText(item.sku || "-", unicodeSafe) || "-";
    const names = resolveDisplayNames(item);
    const zhLine = safePdfText(names.zh, unicodeSafe) || "-";
    const esLine = safePdfText(names.es, unicodeSafe) || "-";
    const casePack = String(item.case_pack ?? "-");
    const cartonPack = String(item.carton_pack ?? "-");
    const priceNum = toNumber(item.price);
    const price = priceNum !== null ? `$${priceNum.toFixed(2)}` : "-";

    const zhSize = 7.5;
    const esSize = 7;
    const metaLinesCount = 2;
    const minBottomPad = 6;
    const maxNameLineCount = Math.max(
      2,
      Math.floor((cardH - imageBoxH - metaLinesCount * metaLineGap - minBottomPad) / descLineGap),
    );
    const rawZhLines = wrapLines(zhLine, cardW - textPad * 2, zhSize, boldFont);
    const rawEsLines = wrapLines(esLine, cardW - textPad * 2, esSize, esFont);
    const zhLineLimit = Math.min(3, maxNameLineCount);
    const zhLines = clampWithEllipsis(rawZhLines, zhLineLimit);
    const remainingEsLines = Math.max(1, maxNameLineCount - zhLines.length);
    const esLines = clampWithEllipsis(rawEsLines, remainingEsLines);
    if (col === 0 && y - cardH < margin + footerH) {
      page = pdfDoc.addPage([width, height]);
      drawPageChrome();
      await drawLogo();
      y = height - margin - headerH;
    }

    const x = margin + col * (cardW + colGap);
    const topY = y;

    const image = await loadImageBySku(item.sku);
    if (image) {
      const embedded = image.ext === "png" ? await pdfDoc.embedPng(image.buffer) : await pdfDoc.embedJpg(image.buffer);
      const scale = Math.min(imageSize / embedded.width, imageSize / embedded.height, 1);
      const drawW = embedded.width * scale;
      const drawH = embedded.height * scale;
      page.drawImage(embedded, {
        x: x + textPad,
        y: topY - imageBoxH + (imageBoxH - drawH) / 2,
        width: drawW,
        height: drawH,
      });
    }

    let textY = topY - imageBoxH - 2;
    for (const line of zhLines) {
      page.drawText(line, { x: x + textPad, y: textY, size: zhSize, font: fontForText(line, true), color: rgb(0.12, 0.15, 0.2) });
      textY -= descLineGap;
    }
    for (const line of esLines) {
      page.drawText(line, { x: x + textPad, y: textY, size: esSize, font: fontForText(line), color: rgb(0.3, 0.33, 0.38) });
      textY -= descLineGap;
    }
    const skuLine = sku;
    page.drawText(skuLine, { x: x + textPad, y: textY, size: 7.5, font: fontForText(skuLine), color: rgb(0.4, 0.42, 0.45) });
    textY -= metaLineGap;
    const metaPrefix = unicodeSafe
      ? `包装数 ${casePack}  装箱数 ${cartonPack}  `
      : `${casePack}  ${cartonPack}  `;
    const metaPrefixFont = fontForText(metaPrefix);
    const metaPrefixW = metaPrefixFont.widthOfTextAtSize(metaPrefix, 7.5);
    page.drawText(metaPrefix, {
      x: x + textPad,
      y: textY,
      size: 7.5,
      font: metaPrefixFont,
      color: rgb(0.18, 0.2, 0.24),
    });
    page.drawText(price, {
      x: x + textPad + metaPrefixW,
      y: textY,
      size: 7.5,
      font: fontForText(price, true),
      color: rgb(0.08, 0.1, 0.14),
    });

    col += 1;
    if (col >= cols) {
      col = 0;
      y -= cardH + rowGap;
    }
  }

  return pdfDoc.save();
}

async function loadImageFromUrl(url: string) {
  const value = String(url || "").trim();
  if (!value) return null;
  try {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REMOTE_IMAGE_FETCH_TIMEOUT_MS);
      const res = await fetch(value, {
        signal: controller.signal,
        cache: "no-store",
      }).finally(() => clearTimeout(timeout));
      if (!res.ok) return null;
      const contentType = res.headers.get("content-type") || "";
      const ext = contentType.includes("png") ? "png" : "jpeg";
      const arr = await res.arrayBuffer();
      return { buffer: Buffer.from(arr), ext: ext as "png" | "jpeg" };
    }
    const normalized = value.startsWith("/") ? value.slice(1) : value;
    const file = path.join(process.cwd(), "public", normalized);
    const buffer = await fs.readFile(file);
    const lower = normalized.toLowerCase();
    const ext = lower.endsWith(".png") ? "png" : "jpeg";
    return { buffer, ext: ext as "png" | "jpeg" };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    }

    const canManage = await hasPermission(session, "manageProducts");
    const canExport = await hasPermission(session, "exportProductCatalog");
    if (!canManage && !canExport) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") || "xlsx").toLowerCase();
    const lang = toExportLang(searchParams.get("lang"));
    const category = cleanCategory(searchParams.get("category") || "all");
    const onShelfOnly = (searchParams.get("onShelfOnly") || "1") !== "0";
    const isShare = (searchParams.get("share") || "0") === "1";
    const parsedCategory = parseBilingualCategory(category);
    let categoryZh = searchParams.get("categoryZh") || parsedCategory.zh;
    let categoryEs = searchParams.get("categoryEs") || parsedCategory.es;

    const activeCategoryMaps = await withPrismaRetry(() =>
      prisma.productCategoryMap.findMany({
        where: {
          tenant_id: session.tenantId,
          company_id: session.companyId,
          active: true,
        },
        select: { category_zh: true, category_es: true, yogo_code: true },
      }),
    );
    const selectedCategoryMap =
      category === "all"
        ? null
        : activeCategoryMaps.find(
            (item) =>
              normalizeCategory(item.category_zh) === normalizeCategory(category) ||
              normalizeCategory(item.category_es) === normalizeCategory(category),
          ) || null;
    if (selectedCategoryMap) {
      categoryZh = selectedCategoryMap.category_zh;
      categoryEs = selectedCategoryMap.category_es || selectedCategoryMap.category_zh;
    }

    const cfg = await withPrismaRetry(() =>
      prisma.catalogConfig.findUnique({
        where: {
          tenant_id_company_id: {
            tenant_id: session.tenantId,
            company_id: session.companyId,
          },
        },
        select: {
          doc_header: true,
          doc_footer: true,
          doc_phone: true,
          doc_logo_url: true,
          doc_logo_position: true,
          doc_header_align: true,
          doc_footer_align: true,
          doc_whatsapp: true,
          doc_wechat: true,
          doc_show_whatsapp: true,
          doc_show_wechat: true,
          doc_show_contact: true,
          doc_show_header: true,
          doc_show_footer: true,
          doc_show_logo: true,
        },
      }),
    );
    const doc: DocumentSettings = {
      headerText: cfg?.doc_header || "PARKSONMX",
      footerText: cfg?.doc_footer || "BS DU S.A. DE C.V.",
      phone: cfg?.doc_phone || "5530153936",
      logoUrl: cfg?.doc_logo_url || "",
      logoPosition:
        cfg?.doc_logo_position === "left" ||
        cfg?.doc_logo_position === "center" ||
        cfg?.doc_logo_position === "top" ||
        cfg?.doc_logo_position === "bottom"
          ? cfg.doc_logo_position
          : "right",
      headerAlign:
        cfg?.doc_header_align === "center" || cfg?.doc_header_align === "right"
          ? cfg.doc_header_align
          : "left",
      footerAlign:
        cfg?.doc_footer_align === "left" || cfg?.doc_footer_align === "center"
          ? cfg.doc_footer_align
          : "right",
      whatsapp: cfg?.doc_whatsapp || "",
      wechat: cfg?.doc_wechat || "",
      showWhatsapp: cfg?.doc_show_whatsapp ?? false,
      showWechat: cfg?.doc_show_wechat ?? false,
      showContact: cfg?.doc_show_contact ?? true,
      showHeader: cfg?.doc_show_header ?? true,
      showFooter: cfg?.doc_show_footer ?? true,
      showLogo: cfg?.doc_show_logo ?? false,
    };

    const rowsRaw = await withPrismaRetry(() =>
      prisma.yogoProductSource.findMany({
        where: {
          tenant_id: session.tenantId,
          company_id: session.companyId,
          ...(onShelfOnly ? { source_disabled: false } : {}),
        },
        orderBy: [{ category_name: "asc" }, { product_code: "asc" }],
        select: {
          product_code: true,
          product_no: true,
          name_cn: true,
          name_es: true,
          category_name: true,
          case_pack: true,
          carton_pack: true,
          source_price: true,
        },
      }),
    );

    let selectedRows = rowsRaw;
    if (category !== "all") {
      const selectedCode = category.replace(/\D+/g, "").slice(0, 2).padStart(2, "0");
      const mappedCodes = selectedCategoryMap ? parseYogoCodeList(selectedCategoryMap.yogo_code) : [];
      if (mappedCodes.length > 0) {
        const mappedCodeSet = new Set(mappedCodes);
        selectedRows = rowsRaw.filter((row) =>
          mappedCodeSet.has(extractYogoCategoryCode(row.category_name)),
        );
      } else {
        const normalizedSelected = normalizeCategory(category);
        selectedRows = rowsRaw.filter((row) => {
          const normalizedCategoryName = normalizeCategory(row.category_name);
          const code = extractYogoCategoryCode(row.category_name);
          return (
            normalizedCategoryName.includes(normalizedSelected) ||
            (selectedCode && code === selectedCode)
          );
        });
      }
    }
    const rows: ProductRow[] = selectedRows.map((row) => ({
      sku: row.product_code,
      barcode: row.product_no,
      name_zh: row.name_cn,
      name_es: row.name_es,
      case_pack: row.case_pack ?? null,
      carton_pack: row.carton_pack ?? null,
      price: row.source_price,
    }));

    if (format === "pdf") {
      const bytes = await buildCatalogPdf(
        rows,
        category,
        onShelfOnly,
        categoryZh,
        categoryEs,
        doc,
      );
      const name = safeName(`PARKSONMX-${category === "all" ? "ALL" : category}.pdf`);
      return new NextResponse(Buffer.from(bytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `${isShare ? "inline" : "attachment"}; filename="${encodeURIComponent(name)}"`,
        },
      });
    }

    const bytes = await buildCatalogXlsx(rows, category, onShelfOnly, doc, lang, categoryZh, categoryEs);
    const name = safeName(`PARKSONMX-${category === "all" ? "ALL" : category}.xlsx`);
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `${isShare ? "inline" : "attachment"}; filename="${encodeURIComponent(name)}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "导出失败" }, { status: 500 });
  }
}
