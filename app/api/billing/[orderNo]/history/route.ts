import { NextResponse } from "next/server";
import { getBillingActionLabel, getBillingFormatLabel } from "@/lib/billing-action-log";
import { parseBillingBooleanFlag, parseBillingRemark } from "@/lib/billing-meta";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";

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

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderNo: string }> },
) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { orderNo } = await params;
    const normalizedOrderNo = String(orderNo || "").trim();
    if (!normalizedOrderNo) {
      return NextResponse.json({ error: "缺少账单号" }, { status: 400 });
    }

    const [logs, order] = await Promise.all([
      prisma.billingActionLog.findMany({
        where: {
          tenant_id: session.tenantId,
          company_id: session.companyId,
          order_no: normalizedOrderNo,
        },
        orderBy: { created_at: "desc" },
      }),
      prisma.ygOrderImport.findFirst({
        where: {
          tenant_id: session.tenantId,
          company_id: session.companyId,
          order_no: normalizedOrderNo,
        },
        select: {
          order_no: true,
          order_remark: true,
          updated_at: true,
        },
      }),
    ]);

    const entries = logs.map((log) => ({
      id: log.id,
      createdAtText: formatDateTime(log.created_at),
      actionText: getBillingActionLabel(log.action_type),
      formatText: getBillingFormatLabel(log.format_type),
      detailText: log.detail_text || "-",
      reasonText: log.reason_text || "",
      operatorName: log.operator_name || "-",
    }));

    if (order) {
      const parsed = parseBillingRemark(order.order_remark);
      const hasGenerateLog = logs.some((log) => log.action_type === "generate");
      const hasRevokeLog = logs.some((log) => log.action_type === "revoke");
      const hasPaidLog = logs.some((log) => log.action_type === "mark_paid");

      if (parsed.meta.generatedAt && !hasGenerateLog) {
        entries.push({
          id: `generated-${normalizedOrderNo}`,
          createdAtText: parsed.meta.generatedAt
            ? formatDateTime(new Date(parsed.meta.generatedAt))
            : "",
          actionText: "生成账单",
          formatText: parseBillingBooleanFlag(parsed.meta.generatedVipEnabled) ? "VIP" : "-",
          detailText: parseBillingBooleanFlag(parsed.meta.generatedVipEnabled)
            ? "生成账单（启用VIP折扣）"
            : "生成账单",
          reasonText: "",
          operatorName: "-",
        });
      }

      if (parsed.meta.revokeReason && !hasRevokeLog) {
        entries.push({
          id: `revoke-${normalizedOrderNo}`,
          createdAtText: formatDateTime(order.updated_at),
          actionText: "撤销生成",
          formatText: "-",
          detailText: "撤销生成",
          reasonText: parsed.meta.revokeReason,
          operatorName: "-",
        });
      }

      if (parsed.meta.paidAt && !hasPaidLog) {
        entries.push({
          id: `paid-${normalizedOrderNo}`,
          createdAtText: formatDateTime(new Date(parsed.meta.paidAt)),
          actionText: "标记已付款",
          formatText: "-",
          detailText: "账单已付款并永久锁定",
          reasonText: "",
          operatorName: "-",
        });
      }
    }

    entries.sort((a, b) => b.createdAtText.localeCompare(a.createdAtText));

    return NextResponse.json({ ok: true, entries });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取账单记录失败" },
      { status: 500 },
    );
  }
}
