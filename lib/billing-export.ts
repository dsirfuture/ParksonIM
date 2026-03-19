// @ts-nocheck
import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { formatStoreLabelDisplay, getPaymentTermDisplayLines, normalizeStoreLabelInput, parseBillingBooleanFlag, parseBillingRemark } from "@/lib/billing-meta";
import { prisma } from "@/lib/prisma";
import { buildProductImageUrls } from "@/lib/product-image-url";
import { parseYogoDiscountNumbers } from "@/lib/yogo-product-utils";

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
  paymentTermText: string;
  generatedAtText: string;
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

export function buildBillingPdfFileName(data: Pick<BillingExportData, "orderNo" | "companyName">) {
  const companyName = String(data.companyName || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const safeCompanyName = companyName || "NoCompany";
  return `${data.orderNo}_${safeCompanyName}_INVOICE`;
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

function formatPaymentTerm(value: string) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.endsWith("天") ? text : `${text}天`;
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
    "C:\\Windows\\Fonts\\msyh.ttf",
    "C:\\Windows\\Fonts\\simhei.ttf",
    path.join(process.cwd(), "public", "fonts", "NotoSansSC-Regular.ttf"),
    path.join(process.cwd(), "public", "fonts", "NotoSansCJKsc-Regular.otf"),
  ];

  for (const fontPath of fontCandidates) {
    try {
      return {
        bytes: await fs.readFile(fontPath),
        isOtf: fontPath.toLowerCase().endsWith(".otf"),
        path: fontPath,
      };
    } catch {
      // try next candidate
    }
  }

  return null;
}

