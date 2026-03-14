import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";

function hasChineseGlyph(value: string) {
  return /[\u3400-\u9FFF\uF900-\uFAFF]/.test(String(value || ""));
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

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

function formatTime(value: Date | string | null | undefined) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, "0");
  const dd = `${date.getDate()}`.padStart(2, "0");
  const hh = `${date.getHours()}`.padStart(2, "0");
  const mi = `${date.getMinutes()}`.padStart(2, "0");

  return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function computeRow(item: {
  sku: string | null;
  barcode: string | null;
  name_zh: string | null;
  name_es: string | null;
  expected_qty: number | null;
  good_qty: number | null;
  damaged_qty: number | null;
  excess_qty: number | null;
  unexpected: boolean;
  sell_price: unknown;
}) {
  const expectedQty = toNumber(item.expected_qty) ?? 0;
  const goodQty = item.unexpected ? 0 : (item.good_qty ?? 0);
  const damagedQty = item.unexpected ? 0 : (item.damaged_qty ?? 0);
  const excessQty = item.unexpected ? 0 : (item.excess_qty ?? 0);
  const checkedQty = goodQty + damagedQty;
  const diffQty = item.unexpected
    ? 0
    : Math.max(expectedQty - Math.min(checkedQty, expectedQty), 0);

  return {
    sku: item.sku || "",
    barcode: item.barcode || "",
    nameZh: item.name_zh || "",
    nameEs: item.name_es || "",
    expectedQty,
    unitPrice: toNumber(item.sell_price),
    goodQty,
    diffQty,
    damagedQty,
    excessQty,
    remark: item.unexpected ? "鏂板" : "",
    unexpected: item.unexpected,
  };
}

async function loadFontBytes() {
  const fontCandidates = [
    path.join(process.cwd(), "public", "fonts", "NotoSansCJKsc-Regular.otf"),
    path.join(process.cwd(), "public", "fonts", "NotoSansSC-Regular.otf"),
    path.join(process.cwd(), "public", "fonts", "NotoSansSC-Regular.ttf"),
    "C:\\Windows\\Fonts\\msyh.ttf",
    "C:\\Windows\\Fonts\\simhei.ttf",
  ];

  for (const fontPath of fontCandidates) {
    try {
      return await fs.readFile(fontPath);
    } catch {
      continue;
    }
  }

  return null;
}

async function loadLatinFontBytes() {
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
      continue;
    }
  }

  return null;
}

async function loadProductImageBuffer(sku: string) {
  if (!sku) return null;

  const imagePath = path.join(
    process.cwd(),
    "public",
    "products",
    `${sku}.jpg`,
  );

  try {
    return await fs.readFile(imagePath);
  } catch {
    return null;
  }
}

