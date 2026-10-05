import { NextResponse } from "next/server";
import { type Lang } from "@/lib/i18n";
import { tryRecordPosAuditLog } from "@/lib/pos/server/pos-audit.server";
import { buildPosExportFileName, buildPosSalesExportXlsx } from "@/lib/pos/server/pos-export.server";
import { listPosSales } from "@/lib/pos/server/pos-sales.server";
import { requirePosSession, resolvePosStoreFromRequest } from "@/lib/pos/server/pos-route";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requirePosSession("pos.sale.export", {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const storeScope = resolvePosStoreFromRequest(auth.pos, request.url, { requireStore: false });
    if (!storeScope.ok) return storeScope.response;
    const lang = (url.searchParams.get("lang") === "es" ? "es" : "zh") as Lang;
    const items = await listPosSales({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      storeId: storeScope.storeId,
      query: {
        folio: url.searchParams.get("folio") || "",
        customer: url.searchParams.get("customer") || "",
        paymentMethod: url.searchParams.get("paymentMethod") || "",
        status: url.searchParams.get("status") || "",
        dateFrom: url.searchParams.get("dateFrom") || "",
        dateTo: url.searchParams.get("dateTo") || "",
      },
    });
    await tryRecordPosAuditLog({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      input: {
        actionType: "export_triggered",
        module: "sales_docs",
        actorUserId: auth.session.userId,
        actorName: auth.session.name || auth.session.userId,
        actorRole: auth.pos.role,
        storeId: storeScope.storeId || null,
        summary: `导出销售单据 ${items.length} 条`,
        detailsJson: {
          exportType: "sales",
          filters: {
            storeId: storeScope.storeId || "",
            folio: url.searchParams.get("folio") || "",
            customer: url.searchParams.get("customer") || "",
            paymentMethod: url.searchParams.get("paymentMethod") || "",
            status: url.searchParams.get("status") || "",
            dateFrom: url.searchParams.get("dateFrom") || "",
            dateTo: url.searchParams.get("dateTo") || "",
          },
        },
        resultStatus: "success",
      },
    });
    const buffer = await buildPosSalesExportXlsx(lang, items);
    const fileName = buildPosExportFileName(lang === "zh" ? "销售单据" : "pos-sales");
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
        module: "sales_docs",
        actorUserId: auth.session.userId,
        actorName: auth.session.name || auth.session.userId,
        actorRole: auth.pos.role,
        storeId: auth.pos.defaultStoreId || null,
        summary: "导出销售单据失败",
        detailsJson: { exportType: "sales", error: error instanceof Error ? error.message : "POS_EXPORT_FAILED" },
        resultStatus: "failed",
      },
    });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "POS_EXPORT_FAILED" }, { status: 500 });
  }
}
