import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { errorResponse } from "@/lib/errors";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, context: any) {
  const id = context?.params?.id as string | undefined;
  if (!id) return errorResponse("VALIDATION_FAILED", "Missing receipt id", 400);

  const session = await getSession();
  if (!session) return errorResponse("FORBIDDEN", "Auth required", 403);

  // ✅ tenant/company isolation (very important for SaaS)
  const receipt = await prisma.receipt.findFirst({
    where: {
      id,
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    include: { items: true },
  });

  if (!receipt) return errorResponse("NOT_FOUND", "Receipt not found", 404);

  const data = receipt.items.map((item) => {
    const inspected = (item.good_qty ?? 0) + (item.damaged_qty ?? 0);
    const diff = (item.expected_qty ?? 0) - inspected;

    return {
      SKU: item.sku,
      条码: item.barcode ?? "",
      中文名: item.name_zh ?? "",
      西文名: item.name_es ?? "",
      预期数量: item.expected_qty ?? 0,
      良品数量: item.good_qty ?? 0,
      不良数量: item.damaged_qty ?? 0,
      差异: diff,
      单价: item.sell_price != null ? item.sell_price.toString() : "",
      折扣: item.discount != null ? item.discount.toString() : "",
      总计: item.line_total != null ? item.line_total.toString() : "",
      状态: item.status,
      意外: item.unexpected ? "是" : "否",
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Items");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  // safe filename
  const safeNo = String(receipt.receipt_no || id).replace(/[^\w.\-()]/g, "_");
  const fileName = `receipt_${encodeURIComponent(safeNo)}.xlsx`;

  return new NextResponse(buffer as any, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