async function loadPdfBoldFontBytes() {
  const fontCandidates = [
    "C:\\Windows\\Fonts\\msyhbd.ttf",
    "C:\\Windows\\Fonts\\simhei.ttf",
    path.join(process.cwd(), "public", "fonts", "NotoSansSC-Bold.ttf"),
    path.join(process.cwd(), "public", "fonts", "NotoSansCJKsc-Bold.otf"),
  ];

  for (const fontPath of fontCandidates) {
    try {
      return {
        bytes: await fs.readFile(fontPath),
        isOtf: fontPath.toLowerCase().endsWith(".otf"),
        path: fontPath,
      };
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

async function loadBillingVipSvg() {
  const filePath = path.join(process.cwd(), "public", "icons", "vip.svg");
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function parseSvgHexColor(value: string | undefined) {
  if (!value) return [0.08, 0.09, 0.1] as const;
  const hex = value.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return [0.08, 0.09, 0.1] as const;
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  return [r, g, b] as const;
}

function parseVipSvgAsset(svgText: string | null) {
  if (!svgText) return null;
  const matches = Array.from(svgText.matchAll(/<path\b([^>]*)>/g));
  const filled = matches
    .map((match) => {
      const attrs = match[1] || "";
      const dMatch = attrs.match(/\bd="([^"]+)"/);
      const fillMatch = attrs.match(/\bfill="([^"]+)"/);
      return {
        d: dMatch?.[1] || "",
        fill: fillMatch?.[1],
      };
    })
    .find((item) => item.d && item.fill && item.fill.toLowerCase() !== "none");

  if (!filled) return null;

  return {
    path: filled.d,
    color: parseSvgHexColor(filled.fill),
  };
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
  const normalized = safePdfText(text || "", unicodeSafe).replace(/\r\n/g, "\n").trim();
  if (!normalized) return ["-"];

  const lines: string[] = [];
  for (const paragraph of normalized.split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }

    let current = "";
    for (const char of paragraph) {
      const next = current + char;
      if (font.widthOfTextAtSize(next, fontSize) <= maxWidth || current.length === 0) {
        current = next;
        continue;
      }
      lines.push(current);
      current = char;
    }

    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : ["-"];
}

export async function getBillingExportData(params: {
  orderNo: string;
  tenantId: string;
  companyId: string;
}) {
  const { orderNo, tenantId, companyId } = params;

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
  if (!orderRow) return null;

  const parsedRemark = parseBillingRemark(orderRow.order_remark);
  if (!parsedRemark.meta.generatedAt) {
    throw new Error("请先生成账单后再导出");
  }
  const vipDiscountEnabled = parseBillingBooleanFlag(parsedRemark.meta.generatedVipEnabled);

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

  const yogoDiscountRows =
    skuList.length > 0
      ? await prisma.yogoProductSource.findMany({
          where: {
            tenant_id: tenantId,
            company_id: companyId,
            product_code: { in: skuList },
          },
          select: {
            product_code: true,
            category_name: true,
            source_discount: true,
            updated_at: true,
          },
          orderBy: [{ updated_at: "desc" }],
        })
      : [];

  const yogoDiscountMap = new Map<
    string,
    {
      normalDiscount: number | null;
      vipDiscount: number | null;
    }
  >();
  for (const row of yogoDiscountRows) {
    const key = String(row.product_code || "").trim();
    if (!key || yogoDiscountMap.has(key)) continue;
    const discount = parseYogoDiscountNumbers(row.category_name, row.source_discount);
    yogoDiscountMap.set(key, {
      normalDiscount: discount.normal,
      vipDiscount: discount.vip,
    });
  }

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
      // Billing export unit price must always come from the completed receipt's supplier price.
      // `sell_price` in receipt import/export is the 验货单“供应价”, not a product catalog selling price.
      const supplierUnitPrice = toNumber(item.sell_price) || 0;
      const catalogDiscount = productDiscountMap.get(sku);
      const yogoDiscount = yogoDiscountMap.get(sku);
      const normalDiscountRaw =
        catalogDiscount?.normalDiscount ??
        yogoDiscount?.normalDiscount ??
        (item.normal_discount === null ? null : Number(item.normal_discount));
      const vipDiscountRaw =
        catalogDiscount?.vipDiscount ??
        yogoDiscount?.vipDiscount ??
        (item.vip_discount === null ? null : Number(item.vip_discount));
      const normalDiscount = toDiscountFactor(normalDiscountRaw);
      const vipDiscount = toDiscountFactor(vipDiscountRaw);
      const lineTotal = computeLineTotal(
        qty,
        supplierUnitPrice,
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
          unitPrice: supplierUnitPrice,
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

  const exportDate = formatDateOnly(new Date());

  return {
    orderNo,
    companyName: orderRow.customer_name || orderRow.company_name || "-",
    contactName: orderRow.contact_name || orderRow.customer_name || orderRow.company_name || "-",
    contactPhone: orderRow.contact_phone || "-",
    addressText: orderRow.address_text || "",
    remarkText: orderRow.order_remark || "",
    storeLabelText: normalizeStoreLabelInput(orderRow.store_label || ""),
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
      orderRow.contact_name ||
      orderRow.customer_name ||
      orderRow.company_name ||
      "",
    recipientPhoneText: parsedRemark.meta.recipientPhone || orderRow.contact_phone || "",
    carrierCompanyText: parsedRemark.meta.carrierCompany,
    paymentTermText: parsedRemark.meta.paymentTerm,
    generatedAtText: parsedRemark.meta.generatedAt,
  } satisfies BillingExportData;
}

export async function buildBillingXlsx(data: BillingExportData) {
  const workbook = new ExcelJS.Workbook();
  const logoBuffer = await loadBillingLogoBuffer();
  const worksheet = workbook.addWorksheet("Billing Detail", {
    views: [{ showGridLines: false }],
  });

  worksheet.properties.defaultRowHeight = 22;
  worksheet.columns = [
    { key: "image", width: 13 },
    { key: "sku", width: 17 },
    { key: "barcode", width: 21 },
    { key: "nameZh", width: 23 },
    { key: "nameEs", width: 30 },
    { key: "qty", width: 9 },
    { key: "unitPrice", width: 10 },
    { key: "normalDiscount", width: 12 },
    ...(data.vipDiscountEnabled ? [{ key: "vipDiscount", width: 12 }] : []),
    { key: "lineTotal", width: 12 },
  ];

  const brandColor = "FF2F3C7E";
  const labelColor = "FF94A3B8";
  const valueColor = "FF0F172A";
  const borderColor = "FFE2E8F0";
  const tableHeaderFill = "FFF1F5F9";

  const applyCellStyle = (
    cellRef: string,
    options?: {
      value?: string | number;
      fontSize?: number;
      bold?: boolean;
      color?: string;
      horizontal?: ExcelJS.Alignment["horizontal"];
      vertical?: ExcelJS.Alignment["vertical"];
      wrapText?: boolean;
      fill?: string;
      border?: boolean | { top?: boolean; left?: boolean; bottom?: boolean; right?: boolean };
      indent?: number;
      italic?: boolean;
    },
  ) => {
    const cell = worksheet.getCell(cellRef);
    if (options && "value" in options) cell.value = options.value ?? "";
    cell.font = {
      name: getDocumentFontName(String(options?.value || ""), { chineseBold: options?.bold }),
      size: options?.fontSize ?? 10,
      bold: options?.bold ?? false,
      italic: options?.italic ?? false,
      color: { argb: options?.color ?? valueColor },
    };
    cell.alignment = {
      vertical: options?.vertical ?? "middle",
      horizontal: options?.horizontal ?? "left",
      wrapText: options?.wrapText ?? false,
      indent: options?.indent,
    };
    if (options?.fill) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: options.fill },
      };
    }
    if (options?.border) {
      const borderConfig =
        typeof options.border === "boolean"
          ? { top: true, left: true, bottom: true, right: true }
          : options.border;
      cell.border = {
        top: borderConfig.top ? { style: "thin", color: { argb: borderColor } } : undefined,
        left: borderConfig.left ? { style: "thin", color: { argb: borderColor } } : undefined,
        bottom: borderConfig.bottom ? { style: "thin", color: { argb: borderColor } } : undefined,
        right: borderConfig.right ? { style: "thin", color: { argb: borderColor } } : undefined,
      };
    }
    return cell;
  };

  const setRowHeight = (rowNumber: number, height: number) => {
    worksheet.getRow(rowNumber).height = height;
  };

  const writeSectionTitle = (cellRef: string, value: string) => {
    applyCellStyle(cellRef, {
      value,
      fontSize: 11,
      bold: true,
      color: brandColor,
      horizontal: "left",
      vertical: "middle",
    });
  };

  const writeLabel = (cellRef: string, value: string) => {
    applyCellStyle(cellRef, {
      value,
      fontSize: 9,
      color: labelColor,
      horizontal: "left",
      vertical: "middle",
    });
  };

  const writeValue = (
    cellRef: string,
    value: string,
    options?: { emphasize?: boolean; wrapText?: boolean; rowHeight?: number; bold?: boolean },
  ) => {
    const rowNumber = Number(cellRef.match(/\d+$/)?.[0] || 0);
    if (options?.rowHeight) setRowHeight(rowNumber, options.rowHeight);
    applyCellStyle(cellRef, {
      value,
      fontSize: options?.emphasize ? 17 : 12,
      bold: options?.bold ?? true,
      color: valueColor,
      horizontal: "left",
      vertical: "middle",
      wrapText: options?.wrapText ?? false,
    });
  };

  const writeSummary = (
    labelCell: string,
    valueCell: string,
    label: string,
    value: string,
    options?: { emphasize?: boolean },
  ) => {
    writeLabel(labelCell, label);
    writeValue(valueCell, value, { emphasize: options?.emphasize, bold: true });
  };

  worksheet.getRow(1).height = 26;
  worksheet.getRow(2).height = 38;
  worksheet.getRow(3).height = 22;
  worksheet.getRow(4).height = 10;
  worksheet.getRow(5).height = 10;

  if (logoBuffer) {
    const imageId = workbook.addImage({
      base64: "data:image/png;base64," + logoBuffer.toString("base64"),
      extension: "png",
    });
    worksheet.addImage(imageId, {
      tl: { col: 0.12, row: 0.08 },
      ext: { width: 24, height: 24 },
      editAs: "oneCell",
    });
  }

  applyCellStyle("B1", {
    value: "\u767e\u76db\u4f9b\u5e94\u94fe",
    fontSize: 12,
    bold: true,
    color: brandColor,
    horizontal: "left",
    vertical: "middle",
  });
  writeSummary("G1", "I1", "\u8ba2\u5355\u53f7 / No. Ped.", data.orderNo || "-");

  applyCellStyle("A2", {
    value: "INVOICE",
    fontSize: 28,
    bold: true,
    color: valueColor,
    horizontal: "left",
    vertical: "middle",
  });
  writeSummary("G2", "I2", "\u51fa\u8d26\u65e5\u671f / F. Fact.", data.issueDateText || "-");

  applyCellStyle("A3", {
    value: "M\u00c1S QUE PRODUCTOS, ENTREGAMOS SOLUCIONES",
    fontSize: 9,
    color: "FF64748B",
    horizontal: "left",
    vertical: "middle",
  });
  writeSummary("G3", "I3", "\u5408\u8ba1\u91d1\u989d / Mto. Total", "$" + toMoney(data.totalAmount), {
    emphasize: true,
  });

  const leftLabelCol = "A";
  const leftValueCol = "A";
  const middleLabelCol = "D";
  const middleValueCol = "D";
  const rightLabelCol = "G";
  const rightValueCol = "G";

  const sectionTopRow = 6;
  const sectionFields = {
    left: [
      { label: "\u5ba2\u6237\u4fe1\u606f / CLIENTE", type: "title" as const },
      { label: "\u5ba2\u6237\u540d\u79f0 / Nom. Clte.", value: data.companyName || "-", wrapText: false },
      { label: "\u6536\u8d27\u4eba / Dest.", value: data.recipientNameText || data.contactName || "-", wrapText: false },
      { label: "\u7535\u8bdd / Tel. Dest.", value: data.recipientPhoneText || data.contactPhone || "-", wrapText: false },
      { label: "\u9001\u8d27\u5730\u5740 / Dir. Ent.", value: data.addressText || "-", wrapText: true, rowHeight: 48 },
    ],
    middle: [
      { label: "\u8d26\u5355\u4fe1\u606f / FACT.", type: "title" as const },
      { label: "\u53d1\u8d27\u65e5\u671f / F. Env.", value: data.shipDateText || "-", wrapText: false },
      { label: "\u95e8\u5e97\u6807\u8bb0 / Etiq. Tda.", value: formatStoreLabelDisplay(data.storeLabelText) || "-", wrapText: false },
      { label: "\u8d26\u671f", value: getPaymentTermDisplayLines(data.paymentTermText).join(" ") || "-", wrapText: false },
      ...(data.vipDiscountEnabled ? [{ label: "VIP\u5ba2\u6237", value: "VIP\u5ba2\u6237", wrapText: false }] : []),
    ],
    right: [
      { label: "\u7269\u6d41\u4fe1\u606f / ENV\u00cdO", type: "title" as const },
      { label: "\u53d1\u8d27\u4ed3 / Dep. Env.", value: data.warehouseText || "-", wrapText: false },
      { label: "\u53d1\u8d27\u65b9\u5f0f / Met. Env.", value: data.shippingMethodText || "-", wrapText: false },
      { label: "\u6258\u8fd0\u516c\u53f8 / Emp. Transp.", value: data.carrierCompanyText || "-", wrapText: false },
      { label: "\u88c5\u7bb1\u4ef6\u6570 / Cant. Cajas", value: data.boxCountText || "-", wrapText: false },
      { label: "\u5546\u54c1\u603b\u6570\u91cf / Tot. Prod.", value: String(data.totalQty || 0), wrapText: false },
    ],
  };

  const renderSectionColumn = (
    startRow: number,
    labelColumn: string,
    valueColumn: string,
    entries: Array<
      | { label: string; type: "title" }
      | { label: string; value: string; wrapText?: boolean; rowHeight?: number }
    >,
  ) => {
    let row = startRow;
    for (const entry of entries) {
      if ("type" in entry && entry.type === "title") {
        setRowHeight(row, 24);
        writeSectionTitle(labelColumn + row, entry.label);
        row += 1;
        continue;
      }
      const fieldEntry = entry as { label: string; value: string; wrapText?: boolean; rowHeight?: number };
      setRowHeight(row, 18);
      writeLabel(labelColumn + row, fieldEntry.label);
      row += 1;
      setRowHeight(row, fieldEntry.rowHeight ?? (fieldEntry.wrapText ? 48 : 26));
      writeValue(valueColumn + row, fieldEntry.value, {
        wrapText: fieldEntry.wrapText,
        rowHeight: fieldEntry.rowHeight ?? (fieldEntry.wrapText ? 48 : 26),
      });
      row += 2;
    }
    return row;
  };

  const leftEndRow = renderSectionColumn(sectionTopRow, leftLabelCol, leftValueCol, sectionFields.left);
  const middleEndRow = renderSectionColumn(sectionTopRow, middleLabelCol, middleValueCol, sectionFields.middle);
  const rightEndRow = renderSectionColumn(sectionTopRow, rightLabelCol, rightValueCol, sectionFields.right);
  const headerRowNumber = Math.max(leftEndRow, middleEndRow, rightEndRow) + 1;

  const headerValues = [
    "\u56fe\u7247",
    "\u7f16\u53f7",
    "\u6761\u5f62\u7801",
    "\u4e2d\u6587\u540d",
    "\u897f\u6587\u540d",
    "\u6570\u91cf",
    "\u5355\u4ef7",
    "\u666e\u901a\u6298\u6263",
    ...(data.vipDiscountEnabled ? ["VIP\u6298\u6263"] : []),
    "\u91d1\u989d",
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
      fgColor: { argb: tableHeaderFill },
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
        base64: "data:image/" + image.extension + ";base64," + image.buffer.toString("base64"),
        extension: image.extension,
      });
      worksheet.addImage(imageId, "A" + rowNumber + ":A" + rowNumber);
    } else {
      row.getCell(1).value = "-";
    }
  }

  return workbook.xlsx.writeBuffer();
}

