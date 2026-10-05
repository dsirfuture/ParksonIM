import { NextResponse } from "next/server";
import { listPosAuditLogRowsForExport, tryRecordPosAuditLog } from "@/lib/pos/server/pos-audit.server";
import { buildPosAuditLogsExportXlsx, buildPosExportFileName } from "@/lib/pos/server/pos-export.server";
import { requirePosSession, resolvePosStoreFromRequest } from "@/lib/pos/server/pos-route";
import { type Lang } from "@/lib/i18n";

export async function GET(request: Request) {
  const auth = await requirePosSession("pos.audit.view", {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;

  const storeScope = resolvePosStoreFromRequest(auth.pos, request.url, {
    requireStore: false,
  });
  if (!storeScope.ok) return storeScope.response;

  const url = new URL(request.url);
  const lang = (url.searchParams.get("lang") || "zh") as Lang;
  const filters = {
    storeId: storeScope.storeId || "",
    actorUserId: url.searchParams.get("actorUserId") || "",
    actorRole: url.searchParams.get("actorRole") || "",
    module: url.searchParams.get("module") || "",
    actionType: url.searchParams.get("actionType") || "",
    resultStatus: url.searchParams.get("resultStatus") || "",
    dateFrom: url.searchParams.get("dateFrom") || "",
    dateTo: url.searchParams.get("dateTo") || "",
    page: Number(url.searchParams.get("page") || 1),
    limit: Number(url.searchParams.get("limit") || 100),
  };

  try {
    const items = await listPosAuditLogRowsForExport({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      query: filters,
    });
    const buffer = await buildPosAuditLogsExportXlsx(lang, items);

    await tryRecordPosAuditLog({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      input: {
        actionType: "export_triggered",
        module: "audit_logs",
        actorUserId: auth.session.userId,
        actorName: auth.session.name || auth.session.userId,
        actorRole: auth.pos.role,
        storeId: storeScope.storeId || null,
        summary: "导出操作日志",
        detailsJson: {
          exportType: "audit_logs",
          filters,
        },
        resultStatus: "success",
      },
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(buildPosExportFileName("pos-audit-logs"))}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "POS_EXPORT_FAILED";
    await tryRecordPosAuditLog({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      input: {
        actionType: "export_triggered",
        module: "audit_logs",
        actorUserId: auth.session.userId,
        actorName: auth.session.name || auth.session.userId,
        actorRole: auth.pos.role,
        storeId: storeScope.storeId || null,
        summary: "导出操作日志失败",
        detailsJson: {
          exportType: "audit_logs",
          filters,
          error: message,
        },
        resultStatus: "failed",
      },
    });
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
