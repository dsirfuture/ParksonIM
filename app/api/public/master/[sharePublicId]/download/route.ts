import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/errors";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, context: any) {
  const sharePublicId = context?.params?.sharePublicId as string | undefined;

  if (!sharePublicId) {
    return errorResponse("VALIDATION_FAILED", "Missing sharePublicId", 400);
  }

  const share = await prisma.masterShareLink.findUnique({
    where: { share_public_id: sharePublicId },
    include: {
      master: {
        include: {
          sources: { include: { receipt: { include: { items: true } } } },
        },
      },
    },
  });

  if (!share || !share.active || (share.expires_at && new Date() > share.expires_at)) {
    return errorResponse("NOT_FOUND", "Link invalid or expired", 404);
  }

  const allItems: any[] = [];

  for (const source of share.master.sources) {
    for (const item of source.receipt.items) {
      allItems.push({
        "来源单号": source.receipt.receipt_no,
        "供应商": source.receipt.supplier_name || "",
        "SKU": item.sku,
        "条码": item.barcode || "",
        "中文名": item.name_zh || "",
        "西文名": item.name_es || "",
        "预期数量": item.expected_qty,
        "良品数量": item.good_qty,
        "不良数量": item.damaged_qty,
        "单价": item.sell_price != null ? item.sell_price.toString() : "",
        "折扣": item.discount != null ? item.discount.toString() : "",
        "总计": item.line_total != null ? item.line_total.toString() : "",
      });
    }
  }

  const worksheet = XLSX.utils.json_to_sheet(allItems);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "MasterData");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const fileName = `master_${encodeURIComponent(share.master.master_no)}.xlsx`;

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
