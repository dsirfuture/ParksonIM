import { prisma } from "@/lib/prisma";

export type BillingActionType =
  | "export"
  | "copy_export"
  | "generate"
  | "revoke"
  | "mark_paid"
  | "revoke_paid";

export async function writeBillingActionLog(params: {
  tenantId: string;
  companyId: string;
  orderNo: string;
  actionType: BillingActionType;
  formatType?: string | null;
  reasonText?: string | null;
  detailText?: string | null;
  operatorId?: string | null;
  operatorName?: string | null;
}) {
  await prisma.billingActionLog.create({
    data: {
      tenant_id: params.tenantId,
      company_id: params.companyId,
      order_no: params.orderNo,
      action_type: params.actionType,
      format_type: params.formatType || null,
      reason_text: params.reasonText || null,
      detail_text: params.detailText || null,
      operator_id: params.operatorId || null,
      operator_name: params.operatorName || null,
    },
  });
}

export function getBillingActionLabel(actionType: string) {
  if (actionType === "export") return "导出账单";
  if (actionType === "copy_export") return "导出复制账单";
  if (actionType === "generate") return "生成账单";
  if (actionType === "revoke") return "撤销生成";
  if (actionType === "mark_paid") return "标记已付款";
  if (actionType === "revoke_paid") return "撤销已付款";
  return "账单操作";
}

export function getBillingFormatLabel(formatType: string | null | undefined) {
  const value = String(formatType || "").trim().toLowerCase();
  if (!value) return "-";
  if (value === "xlsx") return "XLSX";
  if (value === "pdf") return "PDF";
  return value.toUpperCase();
}
