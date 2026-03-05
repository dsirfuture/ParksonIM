import { NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Temporary no-op receipt logs endpoint.
 * Reason: Prisma schema/client does not expose ScanLog model yet.
 * We'll enable real DB query after migrations.
 */
export async function GET(_req: Request, ctx: any) {
  const session = await getSession();
  if (!session) return errorResponse("FORBIDDEN", "Auth required", 403);

  const id = (ctx?.params?.id as string | undefined)?.trim();
  if (!id) return errorResponse("VALIDATION_FAILED", "id required", 400);

  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "ScanLog model not enabled in Prisma client yet",
    receiptId: id,
    data: [],
  });
}