export async function buildBillingPdf(data: BillingExportData) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const zhFontSource = await loadPdfFontBytes();
  const zhBoldFontSource = await loadPdfBoldFontBytes();
  const logoBuffer = await loadBillingLogoBuffer();
  const vipSvgText = await loadBillingVipSvg();
  const vipSvgAsset = parseVipSvgAsset(vipSvgText);
  const unicodeSafe = Boolean(zhFontSource?.bytes);

  const zhFont = zhFontSource?.bytes
    ? await pdfDoc.embedFont(zhFontSource.bytes, { subset: !zhFontSource.isOtf })
    : await pdfDoc.embedFont(StandardFonts.Helvetica);
  const zhBoldFont = zhBoldFontSource?.bytes
    ? await pdfDoc.embedFont(zhBoldFontSource.bytes, { subset: !zhBoldFontSource.isOtf })
    : zhFont;
  const latinFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const latinBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 612;
  const pageHeight = 792;
  const marginX = 54;
  const topMargin = 50;
  const bottomMargin = 48;
  const columns = [
    { key: "item", labelZh: "\u4ea7\u54c1", labelEs: "Prod.", width: 308 },
    { key: "qty", labelZh: "\u6570\u91cf", labelEs: "Cant.", width: 38 },
    { key: "price", labelZh: "\u5355\u4ef7", labelEs: "P. Unit.", width: 64 },
    { key: "discount", labelZh: "\u6298\u6263", labelEs: "Desc.", width: 50 },
    { key: "amount", labelZh: "\u91d1\u989d", labelEs: "Importe", width: 44 },
  ] as const;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - topMargin;

  const fontForText = (text: string, bold = false) => {
    if (hasChineseGlyph(text)) return bold ? zhBoldFont : zhFont;
    return bold ? latinBoldFont : latinFont;
  };

  const textWidth = (text: string, size: number, bold = false) =>
    fontForText(text, bold).widthOfTextAtSize(safePdfText(text, unicodeSafe), size);

  const drawText = (
    text: string,
    x: number,
    y: number,
    options?: { size?: number; color?: [number, number, number]; bold?: boolean },
  ) => {
    page.drawText(safePdfText(text, unicodeSafe), {
      x,
      y,
      size: options?.size ?? 10,
      font: fontForText(text, options?.bold),
      color: rgb(...(options?.color ?? [0.17, 0.18, 0.2])),
    });
  };

  const drawRightText = (
    text: string,
    rightX: number,
    y: number,
    options?: { size?: number; color?: [number, number, number]; bold?: boolean },
  ) => {
    drawText(text, rightX - textWidth(text, options?.size ?? 10, options?.bold), y, options);
  };

  const drawField = (
    label: string,
    value: string,
    x: number,
    y: number,
    width: number,
    options?: { emphasize?: boolean; compact?: boolean; strongLabel?: boolean },
  ) => {
    const emphasize = Boolean(options?.emphasize);
    const compact = Boolean(options?.compact);
    const strongLabel = Boolean(options?.strongLabel);
    const labelSize = compact ? 6.8 : 7.1;
    const valueSize = emphasize ? 11.8 : compact ? 8.7 : 9.3;
    const lineStep = compact ? 10 : 11.5;
    drawText(label, x, y, {
      size: strongLabel ? (compact ? 8.7 : 9.4) : labelSize,
      bold: strongLabel,
      color: strongLabel ? [0.08, 0.09, 0.1] : [0.58, 0.6, 0.64],
    });
    const lines = wrapTextByWidth(value || "-", fontForText(value || "-", emphasize), valueSize, width, unicodeSafe);
    let lineY = y - 15;
    for (const line of lines) {
      drawText(line, x, lineY, {
        size: valueSize,
        bold: emphasize,
        color: emphasize ? [0.1, 0.11, 0.12] : [0.2, 0.21, 0.24],
      });
      lineY -= lineStep;
    }
    return Math.max(compact ? 26 : 30, lines.length * lineStep + 12);
  };

  const drawVipField = (text: string, x: number, y: number) => {
    const iconSize = 14;
    const textSize = 10;
    const textFont = fontForText(text, true);
    const textHeight = textFont.heightAtSize(textSize);
    const topPadding = 2;
    const iconLineHeight = 18;
    const gapY = 7;
    const textLineHeight = Math.max(14, textHeight + 2);
    const iconTopY = y - topPadding;
    const iconY = iconTopY - iconSize;
    const textTopY = iconTopY - iconLineHeight - gapY;
    const textY = textTopY - textHeight;
    const rowHeight = topPadding + iconLineHeight + gapY + textLineHeight;

    if (vipSvgAsset) {
      page.drawSvgPath(vipSvgAsset.path, {
        x,
        y: iconY,
        scale: iconSize / 24,
        color: rgb(...vipSvgAsset.color),
      });
    }
    page.drawText(safePdfText(text, unicodeSafe), {
      x,
      y: textY,
      size: textSize,
      font: textFont,
      color: rgb(0.08, 0.09, 0.1),
    });
    return rowHeight;
  };

  const drawSummaryCard = (x: number, y: number) => {
    const cardWidth = 182;
    const cardHeight = 118;
    page.drawRectangle({
      x,
      y: y - cardHeight,
      width: cardWidth,
      height: cardHeight,
      color: rgb(0.995, 0.995, 0.995),
      borderColor: rgb(0.9, 0.91, 0.93),
      borderWidth: 0.7,
    });
    let lineY = y - 18;
    drawText("\u8ba2\u5355\u53f7 / No. Ped.", x + 16, lineY, { size: 7.2, color: [0.58, 0.6, 0.64] });
    drawRightText(data.orderNo || "-", x + cardWidth - 16, lineY, { size: 10, bold: true, color: [0.18, 0.19, 0.22] });
    lineY -= 28;
    drawText("\u51fa\u8d26\u65e5\u671f / F. Fact.", x + 16, lineY, { size: 7.2, color: [0.58, 0.6, 0.64] });
    drawRightText(data.issueDateText || "-", x + cardWidth - 16, lineY, { size: 9.6, color: [0.2, 0.21, 0.24] });
    lineY -= 30;
    drawText("\u5408\u8ba1\u91d1\u989d / Mto. Total", x + 16, lineY, { size: 7.2, color: [0.58, 0.6, 0.64] });
    drawRightText(`$${toMoney(data.totalAmount)}`, x + cardWidth - 16, lineY - 2, { size: 16.5, bold: true, color: [0.08, 0.09, 0.1] });
    return cardHeight;
  };

  const drawHeader = async () => {
    const brandColor: [number, number, number] = [0.184, 0.235, 0.494];
    const brandTextSize = 11;
    const brandBottomY = cursorY - 1;
    const brandText = "百盛供应链";
    const brandTextFont = fontForText(brandText, true);
    const brandTextHeight = brandTextFont.heightAtSize(brandTextSize);
    const brandTextY = brandBottomY - brandTextHeight + 1.5;
    if (logoBuffer) {
      try {
        const logo = await pdfDoc.embedPng(logoBuffer);
        const scale = Math.min(22 / logo.width, 22 / logo.height);
        const logoWidth = logo.width * scale;
        const logoHeight = logo.height * scale;
        page.drawImage(logo, {
          x: marginX,
          y: brandBottomY - logoHeight,
          width: logoWidth,
          height: logoHeight,
        });
        drawText(brandText, marginX + logoWidth + 10, brandTextY, {
          size: brandTextSize,
          bold: true,
          color: brandColor,
        });
      } catch {
        drawText(brandText, marginX, brandTextY, {
          size: brandTextSize,
          bold: true,
          color: brandColor,
        });
      }
    } else {
      drawText(brandText, marginX, brandTextY, {
        size: brandTextSize,
        bold: true,
        color: brandColor,
      });
    }

    const summaryHeight = drawSummaryCard(pageWidth - marginX - 182, cursorY + 10);

    cursorY -= 58;
    drawText("INVOICE", marginX, cursorY, { size: 31, bold: true, color: [0.06, 0.07, 0.08] });
    drawText("M\u00c1S QUE PRODUCTOS, ENTREGAMOS SOLUCIONES", marginX, cursorY - 24, {
      size: 8,
      color: [0.5, 0.52, 0.56],
    });
    cursorY -= Math.max(52, summaryHeight - 48);

    const colGap = 18;
    const boxWidth = (pageWidth - marginX * 2 - colGap * 2) / 3;
    const sectionTop = cursorY;
    const billingFields = [
      { label: "\u53d1\u8d27\u65e5\u671f / F. Env.", value: data.shipDateText || "-", emphasize: false },
      { label: "\u95e8\u5e97\u6807\u8bb0 / Etiq. Tda.", value: formatStoreLabelDisplay(data.storeLabelText) || "-", emphasize: false },
      ...(getPaymentTermDisplayLines(data.paymentTermText).length > 0
        ? [{ label: "账期", value: getPaymentTermDisplayLines(data.paymentTermText).join("\n"), emphasize: false }]
        : []),
      ...(data.vipDiscountEnabled
        ? [{ label: "VIP客户", value: "VIP客户", emphasize: true, strongLabel: true, icon: "vip" as const }]
        : []),
    ];

    const boxes = [
      {
        title: "\u5ba2\u6237\u4fe1\u606f / CLIENTE",
        fields: [
          { label: "\u5ba2\u6237\u540d\u79f0 / Nom. Clte.", value: data.companyName || "-", emphasize: false },
          { label: "\u6536\u8d27\u4eba / Dest.", value: data.recipientNameText || data.contactName || "-", emphasize: false },
          { label: "\u7535\u8bdd / Tel. Dest.", value: data.recipientPhoneText || data.contactPhone || "-", emphasize: false },
          { label: "\u9001\u8d27\u5730\u5740 / Dir. Ent.", value: data.addressText || "-", emphasize: false },
        ],
      },
      {
        title: "\u8d26\u5355\u4fe1\u606f / FACT.",
        fields: billingFields,
      },
      {
        title: "\u7269\u6d41\u4fe1\u606f / ENV\u00cdO",
        fields: [
          { label: "\u53d1\u8d27\u4ed3 / Dep. Env.", value: data.warehouseText || "-", emphasize: false },
          { label: "\u53d1\u8d27\u65b9\u5f0f / Met. Env.", value: data.shippingMethodText || "-", emphasize: false },
          { label: "\u6258\u8fd0\u516c\u53f8 / Emp. Transp.", value: data.carrierCompanyText || "-", emphasize: false },
          { label: "\u88c5\u7bb1\u4ef6\u6570 / Cant. Cajas", value: data.boxCountText || "-", emphasize: false },
          { label: "\u5546\u54c1\u603b\u6570\u91cf / Tot. Prod.", value: String(data.totalQty || 0), emphasize: false },
        ],
      },
    ] as const;

    const sectionHeights = boxes.map((section, index) => {
      const boxX = marginX + index * (boxWidth + colGap);
      let boxY = sectionTop - 18;
      let usedHeight = 0;
      page.drawRectangle({
        x: boxX,
        y: sectionTop - 218,
        width: boxWidth,
        height: 218,
        color: rgb(0.998, 0.998, 0.998),
        borderColor: rgb(0.91, 0.92, 0.94),
        borderWidth: 0.6,
      });
      drawText(section.title, boxX + 18, boxY, { size: 8.2, bold: true, color: [0.48, 0.5, 0.54] });
      boxY -= 20;
      for (let fieldIndex = 0; fieldIndex < section.fields.length; fieldIndex += 1) {
        const field = section.fields[fieldIndex]!;
        const nextField = section.fields[fieldIndex + 1];
        const fieldHeight =
          "icon" in field && field.icon === "vip"
            ? drawVipField(field.label, boxX + 18, boxY)
            : drawField(field.label, field.value, boxX + 18, boxY, boxWidth - 36, {
                emphasize: field.emphasize,
                compact: true,
                strongLabel: "strongLabel" in field ? field.strongLabel : false,
              });
        const gapAfterField =
          nextField && "icon" in nextField && nextField.icon === "vip"
            ? 2
            : 6;
        boxY -= fieldHeight + gapAfterField;
        usedHeight += fieldHeight + gapAfterField;
      }
      return usedHeight + 26;
    });

    cursorY = sectionTop - Math.max(228, ...sectionHeights) - 24;

    drawText("\u5546\u54c1\u660e\u7ec6 / DETALLE", marginX, cursorY + 10, {
      size: 8.2,
      bold: true,
      color: [0.48, 0.5, 0.54],
    });

    page.drawLine({
      start: { x: marginX, y: cursorY },
      end: { x: pageWidth - marginX, y: cursorY },
      thickness: 0.7,
      color: rgb(0.9, 0.91, 0.93),
    });
    cursorY -= 20;
  };

  const drawItemsHeader = () => {
    let x = marginX;
    for (const col of columns) {
      if (col.key === "item") {
        drawText(col.labelZh, x, cursorY + 2, {
          size: 7.4,
          bold: true,
          color: [0.58, 0.6, 0.64],
        });
        drawText(col.labelEs, x, cursorY - 8, {
          size: 6.7,
          color: [0.62, 0.64, 0.68],
        });
      } else {
        drawRightText(col.labelZh, x + col.width - 4, cursorY + 2, {
          size: 7.4,
          bold: true,
          color: [0.58, 0.6, 0.64],
        });
        drawRightText(col.labelEs, x + col.width - 4, cursorY - 8, {
          size: 6.7,
          color: [0.62, 0.64, 0.68],
        });
      }
      x += col.width;
    }
    cursorY -= 18;
    page.drawLine({
      start: { x: marginX, y: cursorY },
      end: { x: pageWidth - marginX, y: cursorY },
      thickness: 0.7,
      color: rgb(0.9, 0.91, 0.93),
    });
    cursorY -= 10;
  };

  const newPage = async () => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    cursorY = pageHeight - topMargin;
    drawItemsHeader();
    isFirstRowOnPage = true;
  };

  await drawHeader();
  drawItemsHeader();
  let isFirstRowOnPage = true;

  for (let itemIndex = 0; itemIndex < data.items.length; itemIndex += 1) {
    const item = data.items[itemIndex];
    const primaryName = item.nameEs || item.nameZh || "-";
    const secondaryName = item.nameZh && item.nameEs ? item.nameZh : "";
    const nameLines = wrapTextByWidth(primaryName, fontForText(primaryName), 10.2, 210, unicodeSafe);
    const secondaryLines = secondaryName ? wrapTextByWidth(secondaryName, zhFont, 8.5, 210, unicodeSafe) : [];
    const metaLines = wrapTextByWidth(`SKU ${item.sku || "-"} / Barcode ${item.barcode || "-"}`, latinFont, 7.1, 210, unicodeSafe);
    const discountLines = [toPercentText(item.normalDiscount), ...(data.vipDiscountEnabled ? [`VIP ${toPercentText(item.vipDiscount)}`] : [])];
    const rowHeight = Math.max(54, nameLines.length * 12 + secondaryLines.length * 10 + metaLines.length * 9 + 16);

    if (cursorY - rowHeight < bottomMargin + 100) {
      await newPage();
    }

    const rowTop = cursorY;
    const rowBottom = cursorY - rowHeight;
    if (!isFirstRowOnPage) {
      page.drawLine({
        start: { x: marginX, y: rowTop + 2 },
        end: { x: pageWidth - marginX, y: rowTop + 2 },
        thickness: 0.5,
        color: rgb(0.93, 0.94, 0.95),
      });
    }

    let x = marginX;
    const image = await loadProductImageBuffer(item.sku, item.barcode);
    const imageSize = 36;
    const imageTopY = rowTop - 6;
    if (image) {
      try {
        const embedded = image.extension === "png" ? await pdfDoc.embedPng(image.buffer) : await pdfDoc.embedJpg(image.buffer);
        page.drawImage(embedded, {
          x: x + 6,
          y: imageTopY - imageSize,
          width: imageSize,
          height: imageSize,
        });
      } catch {
        drawText("-", x + 18, imageTopY - 18, { size: 9, color: [0.65, 0.67, 0.7] });
      }
    } else {
      drawText("-", x + 18, imageTopY - 18, { size: 9, color: [0.65, 0.67, 0.7] });
    }
    x += 50;

    let textY = rowTop - 14;
    for (const line of nameLines) {
      drawText(line, x, textY, { size: 10.2, color: [0.12, 0.13, 0.15] });
      textY -= 12;
    }
    for (const line of secondaryLines) {
      drawText(line, x, textY, { size: 8.5, color: [0.48, 0.5, 0.54] });
      textY -= 10;
    }
    for (const line of metaLines) {
      drawText(line, x, textY, { size: 7.1, color: [0.64, 0.66, 0.69] });
      textY -= 9;
    }
    x = marginX + columns[0].width;

    drawRightText(String(item.qty), x + columns[1].width - 4, rowTop - 14, { size: 9.2 });
    x += columns[1].width;
    drawRightText(`$${toMoney(item.unitPrice)}`, x + columns[2].width - 4, rowTop - 14, { size: 9.2 });
    x += columns[2].width;
    let discountY = rowTop - 14;
    for (const line of discountLines) {
      drawRightText(line, x + columns[3].width - 4, discountY, { size: line.startsWith("VIP") ? 7.5 : 9.2, color: line.startsWith("VIP") ? [0.55, 0.57, 0.61] : [0.17, 0.18, 0.2] });
      discountY -= 10;
    }
    x += columns[3].width;
    drawRightText(`$${toMoney(item.lineTotal)}`, x + columns[4].width - 4, rowTop - 14, { size: 9.6, bold: true });

    cursorY -= rowHeight;
    isFirstRowOnPage = false;
  }

  const summarySubtotal = data.items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  const summaryDiscount = Math.max(summarySubtotal - data.totalAmount, 0);

  if (cursorY < bottomMargin + 120) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    cursorY = pageHeight - topMargin - 20;
  }

  page.drawLine({
    start: { x: marginX, y: cursorY },
    end: { x: pageWidth - marginX, y: cursorY },
    thickness: 0.7,
    color: rgb(0.9, 0.91, 0.93),
  });
  cursorY -= 26;

  const summaryX = pageWidth - marginX - 220;
  drawText("\u5c0f\u8ba1 / Subtot.", summaryX, cursorY, { size: 8, color: [0.58, 0.6, 0.64] });
  drawRightText(`$${toMoney(summarySubtotal)}`, pageWidth - marginX, cursorY, { size: 10 });
  cursorY -= 20;
  drawText("\u6298\u6263\u540e / Desc.", summaryX, cursorY, { size: 8, color: [0.58, 0.6, 0.64] });
  drawRightText(`$${toMoney(summaryDiscount)}`, pageWidth - marginX, cursorY, { size: 10 });
  cursorY -= 30;
  drawText("\u5e94\u4ed8\u603b\u989d / Mto. Total", summaryX, cursorY, { size: 8, bold: true, color: [0.4, 0.42, 0.46] });
  drawRightText(`$${toMoney(data.totalAmount)}`, pageWidth - marginX, cursorY - 8, { size: 24, bold: true, color: [0.08, 0.09, 0.1] });

  return pdfDoc.save({ useObjectStreams: true });
}
