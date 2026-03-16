import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { parseBillingRemark } from "@/lib/billing-meta";
import { prisma } from "@/lib/prisma";
import { buildProductImageUrls } from "@/lib/product-image-url";

export type BillingExportItem = {
  sku: string;
  barcode: string;
  nameZh: string;
  nameEs: string;
  qty: number;
  unitPrice: number;
  normalDiscount: number | null;
  vipDiscount: number | null;
  lineTotal: number;
};

export type BillingExportData = {
  orderNo: string;
  companyName: string;
  contactName: string;
  contactPhone: string;
  addressText: string;
  remarkText: string;
  storeLabelText: string;
  updatedAt: Date | null;
  itemCount: number;
  totalQty: number;
  totalAmount: number;
  vipDiscountEnabled: boolean;
  items: BillingExportItem[];
  issueDateText: string;
  boxCountText: string;
  shipDateText: string;
  warehouseText: string;
  shippingMethodText: string;
  recipientNameText: string;
  recipientPhoneText: string;
  carrierCompanyText: string;
};

export function buildBillingExportBaseName(data: Pick<BillingExportData, "orderNo" | "companyName" | "vipDiscountEnabled">) {
  const companyName = String(data.companyName || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const safeCompanyName = companyName || "NoCompany";
  return `${data.orderNo}-${safeCompanyName}${data.vipDiscountEnabled ? "-vip" : ""}`;
}

function hasChineseGlyph(value: string) {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(String(value || ""));
}

function getDocumentFontName(value: string, options?: { chineseBold?: boolean }) {
  if (hasChineseGlyph(value)) {
    return options?.chineseBold ? "Microsoft YaHei Bold" : "Microsoft YaHei";
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

function toMoney(value: number) {
  return value.toFixed(2);
}

function toPercentText(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  const percent = value <= 1 ? value * 100 : value;
  const rounded = Number.isInteger(percent)
    ? String(percent)
    : percent.toFixed(2).replace(/\.?0+$/, "");
  return `${rounded}%`;
}

function toDiscountFactor(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return value > 1 ? value / 100 : value;
}

function computeLineTotal(
  qty: number,
  unitPrice: number,
  normalDiscount: number | null,
  vipDiscount: number | null,
  vipDiscountEnabled: boolean,
) {
  let factor = 1;
  if (normalDiscount !== null) factor *= 1 - normalDiscount;
  if (vipDiscountEnabled && vipDiscount !== null) factor *= 1 - vipDiscount;
  return qty * unitPrice * factor;
}

function baseOrderNo(receiptNo: string) {
  const head = String(receiptNo || "")
    .trim()
    .split("-")[0];
  return head || String(receiptNo || "").trim();
}

function formatDateOnly(value: Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
    timeZone: "America/Mexico_City",
  }).format(value);
}

const FIXED_WAREHOUSE = "PARKSONMX仓";

async function loadProductImageBuffer(sku: string, barcode: string) {
  const keys = [sku, barcode].map((item) => item.trim()).filter(Boolean);
  if (keys.length === 0) return null;

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

  for (const key of keys) {
    const remoteUrls = buildProductImageUrls(key, ["jpg", "jpeg", "png", "webp"]);
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
  }

  return null;
}

async function loadPdfFontBytes() {
  const fontCandidates = [
    path.join(process.cwd(), "public", "fonts", "NotoSansCJKsc-Regular.otf"),
    path.join(process.cwd(), "public", "fonts", "NotoSansSC-Regular.ttf"),
    "C:\\Windows\\Fonts\\msyh.ttf",
    "C:\\Windows\\Fonts\\simhei.ttf",
  ];

  for (const fontPath of fontCandidates) {
    try {
      return await fs.readFile(fontPath);
    } catch {
      // try next candidate
    }
  }

  return null;
}

async function loadPdfBoldFontBytes() {
  const fontCandidates = [
    path.join(process.cwd(), "public", "fonts", "NotoSansCJKsc-Bold.otf"),
    "C:\\Windows\\Fonts\\msyhbd.ttf",
    "C:\\Windows\\Fonts\\simhei.ttf",
  ];

  for (const fontPath of fontCandidates) {
    try {
      return await fs.readFile(fontPath);
    } catch {
      // try next candidate
    }
  }

  return null;
}

async function loadPdfLatinFontBytes() {
  const fontCandidates = [
    path.join(process.cwd(), "public", "fonts", "SourceSans3-Regular.ttf"),
    path.join(process.cwd(), "public", "fonts", "SourceSans3-VariableFont_wght.ttf"),
    "C:\\Windows\\Fonts\\arial.ttf",
    "C:\\Windows\\Fonts\\calibri.ttf",
  ];

  for (const fontPath of fontCandidates) {
    try {
      return await fs.readFile(fontPath);
    } catch {
      // try next candidate
    }
  }

  return null;
}

async function loadBillingLogoBuffer() {
  const filePath = path.join(process.cwd(), "public", "BSLOGO.png");
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

function safePdfText(value: string, unicodeSafe: boolean) {
  const normalized = String(value || "").replace(/[\r\n\t]+/g, " ");
  if (unicodeSafe) return normalized;
  return normalized.replace(/[^\x20-\x7E]/g, " ");
}

function wrapTextByWidth(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number,
  unicodeSafe: boolean,
) {
  const normalized = safePdfText(text || "", unicodeSafe).trim();
  if (!normalized) return ["-"];

  const lines: string[] = [];
  let current = "";

  for (const char of normalized) {
    const next = current + char;
    if (font.widthOfTextAtSize(next, fontSize) <= maxWidth || current.length === 0) {
      current = next;
      continue;
    }
    lines.push(current);
    current = char;
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : ["-"];
}

export async function getBillingExportData(params: {
  orderNo: string;
  tenantId: string;
  companyId: string;
  vipDiscountEnabled: boolean;
}) {
  const { orderNo, tenantId, companyId, vipDiscountEnabled } = params;

  const receipts = await prisma.receipt.findMany({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      status: "completed",
      receipt_no: {
        startsWith: orderNo,
      },
    },
    select: {
      receipt_no: true,
      updated_at: true,
      items: {
        select: {
          sku: true,
          barcode: true,
          name_zh: true,
          name_es: true,
          expected_qty: true,
          sell_price: true,
          normal_discount: true,
          vip_discount: true,
          line_total: true,
        },
      },
    },
    orderBy: { updated_at: "desc" },
  });

  const matchedReceipts = receipts.filter((receipt) => baseOrderNo(receipt.receipt_no) === orderNo);
  if (matchedReceipts.length === 0) return null;

  const skuList = Array.from(
    new Set(
      matchedReceipts.flatMap((receipt) =>
        receipt.items
          .map((item) => String(item.sku || "").trim())
          .filter((sku) => sku.length > 0),
      ),
    ),
  );

  const productDiscountRows =
    skuList.length > 0
      ? await prisma.productCatalog.findMany({
          where: {
            tenant_id: tenantId,
            company_id: companyId,
            sku: { in: skuList },
          },
          select: {
            sku: true,
            normal_discount: true,
            vip_discount: true,
          },
        })
      : [];

  const productDiscountMap = new Map(
    productDiscountRows.map((row) => [
      String(row.sku || "").trim(),
      {
        normalDiscount: row.normal_discount === null ? null : Number(row.normal_discount),
        vipDiscount: row.vip_discount === null ? null : Number(row.vip_discount),
      },
    ]),
  );

  const itemsMap = new Map<string, BillingExportItem>();
  let totalAmount = 0;
  let totalQty = 0;
  let updatedAt: Date | null = null;

  for (const receipt of matchedReceipts) {
    if (!updatedAt || updatedAt.getTime() < receipt.updated_at.getTime()) {
      updatedAt = receipt.updated_at;
    }

    for (const item of receipt.items) {
      const sku = String(item.sku || "").trim();
      const barcode = String(item.barcode || "").trim();
      const qty = Number(item.expected_qty || 0);
      const unitPrice = toNumber(item.sell_price) || 0;
      const catalogDiscount = productDiscountMap.get(sku);
      const normalDiscountRaw =
        catalogDiscount?.normalDiscount ??
        (item.normal_discount === null ? null : Number(item.normal_discount));
      const vipDiscountRaw =
        catalogDiscount?.vipDiscount ??
        (item.vip_discount === null ? null : Number(item.vip_discount));
      const normalDiscount = toDiscountFactor(normalDiscountRaw);
      const vipDiscount = toDiscountFactor(vipDiscountRaw);
      const lineTotal = computeLineTotal(
        qty,
        unitPrice,
        normalDiscount,
        vipDiscount,
        vipDiscountEnabled,
      );

      totalAmount += lineTotal;
      totalQty += qty;

      const key = `${sku}|${barcode}`;
      const old = itemsMap.get(key);
      if (!old) {
        itemsMap.set(key, {
          sku,
          barcode,
          nameZh: String(item.name_zh || "").trim(),
          nameEs: String(item.name_es || "").trim(),
          qty,
          unitPrice,
          normalDiscount:
            normalDiscountRaw !== null && Number.isFinite(normalDiscountRaw) ? normalDiscountRaw : null,
          vipDiscount:
            vipDiscountRaw !== null && Number.isFinite(vipDiscountRaw) ? vipDiscountRaw : null,
          lineTotal,
        });
      } else {
        old.qty += qty;
        old.lineTotal += lineTotal;
        if (!old.nameZh) old.nameZh = String(item.name_zh || "").trim();
        if (!old.nameEs) old.nameEs = String(item.name_es || "").trim();
        if (old.normalDiscount === null && normalDiscountRaw !== null && Number.isFinite(normalDiscountRaw)) {
          old.normalDiscount = normalDiscountRaw;
        }
        if (old.vipDiscount === null && vipDiscountRaw !== null && Number.isFinite(vipDiscountRaw)) {
          old.vipDiscount = vipDiscountRaw;
        }
      }
    }
  }

  const orderRow = await prisma.ygOrderImport.findFirst({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      order_no: orderNo,
    },
    select: {
      company_name: true,
      customer_name: true,
      contact_name: true,
      contact_phone: true,
      address_text: true,
      order_remark: true,
      store_label: true,
    },
  });
  const parsedRemark = parseBillingRemark(orderRow?.order_remark);
  const exportDate = formatDateOnly(new Date());

  return {
    orderNo,
    companyName: orderRow?.company_name || orderRow?.customer_name || "-",
    contactName: orderRow?.contact_name || orderRow?.customer_name || orderRow?.company_name || "-",
    contactPhone: orderRow?.contact_phone || "-",
    addressText: orderRow?.address_text || "",
    remarkText: orderRow?.order_remark || "",
    storeLabelText: orderRow?.store_label || "",
    updatedAt,
    itemCount: itemsMap.size,
    totalQty,
    totalAmount,
    vipDiscountEnabled,
    items: Array.from(itemsMap.values()),
    issueDateText: exportDate,
    boxCountText: parsedRemark.meta.boxCount,
    shipDateText: parsedRemark.meta.shipDate,
    warehouseText: FIXED_WAREHOUSE,
    shippingMethodText: parsedRemark.meta.shippingMethod,
    recipientNameText:
      parsedRemark.meta.recipientName ||
      orderRow?.contact_name ||
      orderRow?.customer_name ||
      orderRow?.company_name ||
      "",
    recipientPhoneText: parsedRemark.meta.recipientPhone || orderRow?.contact_phone || "",
    carrierCompanyText: parsedRemark.meta.carrierCompany,
  } satisfies BillingExportData;
}

export async function buildBillingXlsx(data: BillingExportData) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("账单明细", {
    views: [{ state: "frozen", ySplit: 7, showGridLines: true }],
  });

  worksheet.properties.defaultRowHeight = 24;
  worksheet.columns = [
    { key: "image", width: 12 },
    { key: "sku", width: 16 },
    { key: "barcode", width: 20 },
    { key: "nameZh", width: 20 },
    { key: "nameEs", width: 30 },
    { key: "qty", width: 10 },
    { key: "unitPrice", width: 10 },
    { key: "normalDiscount", width: 12 },
    ...(data.vipDiscountEnabled ? [{ key: "vipDiscount", width: 12 }] : []),
    { key: "lineTotal", width: 12 },
  ];

  worksheet.mergeCells("A1:B1");
  worksheet.getCell("A1").value = "ParksonMX";
  worksheet.getCell("A1").font = {
    name: getDocumentFontName("ParksonMX", { chineseBold: true }),
    size: 20,
    bold: true,
    color: { argb: "FF111827" },
  };
  worksheet.getCell("A1").alignment = { vertical: "middle", horizontal: "left" };
  worksheet.getRow(1).height = 34;

  const infoRows = [
    ["账单号", data.orderNo],
    ["商品数", String(data.itemCount)],
    ["合计", toMoney(data.totalAmount)],
    ["VIP折扣", data.vipDiscountEnabled ? "启用" : "关闭"],
    ["更新时间", formatDateOnly(data.updatedAt)],
  ];

  infoRows.forEach(([label, value], index) => {
    const rowNumber = index + 2;
    worksheet.getCell(`A${rowNumber}`).value = label;
    worksheet.getCell(`B${rowNumber}`).value = value;
    worksheet.getCell(`A${rowNumber}`).font = {
      name: getDocumentFontName(label, { chineseBold: true }),
      size: 11,
      bold: true,
      color: { argb: "FF111827" },
    };
    worksheet.getCell(`B${rowNumber}`).font = {
      name: getDocumentFontName(String(value || "")),
      size: 11,
      color: { argb: "FF111827" },
    };
    worksheet.getCell(`A${rowNumber}`).alignment = { vertical: "middle", horizontal: "left" };
    worksheet.getCell(`B${rowNumber}`).alignment = { vertical: "middle", horizontal: "left" };
  });

  const headerRowNumber = 7;
  const headerValues = [
    "图片",
    "编号",
    "条形码",
    "中文名",
    "西文名",
    "数量",
    "单价",
    "普通折扣",
    ...(data.vipDiscountEnabled ? ["VIP折扣"] : []),
    "金额",
  ];
  const headerRow = worksheet.getRow(headerRowNumber);
  headerRow.values = headerValues;
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.font = {
      name: getDocumentFontName(String(cell.value || ""), { chineseBold: true }),
      size: 11,
      bold: true,
      color: { argb: "FF334155" },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD9E1EA" } },
      left: { style: "thin", color: { argb: "FFD9E1EA" } },
      bottom: { style: "thin", color: { argb: "FFD9E1EA" } },
      right: { style: "thin", color: { argb: "FFD9E1EA" } },
    };
  });

  for (let i = 0; i < data.items.length; i += 1) {
    const item = data.items[i];
    const rowNumber = headerRowNumber + 1 + i;
    const row = worksheet.getRow(rowNumber);
    row.height = 44;

    const values = [
      "",
      item.sku || "",
      item.barcode || "",
      item.nameZh || "",
      item.nameEs || "",
      item.qty,
      item.unitPrice,
      toPercentText(item.normalDiscount),
      ...(data.vipDiscountEnabled ? [toPercentText(item.vipDiscount)] : []),
      Number(toMoney(item.lineTotal)),
    ];
    row.values = values;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const text = String(cell.value ?? "");
      cell.font = {
        name: getDocumentFontName(text),
        size: 11,
        color: { argb: "FF111827" },
      };
      cell.alignment =
        colNumber === 4 || colNumber === 5
          ? { vertical: "middle", horizontal: "left" }
          : { vertical: "middle", horizontal: "center" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });

    const image = await loadProductImageBuffer(item.sku, item.barcode);
    if (image) {
      const imageId = workbook.addImage({
        base64: `data:image/${image.extension};base64,${image.buffer.toString("base64")}`,
        extension: image.extension,
      });
      worksheet.addImage(imageId, `A${rowNumber}:A${rowNumber}`);
    } else {
      row.getCell(1).value = "-";
    }
  }

  return workbook.xlsx.writeBuffer();
}

