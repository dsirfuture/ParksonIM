import { NextResponse } from "next/server";
import { getInventoryRows } from "@/lib/dropshipping";
import {
  buildDropshippingInventoryExportBaseName,
  buildDropshippingInventoryXlsx,
  filterInventoryExportRows,
  type InventoryExportFilters,
} from "@/lib/dropshipping-inventory-export";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";

export const runtime = "nodejs";

function getFilters(searchParams: URLSearchParams): InventoryExportFilters {
  const stocked = searchParams.get("stocked");
  const status = searchParams.get("status");
  return {
    stocked: stocked === "stocked" || stocked === "unstocked" ? stocked : "all",
    status: status === "healthy" || status === "low" || status === "empty" ? status : "all",
    skuKeyword: searchParams.get("sku")?.trim() || "",
    includeAllShipped: searchParams.get("allShipped") !== "0",
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
    const rows = filterInventoryExportRows(await getInventoryRows(session), filters);
    const buffer = await buildDropshippingInventoryXlsx(rows);
    const fileName = `${buildDropshippingInventoryExportBaseName()}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "导出 XLSX 失败" },
      { status: 500 },
    );
  }
}
