import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("\u6a21\u677f");

  const columns = [
    { key: "receipt_no", label: "\u53cb\u8d2d\u8ba2\u5355\u53f7", required: true },
    { key: "supplier_name", label: "\u4f9b\u5e94\u5546", required: true },
    { key: "sku", label: "\u7f16\u7801", required: true },
    { key: "expected_qty", label: "\u6570\u91cf", required: true },
    { key: "sell_price", label: "\u4f9b\u5e94\u4ef7", required: true },
  ] as const;

  sheet.addRow(columns.map((c) => c.label));
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 24;
  sheet.columns = columns.map((col) => ({
    key: col.key,
    width: col.label.length < 8 ? 14 : 20,
  }));
  columns.forEach((col, index) => {
    if (!col.required) return;
    const cell = headerRow.getCell(index + 1);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFDE68A" },
    };
  });
  headerRow.commit();

  const bytes = await workbook.xlsx.writeBuffer();
  const fileName = "\u5bfc\u5165\u6587\u4ef6\u4e0b\u8f7d\u6a21\u677f.xlsx";
  const asciiFallback = "receipt-import-template.xlsx";

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}
