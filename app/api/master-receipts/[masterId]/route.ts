import { NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import { errorResponse } from "@/lib/errors";

/**
 * Temporary no-op.
 * Reason: Prisma schema/client does not expose MasterReceipt model yet.
 * We'll enable real DB query after migrations.
 */
export async function GET(_req: Request, ctx: any) {
  const session = await getSession();
  if (!session) return errorResponse("FORBIDDEN", "Auth required", 403);

  const masterId = (ctx?.params?.masterId as string | undefined)?.trim();
  if (!masterId) return errorResponse("VALIDATION_FAILED", "masterId required", 400);

  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "MasterReceipt model not enabled in Prisma client yet",
    masterId,
    data: null,
  });
}
