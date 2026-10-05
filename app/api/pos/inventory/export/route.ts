import { NextResponse } from "next/server";
import { type Lang } from "@/lib/i18n";
import { tryRecordPosAuditLog } from "@/lib/pos/server/pos-audit.server";
import { buildPosExportFileName, buildPosInventoryExportXlsx } from "@/lib/pos/server/pos-export.server";
import { listPosInventoryForExport } from "@/lib/pos/server/pos-inventory.server";
import { requirePosSession, resolvePosStoreFromRequest } from "@/lib/pos/server/pos-route";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requirePosSession("pos.inventory.export", {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const storeScope = resolvePosStoreFromRequest(auth.pos, request.url, { requireStore: false });
    if (!storeScope.ok) return storeScope.response;
    const lang = (url.searchParams.get("lang") === "es" ? "es" : "zh") as Lang;
    const items = await listPosInventoryForExport({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      query: {
        storeId: storeScope.storeId || "",
        keyword: url.searchParams.get("keyword") || "",
        clave: url.searchParams.get("clave") || "",
        barcode: url.searchParams.get("barcode") || "",
        status: url.searchParams.get("status") || "",
        lowStockOnly: url.searchParams.get("lowStockOnly") === "1",
      },
    });
    await tryRecordPosAuditLog({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      input: {
        actionType: "export_triggered",
        module: "store_inventory",
        actorUserId: auth.session.userId,
        actorName: auth.session.name || auth.session.userId,
        actorRole: auth.pos.role,
        storeId: storeScope.storeId || null,
        summary: `导出门店库存 ${items.length} 条`,
        detailsJson: {
          exportType: "inventory",
          filters: {
            storeId: storeScope.storeId || "",
            keyword: url.searchParams.get("keyword") || "",
            clave: url.searchParams.get("clave") || "",
            barcode: url.searchParams.get("barcode") || "",
            status: url.searchParams.get("status") || "",
            lowStockOnly: url.searchParams.get("lowStockOnly") === "1",
          },
        },
        resultStatus: "success",
      },
    });
    const buffer = await buildPosInventoryExportXlsx(lang, items);
    const fileName = buildPosExportFileName(lang === "zh" ? "门店库存" : "pos-inventory");
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    await tryRecordPosAuditLog({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      input: {
        actionType: "export_triggered",
        module: "store_inventory",
        actorUserId: auth.session.userId,
        actorName: auth.session.name || auth.session.userId,
        actorRole: auth.pos.role,
        storeId: auth.pos.defaultStoreId || null,
        summary: "导出门店库存失败",
        detailsJson: { exportType: "inventory", error: error instanceof Error ? error.message : "POS_EXPORT_FAILED" },
        resultStatus: "failed",
      },
    });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "POS_EXPORT_FAILED" }, { status: 500 });
  }
}
