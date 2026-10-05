import { createPosAuditLog, getPosAuditLogById, listPosAuditLogs, listPosAuditLogsForExport } from "@/lib/pos/repositories/pos-audit.repository";
import { getPosAuditActionLabelKey, getPosAuditModuleLabelKey, getPosAuditTargetLabelKey } from "@/lib/pos/audit-labels";
import { type PosAuditLogDetail, type PosAuditLogItem, type PosAuditLogQuery } from "@/lib/pos/types";
import { type PosUserRole } from "@/lib/pos/access";

type TenantScope = {
  tenantId: string;
  companyId: string;
};

type PosAuditLogInput = {
  actionType: string;
  module: string;
  actorUserId?: string | null;
  actorName: string;
  actorRole: string;
  storeId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  targetFolio?: string | null;
  summary: string;
  detailsJson?: Record<string, unknown> | null;
  resultStatus: "success" | "failed" | "denied";
};

function normalizeJson(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function mapAuditLogRow(row: {
  id: string;
  action_type: string;
  module: string;
  actor_user_id: string | null;
  actor_name: string;
  actor_role: string;
  store_id: string | null;
  target_type: string | null;
  target_id: string | null;
  target_folio: string | null;
  summary: string;
  details_json: unknown;
  result_status: string;
  created_at: Date;
}): PosAuditLogItem {
  return {
    id: row.id,
    actionType: row.action_type,
    module: row.module,
    actorUserId: row.actor_user_id,
    actorName: row.actor_name,
    actorRole: row.actor_role,
    storeId: row.store_id,
    targetType: row.target_type,
    targetId: row.target_id,
    targetFolio: row.target_folio,
    summary: row.summary,
    detailsJson: normalizeJson(row.details_json),
    resultStatus: row.result_status,
    createdAt: row.created_at.toISOString(),
  };
}

function stringifyValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) {
    const normalized = value.map((item) => String(item || "").trim()).filter(Boolean);
    return normalized.length ? normalized.join(", ") : "-";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }
  return String(value);
}

function splitPermissionOverrides(values: unknown) {
  const items = Array.isArray(values) ? values.map((item) => String(item || "").trim()).filter(Boolean) : [];
  const grants = items
    .filter((item) => item.endsWith(":grant"))
    .map((item) => item.replace(/:grant$/, ""));
  const denies = items
    .filter((item) => item.endsWith(":deny"))
    .map((item) => item.replace(/:deny$/, ""));
  return {
    grants: grants.length ? grants.join(", ") : "-",
    denies: denies.length ? denies.join(", ") : "-",
  };
}

