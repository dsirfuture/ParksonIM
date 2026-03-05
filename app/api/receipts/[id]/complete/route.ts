import { NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import { errorResponse } from "@/lib/errors";

/**
 * Temporary no-op receipt complete endpoint.
 * Reason:
 * - Idempotency helper signatures not finalized yet
 * - We'll re-enable real completion (status=completed, locked=true, audit log)
 *   after IdempotencyRecord + ScanLog models are migrated.
 */
export async function POST(_req: Request, ctx: any) {
  const session = await getSession();
  if (!session) return errorResponse("FORBIDDEN", "Auth required", 403);

  const id = (ctx?.params?.id as string | undefined)?.trim();
  if (!id) return errorResponse("VALIDATION_FAILED", "id required", 400);

  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "Receipt completion not enabled yet (idempotency/audit pending)",
    receiptId: id,
  });
}
