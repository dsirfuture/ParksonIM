import { NextResponse } from "next/server";
import { getStockTagExportRows } from "@/lib/dropshipping";
import {
  buildDropshippingStockTagPdf,
  buildDropshippingStockTagPdfName,
  type InventoryExportFilters,
} from "@/lib/dropshipping-inventory-export";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";

export const runtime = "nodejs";

function getFilters(searchParams: URLSearchParams): InventoryExportFilters {
  return {
    stocked: "stocked",
    status: "all",
    skuKeyword: searchParams.get("sku")?.trim() || "",
    includeAllShipped: true,
    customerName: searchParams.get("customer")?.trim() || "",
  };
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    if (!(await hasPermission(session, "viewReports"))) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const filters = getFilters(new URL(request.url).searchParams);
    const rows = await getStockTagExportRows(session, {
      customerName: filters.customerName,
      skuKeyword: filters.skuKeyword,
      status: filters.status,
    });
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "当前没有可导出的备标签数据" }, { status: 400 });
    }
    const buffer = await buildDropshippingStockTagPdf(rows, filters.customerName || null);
    const fileName = `${buildDropshippingStockTagPdfName(filters.customerName)}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "导出备标签 PDF 失败" },
      { status: 500 },
    );
  }
}
