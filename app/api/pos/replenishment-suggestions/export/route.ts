import { NextResponse } from "next/server";
import { type Lang } from "@/lib/i18n";
import { tryRecordPosAuditLog } from "@/lib/pos/server/pos-audit.server";
import { buildPosExportFileName, buildPosReplenishmentExportXlsx } from "@/lib/pos/server/pos-export.server";
import { getPosReplenishmentSuggestions } from "@/lib/pos/server/pos-reports.server";
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
    const result = await getPosReplenishmentSuggestions({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      storeId: storeScope.storeId,
      keyword: url.searchParams.get("keyword")?.trim() || undefined,
      lowStockOnly: url.searchParams.get("lowStockOnly") === "1",
      suggestedOnly: url.searchParams.get("suggestedOnly") === "1",
      dateFrom: url.searchParams.get("dateFrom")?.trim() || undefined,
      dateTo: url.searchParams.get("dateTo")?.trim() || undefined,
      limit: Number(url.searchParams.get("limit") || 500),
    });
    await tryRecordPosAuditLog({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      input: {
        actionType: "export_triggered",
        module: "replenishment",
        actorUserId: auth.session.userId,
        actorName: auth.session.name || auth.session.userId,
        actorRole: auth.pos.role,
        storeId: storeScope.storeId || null,
        summary: `导出补货建议 ${result.items.length} 条`,
        detailsJson: {
          exportType: "replenishment",
          filters: {
            storeId: storeScope.storeId || "",
            keyword: url.searchParams.get("keyword")?.trim() || "",
            lowStockOnly: url.searchParams.get("lowStockOnly") === "1",
            suggestedOnly: url.searchParams.get("suggestedOnly") === "1",
            dateFrom: url.searchParams.get("dateFrom")?.trim() || "",
            dateTo: url.searchParams.get("dateTo")?.trim() || "",
            limit: Number(url.searchParams.get("limit") || 500),
          },
        },
        resultStatus: "success",
      },
    });
    const buffer = await buildPosReplenishmentExportXlsx(lang, result);
    const fileName = buildPosExportFileName(lang === "zh" ? "补货建议" : "pos-replenishment");

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
        module: "replenishment",
        actorUserId: auth.session.userId,
        actorName: auth.session.name || auth.session.userId,
        actorRole: auth.pos.role,
        storeId: auth.pos.defaultStoreId || null,
        summary: "导出补货建议失败",
        detailsJson: { exportType: "replenishment", error: error instanceof Error ? error.message : "POS_EXPORT_FAILED" },
        resultStatus: "failed",
      },
    });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "POS_EXPORT_FAILED" },
      { status: 500 },
    );
  }
}
