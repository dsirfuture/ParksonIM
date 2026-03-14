import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export const runtime = "nodejs";

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("模板");

  const columns = [
    { key: "receipt_no", label: "单号", required: true },
    { key: "supplier_name", label: "供应商", required: false },
    { key: "sku", label: "商品编码", required: true },
    { key: "barcode", label: "条码", required: false },
    { key: "name_zh", label: "中文名", required: false },
    { key: "name_es", label: "西文名", required: false },
    { key: "case_pack", label: "包装数", required: false },
    { key: "expected_qty", label: "应收数量", required: true },
    { key: "sell_price", label: "友购价", required: false },
    { key: "normal_discount", label: "普通折扣(%)", required: false },
    { key: "vip_discount", label: "VIP折扣(%)", required: false },
    { key: "line_total", label: "行金额", required: false },
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
