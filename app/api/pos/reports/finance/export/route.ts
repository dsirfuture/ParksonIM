import { NextResponse } from "next/server";
import { type Lang } from "@/lib/i18n";
import { tryRecordPosAuditLog } from "@/lib/pos/server/pos-audit.server";
import { buildPosExportFileName, buildPosFinanceExportXlsx } from "@/lib/pos/server/pos-export.server";
import { getPosDashboardSummary, getPosPaymentsSummary, getPosSalesTrend } from "@/lib/pos/server/pos-reports.server";
import { requirePosSession, resolvePosStoreFromRequest } from "@/lib/pos/server/pos-route";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requirePosSession("pos.report.export", {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(request.url);
    const storeScope = resolvePosStoreFromRequest(auth.pos, request.url, { requireStore: false });
    if (!storeScope.ok) return storeScope.response;
    const lang = (url.searchParams.get("lang") === "es" ? "es" : "zh") as Lang;
    const query = {
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      storeId: storeScope.storeId,
      dateFrom: url.searchParams.get("dateFrom") || undefined,
      dateTo: url.searchParams.get("dateTo") || undefined,
    };
    const [summary, payments, trend] = await Promise.all([
      getPosDashboardSummary(query),
      getPosPaymentsSummary(query),
      getPosSalesTrend(query),
    ]);
    await tryRecordPosAuditLog({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      input: {
        actionType: "export_triggered",
        module: "finance_stats",
        actorUserId: auth.session.userId,
        actorName: auth.session.name || auth.session.userId,
        actorRole: auth.pos.role,
        storeId: storeScope.storeId || null,
        summary: "导出财务统计",
        detailsJson: {
          exportType: "finance_report",
          filters: {
            storeId: storeScope.storeId || "",
            dateFrom: url.searchParams.get("dateFrom") || "",
            dateTo: url.searchParams.get("dateTo") || "",
          },
        },
        resultStatus: "success",
      },
    });
    const buffer = await buildPosFinanceExportXlsx(lang, { summary, payments, trend });
    const fileName = buildPosExportFileName(lang === "zh" ? "财务统计" : "pos-finance");
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
        module: "finance_stats",
        actorUserId: auth.session.userId,
        actorName: auth.session.name || auth.session.userId,
        actorRole: auth.pos.role,
        storeId: auth.pos.defaultStoreId || null,
        summary: "导出财务统计失败",
        detailsJson: { exportType: "finance_report", error: error instanceof Error ? error.message : "POS_EXPORT_FAILED" },
        resultStatus: "failed",
      },
    });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "POS_EXPORT_FAILED" }, { status: 500 });
  }
}
