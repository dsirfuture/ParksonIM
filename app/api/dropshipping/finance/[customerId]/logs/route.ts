import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";

export const runtime = "nodejs";

function buildFinanceCustomerLogKey(customerId: string) {
  return `finance-customer:${customerId}`;
}

function extractStatementNumber(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return "";
  const matched = text.match(/BS-\d{8}(?:-\d{3})?/i);
  return matched ? matched[0] : "";
}

function extractCycleText(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return "";
  const segment = text
    .split(/\s\/\s/)
    .find((part) => String(part || "").includes("周期："));
  if (!segment) return "";
  return segment.replace(/^.*?周期：/, "").trim();
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "America/Mexico_City",
  }).format(value);
}

function normalizeStatementCycleText(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return "";
  const directRangeMatch = text.match(/(\d{4}\/\d{2}\/\d{2}\s-\s\d{2}\/\d{2})/);
  if (directRangeMatch?.[1]) return directRangeMatch[1];
  const extracted = extractCycleText(text);
  const extractedRangeMatch = extracted.match(/(\d{4}\/\d{2}\/\d{2}\s-\s\d{2}\/\d{2})/);
  return extractedRangeMatch?.[1] || extracted;
}

function getActionLabel(actionType: string) {
  switch (String(actionType || "").trim()) {
    case "finance_view_detail":
      return "查看详情";
    case "finance_statement_preview":
      return "账单预览";
    case "finance_export_all":
      return "导出全部数据";
    case "finance_statement_generate":
      return "生成账单";
    case "finance_statement_revoke":
      return "撤销生成";
    case "finance_export_weekly_statement":
      return "导出本周未结账单";
    case "finance_exclude_weekly_order":
      return "移出本周结算";
    case "finance_include_weekly_order":
      return "重新纳入结算";
    case "generate":
      return "生成账单";
    case "revoke":
      return "撤销生成";
    case "export":
      return "导出账单";
    case "copy_export":
      return "导出复制账单";
    default:
      return "账单操作";
  }
}