export async function buildBillingPdf(data: BillingExportData) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const fontBytes = await loadPdfFontBytes();
  const boldFontBytes = await loadPdfBoldFontBytes();
  const latinFontBytes = await loadPdfLatinFontBytes();
  const unicodeSafe = Boolean(fontBytes);

  const bodyFont = fontBytes
    ? await pdfDoc.embedFont(fontBytes, { subset: false })
    : await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bodyBoldFont = boldFontBytes
    ? await pdfDoc.embedFont(boldFontBytes, { subset: false })
    : bodyFont;
  const esFont = latinFontBytes
    ? await pdfDoc.embedFont(latinFontBytes, { subset: true })
    : await pdfDoc.embedFont(StandardFonts.Helvetica);
  const latinBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logoBuffer = await loadBillingLogoBuffer();
  const pageWidth = 792;
  const pageHeight = 612;
  const marginLeft = 28;
  const marginRight = 28;
  const topMargin = 24;
  const bottomMargin = 28;
  const tableFontSize = 7.6;
  const lineGap = 9;
  const cellPaddingX = 5;
  const cellPaddingY = 6;

  const columns = [
    { label: "\u56fe\u7247", width: 48, align: "center" as const },
    { label: "\u7f16\u7801", width: 64, align: "center" as const },
    { label: "\u6761\u5f62\u7801", width: 84, align: "center" as const },
    { label: "\u4e2d\u6587\u540d", width: 112, align: "left" as const },
    { label: "\u897f\u6587\u540d", width: 168, align: "left" as const },
    { label: "\u6570\u91cf", width: 38, align: "center" as const },
    { label: "\u5355\u4ef7", width: 54, align: "right" as const },
    { label: "\u666e\u901a\u6298\u6263", width: 56, align: "center" as const },
    ...(data.vipDiscountEnabled ? [{ label: "VIP\u6298\u6263", width: 56, align: "center" as const }] : []),
    { label: "\u91d1\u989d", width: 62, align: "right" as const },
  ];
  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const contentLeft = Math.max(Math.floor((pageWidth - tableWidth) / 2), marginLeft);
  const contentRight = contentLeft + tableWidth;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - topMargin;

  const fontForText = (text: string, preferBold = false) => {
    if (hasChineseGlyph(text)) return preferBold ? bodyBoldFont : bodyFont;
    return preferBold ? latinBoldFont : esFont;
  };

  const drawText = (
    text: string,
    x: number,
    y: number,
    options?: { size?: number; font?: PDFFont; color?: { r: number; g: number; b: number } },
  ) => {
    page.drawText(safePdfText(text, unicodeSafe), {
      x,
      y,
      size: options?.size ?? tableFontSize,
      font: options?.font ?? fontForText(text),
      color: rgb(options?.color?.r ?? 0.15, options?.color?.g ?? 0.2, options?.color?.b ?? 0.3),
    });
  };

  const drawLeftText = (
    text: string,
    x: number,
    y: number,
    options?: { size?: number; font?: PDFFont; color?: { r: number; g: number; b: number } },
  ) => {
    drawText(text, x, y, options);
  };

  const drawCenteredText = (
    text: string,
    cellX: number,
    cellY: number,
    cellWidth: number,
    cellHeight: number,
    size = tableFontSize,
    font?: PDFFont,
  ) => {
    const safeText = safePdfText(text, unicodeSafe);
    const actualFont = font ?? fontForText(text);
    const textWidth = actualFont.widthOfTextAtSize(safeText, size);
    const x = cellX + Math.max((cellWidth - textWidth) / 2, 2);
    const y = cellY + (cellHeight - size) / 2 + 1;
    drawText(safeText, x, y, { size, font: actualFont });
  };

  const drawRightText = (
    text: string,
    rightX: number,
    y: number,
    options?: { size?: number; font?: PDFFont; color?: { r: number; g: number; b: number } },
  ) => {
    const safeText = safePdfText(text, unicodeSafe);
    const font = options?.font ?? fontForText(text);
    const size = options?.size ?? tableFontSize;
    const textWidth = font.widthOfTextAtSize(safeText, size);
    drawText(safeText, rightX - textWidth, y, { ...options, size, font });
  };

  const drawHeaderInfo = async () => {
    drawText("PARKSONMX", contentLeft, cursorY - 2, {
      size: 12,
      font: latinBoldFont,
      color: { r: 0.18, g: 0.31, b: 0.55 },
    });
    if (logoBuffer) {
      try {
        const logo = await pdfDoc.embedPng(logoBuffer);
        const logoScale = Math.min(74 / logo.width, 26 / logo.height);
        const logoWidth = Math.max(1, logo.width * logoScale);
        const logoHeight = Math.max(1, logo.height * logoScale);
        page.drawImage(logo, {
          x: contentRight - logoWidth,
          y: cursorY - logoHeight + 6,
          width: logoWidth,
          height: logoHeight,
        });
      } catch {
        // ignore logo failure
      }
    }
    cursorY -= 24;

    const sectionWidth = tableWidth;
    const halfGap = 18;
    const halfWidth = (sectionWidth - halfGap) / 2;
    const leftBaseX = contentLeft;
    const leftLabelX = leftBaseX + 10;
    const leftValueX = leftBaseX + 188;
    const rightBaseX = contentLeft + halfWidth + halfGap;
    const rightLabelX = rightBaseX + 10;
    const rightValueX = rightBaseX + 188;
    const valueWidth = halfWidth - 196;

    const drawField = (
      label: string,
      value: string,
      baseX: number,
      labelX: number,
      valX: number,
      rowTopY: number,
    ) => {
      const lines = wrapTextByWidth(value || "-", fontForText(value || "-"), 9.2, valueWidth, unicodeSafe);
      drawLeftText(label, labelX, rowTopY - 16, {
        size: 8.8,
        font: fontForText(label, true),
        color: { r: 0.12, g: 0.12, b: 0.14 },
      });
      let lineY = rowTopY - 16;
      for (const line of lines) {
        drawLeftText(line, valX, lineY, {
          size: 8.8,
          font: fontForText(line),
          color: { r: 0.2, g: 0.26, b: 0.5 },
        });
        lineY -= 9.5;
      }
      const rowHeight = Math.max(19, lines.length * 9.5 + 6);
      page.drawLine({
        start: { x: baseX + 180, y: rowTopY - rowHeight + 2 },
        end: { x: baseX + halfWidth, y: rowTopY - rowHeight + 2 },
        thickness: 0.6,
        color: rgb(0.86, 0.88, 0.91),
      });
      return rowHeight;
    };

    const firstRowHeight = Math.max(
      drawField("\u5ba2\u6237\u540d\u79f0 Nom. Cte.", data.companyName || "-", leftBaseX, leftLabelX, leftValueX, cursorY),
      drawField("\u8ba2\u5355\u53f7 NO. PED.", data.orderNo || "-", rightBaseX, rightLabelX, rightValueX, cursorY),
    );
    cursorY -= firstRowHeight + 4;

    const pairs: Array<[[string, string], [string, string] | null]> = [
      [["\u51fa\u8d26\u65e5\u671f F. FACT.", data.issueDateText || "-"], ["\u5408\u8ba1\u91d1\u989d MTO. TOTAL", `$${toMoney(data.totalAmount)}`]],
      [["\u5546\u54c1\u603b\u6570\u91cf TOTAL PROD.", String(data.totalQty || 0)], ["\u88c5\u7bb1\u4ef6\u6570 CANT. CAJAS", data.boxCountText || "-"]],
      [["\u53d1\u8d27\u65e5\u671f F. ENV.", data.shipDateText || "-"], ["\u53d1\u8d27\u4ed3 DEP. ENV\u00cdO", data.warehouseText || "-"]],
      [["\u53d1\u8d27\u65b9\u5f0f MET. ENV.", data.shippingMethodText || "-"], ["\u6536\u8d27\u4eba DEST.", data.recipientNameText || "-"]],
      [["\u9001\u8d27\u5730\u5740 DIR. ENT.", data.addressText || "-"], ["\u6536\u8d27\u7535\u8bdd TEL. DEST.", data.recipientPhoneText || "-"]],
      [["\u6258\u8fd0\u516c\u53f8 EMP. TRANSP.", data.carrierCompanyText || "-"], null],
    ];

    for (const [leftField, rightField] of pairs) {
      const leftHeight = drawField(leftField[0], leftField[1], leftBaseX, leftLabelX, leftValueX, cursorY);
      const rightHeight = rightField
        ? drawField(rightField[0], rightField[1], rightBaseX, rightLabelX, rightValueX, cursorY)
        : leftHeight;
      cursorY -= Math.max(leftHeight, rightHeight) + 2;
    }

    cursorY -= 6;
  };

  const drawTableHeader = () => {
    const headerHeight = 24;
    let x = contentLeft;
    for (const col of columns) {
      page.drawRectangle({
        x,
        y: cursorY - headerHeight + 4,
        width: col.width,
        height: headerHeight,
        color: rgb(0.97, 0.98, 0.99),
        borderColor: rgb(0.88, 0.9, 0.93),
        borderWidth: 0.6,
      });
      if (col.align === "right") {
        drawRightText(col.label, x + col.width - 4, cursorY - headerHeight / 2 - 1, {
          size: 7.6,
          font: fontForText(col.label, true),
          color: { r: 0.18, g: 0.2, b: 0.24 },
        });
      } else if (col.align === "center") {
        drawCenteredText(col.label, x, cursorY - headerHeight + 4, col.width, headerHeight, 7.6, fontForText(col.label, true));
      } else {
        drawLeftText(col.label, x + 4, cursorY - headerHeight / 2 - 1, {
          size: 7.6,
          font: fontForText(col.label, true),
          color: { r: 0.46, g: 0.48, b: 0.53 },
        });
      }
      x += col.width;
    }
    cursorY -= headerHeight + 6;
  };

  const createNewPage = async () => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    cursorY = pageHeight - topMargin;
    drawTableHeader();
  };

  await drawHeaderInfo();
  drawTableHeader();

  for (const item of data.items) {
    const titleZh = item.nameZh || "-";
    const titleEs = item.nameEs || "-";
    const zhLines = wrapTextByWidth(
      titleZh,
      bodyFont,
      tableFontSize,
      columns[3].width - cellPaddingX * 2,
      unicodeSafe,
    );
    const esLines = wrapTextByWidth(
      titleEs,
      esFont,
      7.8,
      columns[4].width - cellPaddingX * 2,
      unicodeSafe,
    );
    const rowHeight = Math.max(
      40,
      Math.max(zhLines.length, esLines.length, 1) * lineGap + cellPaddingY * 2,
    );

    if (cursorY - rowHeight < bottomMargin) {
      await createNewPage();
    }

    const rowBottomY = cursorY - rowHeight + 2;
    let borderX = contentLeft;
    for (const col of columns) {
      page.drawRectangle({
        x: borderX,
        y: rowBottomY,
        width: col.width,
        height: rowHeight,
        borderColor: rgb(0.9, 0.92, 0.94),
        borderWidth: 0.4,
        color: rgb(1, 1, 1),
      });
      borderX += col.width;
    }

    let currentX = contentLeft;
    const imageBuffer = await loadProductImageBuffer(item.sku, item.barcode);
    if (imageBuffer) {
      try {
        const embedded =
          imageBuffer.extension === "png"
            ? await pdfDoc.embedPng(imageBuffer.buffer)
            : await pdfDoc.embedJpg(imageBuffer.buffer);
        const imageSize = Math.min(34, columns[0].width - 8, rowHeight - 8);
        page.drawImage(embedded, {
          x: currentX + (columns[0].width - imageSize) / 2,
          y: rowBottomY + (rowHeight - imageSize) / 2,
          width: imageSize,
          height: imageSize,
        });
      } catch {
        drawCenteredText("-", currentX, rowBottomY, columns[0].width, rowHeight);
      }
    } else {
      drawCenteredText("-", currentX, rowBottomY, columns[0].width, rowHeight);
    }
    currentX += columns[0].width;

    drawCenteredText(item.sku || "-", currentX, rowBottomY, columns[1].width, rowHeight);
    currentX += columns[1].width;
    drawCenteredText(item.barcode || "-", currentX, rowBottomY, columns[2].width, rowHeight);
    currentX += columns[2].width;

    let zhY = rowBottomY + rowHeight - 14;
    for (const line of zhLines) {
      drawLeftText(line, currentX + cellPaddingX, zhY, {
        size: tableFontSize,
        font: bodyFont,
        color: { r: 0.16, g: 0.18, b: 0.22 },
      });
      zhY -= lineGap;
    }
    currentX += columns[3].width;

    let esY = rowBottomY + rowHeight - 14;
    for (const line of esLines) {
      drawLeftText(line, currentX + cellPaddingX, esY, {
        size: 7.8,
        font: esFont,
        color: { r: 0.42, g: 0.45, b: 0.5 },
      });
      esY -= lineGap;
    }
    currentX += columns[4].width;

    drawCenteredText(String(item.qty), currentX, rowBottomY, columns[5].width, rowHeight);
    currentX += columns[5].width;
    drawRightText(`$${toMoney(item.unitPrice)}`, currentX + columns[6].width - 6, rowBottomY + (rowHeight - tableFontSize) / 2 + 1);
    currentX += columns[6].width;
    drawCenteredText(toPercentText(item.normalDiscount), currentX, rowBottomY, columns[7].width, rowHeight);
    currentX += columns[7].width;
    if (data.vipDiscountEnabled) {
      drawCenteredText(toPercentText(item.vipDiscount), currentX, rowBottomY, columns[8].width, rowHeight);
      currentX += columns[8].width;
    }
    drawRightText(`$${toMoney(item.lineTotal)}`, currentX + columns[columns.length - 1].width - 6, rowBottomY + (rowHeight - tableFontSize) / 2 + 1);

    cursorY -= rowHeight;
  }

  return pdfDoc.save({ useObjectStreams: true });
}
