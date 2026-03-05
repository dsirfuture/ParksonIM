import { prisma } from "@/lib/prisma";

/**
 * Write ScanLog (audit trail)
 * Keep payload JSON for before/after snapshots.
 */
export async function writeScanLog(params: {
  tenant_id: string;
  company_id: string;
  receipt_id?: string | null;
  item_id?: string | null;
  action_type: string;
  before_value?: any;
  after_value?: any;
  operator_id?: string | null;
  device_id?: string | null;
}) {
  await prisma.scanLog.create({
    data: {
      tenant_id: params.tenant_id,
      company_id: params.company_id,
      receipt_id: params.receipt_id ?? null,
      item_id: params.item_id ?? null,
      action_type: params.action_type,
      before_value: params.before_value ?? null,
      after_value: params.after_value ?? null,
      operator_id: params.operator_id ?? null,
      device_id: params.device_id ?? null,
    },
  });
}

/**
 * ✅ Backward-compatible export:
 * some routes import { logScan } from "@/lib/audit"
 */
export const logScan = writeScanLog;