function safePdfText(value: string, unicodeSafe: boolean) {
  if (unicodeSafe) return value || "";
  return (value || "").replace(/[^\x20-\x7E]/g, " ");
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
    if (char === "\n") {
      lines.push(current || "-");
      current = "";
      continue;
    }

    const next = current + char;
    const nextWidth = font.widthOfTextAtSize(next, fontSize);

    if (nextWidth <= maxWidth || current.length === 0) {
      current = next;
    } else {
      lines.push(current);
      current = char;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : ["-"];
}

function getTextBlockHeight(lineCount: number, lineHeight: number) {
  if (lineCount <= 0) return 0;
  return lineCount * lineHeight;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();

    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id } = await params;

    const receipt = await prisma.receipt.findFirst({
      where: {
        id,
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      include: {
        items: {
          select: {
            sku: true,
            barcode: true,
            name_zh: true,
            name_es: true,
            expected_qty: true,
            good_qty: true,
            damaged_qty: true,
            excess_qty: true,
            unexpected: true,
            sell_price: true,
            created_at: true,
          },
          orderBy: {
            created_at: "asc",
          },
        },
      },
    });

    if (!receipt) {
      return NextResponse.json({ error: "鏈壘鍒伴獙璐у崟" }, { status: 404 });
    }

    const receiptData = receipt;
    const rows = receiptData.items.map(computeRow);

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    const customFontBytes = await loadFontBytes();
    const latinFontBytes = await loadLatinFontBytes();
    const bodyFont = customFontBytes
      ? await pdfDoc.embedFont(customFontBytes, { subset: false })
      : await pdfDoc.embedFont(StandardFonts.Helvetica);
    const latinFont = latinFontBytes
      ? await pdfDoc.embedFont(latinFontBytes, { subset: false })
      : await pdfDoc.embedFont(StandardFonts.Helvetica);

    const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const unicodeSafe = Boolean(customFontBytes);
    const fontForText = (text: string, preferBold = false) => {
      if (hasChineseGlyph(text)) return bodyFont;
      if (preferBold) return titleFont;
      return latinFont;
    };

    const pageWidth = 842;
    const pageHeight = 595;
    const marginLeft = 28;
    const marginRight = 28;
    const topMargin = 40;
    const bottomMargin = 20;

    const titleSize = 16;
    const infoSize = 9;
    const tableFontSize = 8;
    const lineGap = 11;
    const cellPaddingX = 5;
    const cellPaddingY = 6;

    const columns = [
      { key: "image", label: "鍥剧墖", width: 44, align: "center" as const },
      { key: "sku", label: "SKU", width: 72, align: "center" as const },
      { key: "barcode", label: "鏉＄爜", width: 92, align: "center" as const },
      { key: "nameZh", label: "中文名", width: 128, align: "left" as const },
      { key: "nameEs", label: "西文名", width: 128, align: "left" as const },
      {
        key: "expectedQty",
        label: "搴旈獙",
        width: 42,
        align: "center" as const,
      },
      { key: "unitPrice", label: "鍗曚环", width: 52, align: "center" as const },
      { key: "goodQty", label: "鑹搧", width: 42, align: "center" as const },
      { key: "diffQty", label: "鐩稿樊", width: 42, align: "center" as const },
      { key: "damagedQty", label: "鐮存崯", width: 42, align: "center" as const },
      { key: "excessQty", label: "瓒呮敹", width: 42, align: "center" as const },
      { key: "remark", label: "澶囨敞", width: 50, align: "center" as const },
    ];

    const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let cursorY = pageHeight - topMargin;

    function drawText(
      text: string,
      x: number,
      y: number,
      options?: {
        size?: number;
        font?: PDFFont;
        color?: { r: number; g: number; b: number };
      },
    ) {
      page.drawText(safePdfText(text, unicodeSafe), {
        x,
        y,
        size: options?.size ?? tableFontSize,
        font: options?.font ?? fontForText(text),
        color: rgb(
          options?.color?.r ?? 0.15,
          options?.color?.g ?? 0.2,
          options?.color?.b ?? 0.3,
        ),
      });
    }

    function drawCenteredText(
      text: string,
      cellX: number,
      cellY: number,
      cellWidth: number,
      cellHeight: number,
      size = tableFontSize,
      font: PDFFont = bodyFont,
      color?: { r: number; g: number; b: number },
    ) {
      const safeText = safePdfText(text, unicodeSafe);
      const textWidth = font.widthOfTextAtSize(safeText, size);
      const x = cellX + Math.max((cellWidth - textWidth) / 2, 2);
      const y = cellY + (cellHeight - size) / 2 + 1;

      drawText(safeText, x, y, { size, font, color });
    }

    function drawLeftAlignedWrappedText(
      lines: string[],
      cellX: number,
      cellY: number,
      cellHeight: number,
    ) {
      const blockHeight = getTextBlockHeight(lines.length, lineGap);
      let lineY = cellY + (cellHeight + blockHeight) / 2 - tableFontSize;

      for (const line of lines) {
        drawText(line, cellX + cellPaddingX, lineY, { size: tableFontSize });
        lineY -= lineGap;
      }
    }

    function drawHeaderInfo() {
      drawText("ParksonMX", marginLeft + 6, cursorY, {
        size: titleSize,
        font: fontForText("ParksonMX", true),
        color: { r: 0.12, g: 0.22, b: 0.43 },
      });
      cursorY -= 32;

      drawText(
        `楠岃揣鍗曞彿:  ${receiptData.receipt_no || ""}`,
        marginLeft + 6,
        cursorY,
        {
          size: infoSize,
        },
      );
      cursorY -= 20;

      drawText(
        `渚涘簲鍟嗗悕绉?  ${receiptData.supplier_name || ""}`,
        marginLeft + 6,
        cursorY,
        {
          size: infoSize,
        },
      );
      cursorY -= 20;

      drawText(
        `楠岃揣鏃堕棿:  ${formatTime(receiptData.last_activity_at)}`,
        marginLeft + 6,
        cursorY,
        {
          size: infoSize,
        },
      );
      cursorY -= 26;
    }

    function drawTableHeader() {
      const headerHeight = 24;

      page.drawRectangle({
        x: marginLeft,
        y: cursorY - headerHeight + 4,
        width: tableWidth,
        height: headerHeight,
        color: rgb(0.95, 0.96, 0.98),
      });

      let x = marginLeft;
      for (const col of columns) {
        page.drawRectangle({
          x,
          y: cursorY - headerHeight + 4,
          width: col.width,
          height: headerHeight,
          borderColor: rgb(0.86, 0.89, 0.92),
          borderWidth: 0.6,
        });

        drawCenteredText(
          col.label,
          x,
          cursorY - headerHeight + 4,
          col.width,
          headerHeight,
          8,
          fontForText(col.label, true),
        );

        x += col.width;
      }

      cursorY -= headerHeight + 6;
    }

    function createNewPage() {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      cursorY = pageHeight - topMargin;
      drawHeaderInfo();
      drawTableHeader();
    }

    drawHeaderInfo();
    drawTableHeader();

    for (const row of rows) {
      const zhLines = wrapTextByWidth(
        row.nameZh || "-",
        bodyFont,
        tableFontSize,
        columns[3].width - cellPaddingX * 2,
        unicodeSafe,
      );

      const esLines = wrapTextByWidth(
        row.nameEs || "-",
        latinFont,
        tableFontSize,
        columns[4].width - cellPaddingX * 2,
        unicodeSafe,
      );

      const maxLineCount = Math.max(1, zhLines.length, esLines.length);
      const textBlockHeight = getTextBlockHeight(maxLineCount, lineGap);
      const rowHeight = Math.max(42, textBlockHeight + cellPaddingY * 2);

      if (cursorY - rowHeight < bottomMargin) {
        createNewPage();
      }

      const rowBottomY = cursorY - rowHeight + 2;

      let x = marginLeft;
      for (const col of columns) {
        page.drawRectangle({
          x,
          y: rowBottomY,
          width: col.width,
          height: rowHeight,
          borderColor: rgb(0.86, 0.89, 0.92),
          borderWidth: 0.6,
          color: rgb(1, 1, 1),
        });
        x += col.width;
      }

      const imageBuffer = await loadProductImageBuffer(row.sku);
      const imageCellX = marginLeft;
      const imageCellY = rowBottomY;
      const imageCellW = columns[0].width;
      const imageCellH = rowHeight;

      if (imageBuffer) {
        try {
          const image = await pdfDoc.embedJpg(imageBuffer);
          const imageSize = Math.min(28, imageCellW - 8, imageCellH - 8);

          page.drawImage(image, {
            x: imageCellX + (imageCellW - imageSize) / 2,
            y: imageCellY + (imageCellH - imageSize) / 2,
            width: imageSize,
            height: imageSize,
          });
        } catch {
          drawCenteredText("-", imageCellX, imageCellY, imageCellW, imageCellH);
        }
      } else {
        drawCenteredText("-", imageCellX, imageCellY, imageCellW, imageCellH);
      }

      let currentX = marginLeft + columns[0].width;

      drawCenteredText(
        row.sku || "-",
        currentX,
        rowBottomY,
        columns[1].width,
        rowHeight,
      );
      currentX += columns[1].width;

      drawCenteredText(
        row.barcode || "-",
        currentX,
        rowBottomY,
        columns[2].width,
        rowHeight,
      );
      currentX += columns[2].width;

      drawLeftAlignedWrappedText(zhLines, currentX, rowBottomY, rowHeight);
      currentX += columns[3].width;

      drawLeftAlignedWrappedText(esLines, currentX, rowBottomY, rowHeight);
      currentX += columns[4].width;

      drawCenteredText(
        String(row.expectedQty),
        currentX,
        rowBottomY,
        columns[5].width,
        rowHeight,
        tableFontSize,
        bodyFont,
        row.unexpected ? { r: 0.88, g: 0.12, b: 0.24 } : undefined,
      );
      currentX += columns[5].width;

      drawCenteredText(
        row.unitPrice === null ? "-" : `$${round2(row.unitPrice).toFixed(2)}`,
        currentX,
        rowBottomY,
        columns[6].width,
        rowHeight,
      );
      currentX += columns[6].width;

      drawCenteredText(
        String(row.goodQty),
        currentX,
        rowBottomY,
        columns[7].width,
        rowHeight,
      );
      currentX += columns[7].width;

      drawCenteredText(
        String(row.diffQty),
        currentX,
        rowBottomY,
        columns[8].width,
        rowHeight,
      );
      currentX += columns[8].width;

      drawCenteredText(
        String(row.damagedQty),
        currentX,
        rowBottomY,
        columns[9].width,
        rowHeight,
      );
      currentX += columns[9].width;

      drawCenteredText(
        String(row.excessQty),
        currentX,
        rowBottomY,
        columns[10].width,
        rowHeight,
      );
      currentX += columns[10].width;

      drawCenteredText(
        row.remark || "",
        currentX,
        rowBottomY,
        columns[11].width,
        rowHeight,
        tableFontSize,
        bodyFont,
        row.unexpected ? { r: 0.88, g: 0.12, b: 0.24 } : undefined,
      );

      cursorY -= rowHeight;
    }

    const pdfBytes = await pdfDoc.save();
    const fileName = `${receiptData.receipt_no || receiptData.id}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(
          fileName,
        )}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "瀵煎嚭 PDF 澶辫触";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


