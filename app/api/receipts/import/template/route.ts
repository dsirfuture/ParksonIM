import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("template");

  const headers = [
    "receipt_no",
    "supplier_name",
    "sku",
    "barcode",
    "name_zh",
    "name_es",
    "case_pack",
    "expected_qty",
    "sell_price",
    "normal_discount",
    "vip_discount",
    "line_total",
  ];

  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = headers.map((header) => ({
    key: header,
    width: header.length < 12 ? 14 : 20,
  }));

  const bytes = await workbook.xlsx.writeBuffer();
  const fileName = "receipt-import-template.xlsx";

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

