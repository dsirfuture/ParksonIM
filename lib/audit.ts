import { getSession } from "./tenant";

/**
 * TEMPORARY AUDIT IMPLEMENTATION (NO-OP)
 * Reason: Prisma schema/client does NOT expose ScanLog model yet, so any
 * prisma.scanLog.* call will fail compilation in Vercel.
 *
 * After you finish Prisma migrations for ScanLog, we will replace these
 * no-op functions with real DB writes.
 */

export type ScanActionType =
  | "SCAN"
  | "UPDATE_QTY"
  | "UPDATE_FIELDS"
  | "UPLOAD_EVIDENCE"
  | "SUBMIT_ITEM"
  | "COMPLETE_RECEIPT"
  | "IMPORT_VALIDATE"
  | "IMPORT_COMMIT"
  | "EXPORT"
  | "SHARE";

export type WriteScanLogParams = {
  tenant_id: string;
  company_id: string;
  receipt_id: string;
  item_id?: string | null;
  action_type: ScanActionType | string;
  before_value?: any;
  after_value?: any;
  operator_id: string;
  device_id?: string | null;
};

/** Admin check (simple) */
export async function isAdmin(): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;

  // You can later replace with DB role check (User table)
  return session.role === "admin" || session.userId === "admin-user-id";
}

/**
 * The canonical function some routes may import.
 * Currently NO-OP to keep build passing.
 */
export async function writeScanLog(_params: WriteScanLogParams): Promise<void> {
  // NO-OP: ScanLog table not migrated yet
  return;
}

/**
 * Backward-compatible export name (some routes import `logScan`)
 */
export const logScan = writeScanLog;

/**
 * Some routes may want a helper to enforce admin.
 */
export async function requireAdminOrThrow(): Promise<void> {
  const ok = await isAdmin();
  if (!ok) {
    throw new Error("FORBIDDEN: Admin required");
  }
}