function buildDefaultDetailText(
  actionType: string,
  customerName: string,
  statementNumber?: string,
  cycleText?: string,
  orderNo?: string,
) {
  const base = customerName ? `客户：${customerName}` : "";
  const statement = statementNumber ? `对账单号：${statementNumber}` : "";
  const cycle = cycleText ? `周期：${cycleText}` : "";
  const order = orderNo ? `订单号：${orderNo}` : "";
  const extras = [statement, cycle, order].filter(Boolean).join(" / ");
  switch (actionType) {
    case "view_detail":
      return [base, "查看结算详情"].filter(Boolean).join(" / ");
    case "statement_preview":
      return [base, "打开账单预览"].filter(Boolean).join(" / ");
    case "export_all":
      return [base, "导出全部数据"].filter(Boolean).join(" / ");
    case "generate_statement":
      return [base, extras, "生成本周未结账单"].filter(Boolean).join(" / ");
    case "revoke_statement":
      return [base, extras, "撤销本周未结账单生成"].filter(Boolean).join(" / ");
    case "export_weekly_statement":
      return [base, extras, "导出本周未结账单"].filter(Boolean).join(" / ");
    case "exclude_weekly_order":
      return [base, extras, "不计入本周未结账单"].filter(Boolean).join(" / ");
    case "include_weekly_order":
      return [base, extras, "重新计入本周未结账单"].filter(Boolean).join(" / ");
    default:
      return base || "客户账单动作";
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    if (!(await hasPermission(session, "viewReports"))) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const { customerId } = await params;
    const normalizedCustomerId = String(customerId || "").trim();
    if (!normalizedCustomerId) {
      return NextResponse.json({ ok: false, error: "缺少客户ID" }, { status: 400 });
    }

    const customerOrderRows = await prisma.dropshippingOrder.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        customer_id: normalizedCustomerId,
      },
      select: {
        platform_order_no: true,
      },
    });

    const orderNos = Array.from(
      new Set(
        customerOrderRows
          .map((row) => String(row.platform_order_no || "").trim())
          .filter(Boolean),
      ),
    );

    const logKey = buildFinanceCustomerLogKey(normalizedCustomerId);
    const logs = await prisma.billingActionLog.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        OR: [
          { order_no: logKey },
          ...(orderNos.length > 0 ? [{ order_no: { in: orderNos } }] : []),
        ],
      },
      orderBy: { created_at: "desc" },
    });

    const entries = logs.map((log) => ({
      id: log.id,
      createdAtText: formatDateTime(log.created_at),
      actionText: getActionLabel(log.action_type),
      operatorName: log.operator_name || "-",
      detailText: log.detail_text || "-",
    }));

    const statementRecordLogs = logs.filter((log) =>
      log.order_no === logKey
      && ["finance_statement_generate", "finance_statement_revoke", "finance_export_weekly_statement"].includes(String(log.action_type || "").trim()),
    );
    const statementRecordMap = new Map<string, {
      statementNumber: string;
      exportedAtText: string;
      operatorName: string;
      cycleText: string;
      createdAt: number;
    }>();
    for (const log of statementRecordLogs) {
      const statementNumberFromLog = extractStatementNumber(log.detail_text);
      if (!statementNumberFromLog) continue;
      const existing = statementRecordMap.get(statementNumberFromLog);
      const createdAt = log.created_at instanceof Date ? log.created_at.getTime() : 0;
      if (existing && existing.createdAt >= createdAt) continue;
      statementRecordMap.set(statementNumberFromLog, {
        statementNumber: statementNumberFromLog,
        exportedAtText: formatDateTime(log.created_at),
        operatorName: log.operator_name || "-",
        cycleText: normalizeStatementCycleText(log.detail_text),
        createdAt,
      });
    }
    const statementEntries = Array.from(statementRecordMap.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ statementNumber: statementNo, exportedAtText, operatorName, cycleText }) => ({
        statementNumber: statementNo,
        cycleText,
        exportedAtText,
        operatorName,
      }));

    const requestUrl = new URL(request.url);
    const statementNumber = String(requestUrl.searchParams.get("statementNumber") || "").trim();
    const statementLogs = statementNumber
      ? logs.filter((log) =>
          log.order_no === logKey
          && String(log.detail_text || "").includes(statementNumber)
          && ["finance_statement_generate", "finance_statement_revoke"].includes(String(log.action_type || "").trim()),
        )
      : [];
    const latestStatementLog = statementLogs[0] || null;
    const statementState = statementNumber
      ? {
          statementNumber,
          isGenerated: latestStatementLog?.action_type === "finance_statement_generate",
          actionText: latestStatementLog ? getActionLabel(latestStatementLog.action_type) : "",
          createdAtText: latestStatementLog ? formatDateTime(latestStatementLog.created_at) : "",
          operatorName: latestStatementLog?.operator_name || "",
          noteText: latestStatementLog?.reason_text || "",
        }
      : null;

    const selectionLogs = logs.filter((log) =>
      log.order_no === logKey
      && ["finance_exclude_weekly_order", "finance_include_weekly_order"].includes(String(log.action_type || "").trim())
      && String(log.reason_text || "").trim(),
    );
    const selectionLogGroups = selectionLogs.reduce((map, log) => {
      const orderId = String(log.reason_text || "").trim();
      if (!orderId) return map;
      const current = map.get(orderId) || [];
      current.push(log);
      map.set(orderId, current);
      return map;
    }, new Map<string, typeof selectionLogs>());
    const excludedOrderIds: string[] = [];
    const includedOrderIds: string[] = [];
    const reincludedOrderIds: string[] = [];
    for (const [orderId, orderLogs] of selectionLogGroups.entries()) {
      const latest = orderLogs[0];
      const latestAction = String(latest?.action_type || "").trim();
      const hasExcludeHistory = orderLogs.some((log) => String(log.action_type || "").trim() === "finance_exclude_weekly_order");
      if (latestAction === "finance_exclude_weekly_order") {
        excludedOrderIds.push(orderId);
      } else if (latestAction === "finance_include_weekly_order") {
        includedOrderIds.push(orderId);
        if (hasExcludeHistory) {
          reincludedOrderIds.push(orderId);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      entries,
      statementEntries,
      statementState,
      selectionState: {
        excludedOrderIds,
        includedOrderIds,
        reincludedOrderIds,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "获取账单动作记录失败" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    if (!(await hasPermission(session, "viewReports"))) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const { customerId } = await params;
    const normalizedCustomerId = String(customerId || "").trim();
    if (!normalizedCustomerId) {
      return NextResponse.json({ ok: false, error: "缺少客户ID" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const actionType = String(body?.actionType || "").trim();
    const customerName = String(body?.customerName || "").trim();
    const statementNumber = String(body?.statementNumber || "").trim();
    const cycleText = String(body?.cycleText || "").trim();
    const noteText = String(body?.note || "").trim();
    const orderId = String(body?.orderId || "").trim();
    const orderNo = String(body?.orderNo || "").trim();
    const actionTypeMap: Record<string, string> = {
      view_detail: "finance_view_detail",
      statement_preview: "finance_statement_preview",
      export_all: "finance_export_all",
      generate_statement: "finance_statement_generate",
      revoke_statement: "finance_statement_revoke",
      export_weekly_statement: "finance_export_weekly_statement",
      exclude_weekly_order: "finance_exclude_weekly_order",
      include_weekly_order: "finance_include_weekly_order",
    };
    const mappedActionType = actionTypeMap[actionType];

    if (!mappedActionType) {
      return NextResponse.json({ ok: false, error: "不支持的动作类型" }, { status: 400 });
    }
    if ((actionType === "exclude_weekly_order" || actionType === "include_weekly_order") && !orderId) {
      return NextResponse.json({ ok: false, error: "缺少订单ID" }, { status: 400 });
    }

    await prisma.billingActionLog.create({
      data: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        order_no: buildFinanceCustomerLogKey(normalizedCustomerId),
        action_type: mappedActionType,
        format_type:
          actionType === "export_all"
            ? "xlsx"
            : actionType === "export_weekly_statement"
              ? "pdf"
              : null,
        reason_text:
          actionType === "exclude_weekly_order" || actionType === "include_weekly_order"
            ? orderId
            : noteText || null,
        detail_text: buildDefaultDetailText(actionType, customerName, statementNumber, cycleText, orderNo),
        operator_id: session.userId,
        operator_name: session.name,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "记录账单动作失败" },
      { status: 500 },
    );
  }
}