function buildAuditDetail(row: PosAuditLogItem): PosAuditLogDetail {
  const details = row.detailsJson || {};
  const detail: PosAuditLogDetail = {
    ...row,
    keyFields: [],
    detailFields: [],
    changeFields: [],
  };

  switch (row.actionType) {
    case "checkout_completed":
      detail.keyFields = [
        { labelKey: "pos.field.total", value: stringifyValue(details.total) },
        { labelKey: "pos.field.payment_method", value: stringifyValue(details.paymentMethod) },
        { labelKey: "pos.field.source_type", value: stringifyValue(details.sourceType) },
        { labelKey: "pos.field.line_count", value: stringifyValue(details.lineCount) },
      ];
      break;
    case "refund_completed":
      detail.keyFields = [
        { labelKey: "pos.field.folio", value: stringifyValue(details.refundFolio) },
        { labelKey: "pos.field.source_folio", value: stringifyValue(details.originalSaleFolio) },
        { labelKey: "pos.field.total", value: stringifyValue(details.total) },
      ];
      break;
    case "inventory_adjusted":
    case "inventory_counted":
    case "inventory_damaged":
      detail.keyFields = [
        { labelKey: "pos.field.product_id", value: stringifyValue(details.productId) },
        { labelKey: "pos.field.clave", value: stringifyValue(details.clave) },
        { labelKey: "pos.field.reason", value: stringifyValue(details.reason) },
      ];
      detail.changeFields = [
        {
          labelKey: "pos.field.quantity",
          before: stringifyValue(details.qtyBefore),
          after: stringifyValue(details.qtyAfter),
          change: stringifyValue(details.qtyChange),
        },
      ];
      break;
    case "inventory_import_committed":
      detail.keyFields = [
        { labelKey: "pos.field.row_count", value: stringifyValue(details.rowCount) },
        { labelKey: "pos.field.success_count", value: stringifyValue(details.successCount) },
      ];
      break;
    case "transfer_created":
    case "transfer_sent":
    case "transfer_received":
      detail.keyFields = [
        { labelKey: "pos.field.from_store", value: stringifyValue(details.fromStoreId) },
        { labelKey: "pos.field.to_store", value: stringifyValue(details.toStoreId) },
        { labelKey: "pos.field.line_count", value: stringifyValue(details.lineCount) },
      ];
      break;
    case "cashier_role_updated":
      detail.changeFields = [
        {
          labelKey: "pos.field.role",
          before: stringifyValue(details.beforeRole || details.oldRole),
          after: stringifyValue(details.afterRole || details.newRole),
        },
      ];
      break;
    case "cashier_permission_updated": {
      const before = splitPermissionOverrides(details.before);
      const after = splitPermissionOverrides(details.after);
      detail.changeFields = [
        {
          labelKey: "pos.field.granted_permissions",
          before: before.grants,
          after: after.grants,
        },
        {
          labelKey: "pos.field.denied_permissions",
          before: before.denies,
          after: after.denies,
        },
      ];
      break;
    }
    case "export_triggered":
      detail.keyFields = [
        { labelKey: "pos.field.export_type", value: stringifyValue(details.exportType) },
        { labelKey: "pos.field.result", value: row.resultStatus },
      ];
      detail.detailFields = [
        { labelKey: "pos.field.filters", value: stringifyValue(details.filters || {}) },
      ];
      break;
    case "access_denied":
      detail.keyFields = [
        { labelKey: "pos.field.attempted_action", value: stringifyValue(details.attemptedAction) },
        { labelKey: "pos.field.reason", value: stringifyValue(details.reason) },
        { labelKey: "pos.field.allowed_roles", value: stringifyValue(details.allowedRoles) },
        { labelKey: "pos.field.store_scope", value: stringifyValue(details.storeScope) },
      ];
      break;
    default:
      detail.detailFields = Object.entries(details).map(([key, value]) => ({
        labelKey: key.startsWith("pos.") ? key : "pos.field.details",
        value: `${key}: ${stringifyValue(value)}`,
      }));
      break;
  }

  if (!detail.detailFields?.length && details && Object.keys(details).length > 0) {
    const consumedKeys = new Set<string>();
    if (detail.keyFields?.length) {
      // best-effort skip for common keys displayed above
      ["productId", "clave", "reason", "total", "paymentMethod", "sourceType", "lineCount", "refundFolio", "originalSaleFolio", "fromStoreId", "toStoreId", "rowCount", "successCount", "beforeRole", "afterRole", "oldRole", "newRole", "before", "after", "exportType", "filters", "attemptedAction", "allowedRoles", "storeScope"].forEach((item) => consumedKeys.add(item));
    }
    if (detail.changeFields?.length) {
      ["qtyBefore", "qtyAfter", "qtyChange"].forEach((item) => consumedKeys.add(item));
    }
    detail.detailFields = Object.entries(details)
      .filter(([key]) => !consumedKeys.has(key))
      .map(([key, value]) => ({
        labelKey: "pos.field.details",
        value: `${key}: ${stringifyValue(value)}`,
      }));
  }

  return detail;
}

export async function recordPosAuditLog(params: TenantScope & { input: PosAuditLogInput }) {
  return createPosAuditLog(params);
}

export async function tryRecordPosAuditLog(params: TenantScope & { input: PosAuditLogInput }) {
  try {
    await recordPosAuditLog(params);
  } catch (error) {
    console.error("[pos-audit] write failed:", error);
  }
}

export async function listPosAuditLogRows(params: TenantScope & { query?: PosAuditLogQuery }) {
  const result = await listPosAuditLogs(params);
  return {
    items: result.items.map(mapAuditLogRow),
    total: result.total,
    page: result.page,
    limit: result.limit,
  };
}

export async function listPosAuditLogRowsForExport(params: TenantScope & { query?: PosAuditLogQuery }) {
  const items = (await listPosAuditLogsForExport(params)) as Array<Parameters<typeof mapAuditLogRow>[0]>;
  return items.map(mapAuditLogRow);
}

export async function getPosAuditLogDetail(params: TenantScope & { id: string }) {
  const row = await getPosAuditLogById(params);
  if (!row) throw new Error("POS_AUDIT_LOG_NOT_FOUND");
  return buildAuditDetail(mapAuditLogRow(row as any));
}

export function posRoleLabelValue(role: string | PosUserRole | null | undefined) {
  if (!role) return "store_admin";
  return role;
}

export {
  getPosAuditActionLabelKey,
  getPosAuditModuleLabelKey,
  getPosAuditTargetLabelKey,
};
