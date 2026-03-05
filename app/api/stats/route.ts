import { NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Temporary no-op stats endpoint.
 * Reason: Prisma aggregate typings are failing (schema/client not aligned yet).
 * We'll restore real stats after Prisma models/fields are fully migrated.
 */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return errorResponse("FORBIDDEN", "Admin required", 403);
  }

  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "Stats aggregation not enabled yet",
    data: {
      total_receipts: 0,
      pending: 0,
      in_progress: 0,
      completed: 0,
      total_items_sum: 0,
      completed_items_sum: 0,
    },
  });
}
