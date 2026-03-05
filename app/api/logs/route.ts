import { NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import { errorResponse } from "@/lib/errors";

/**
 * Temporary no-op logs endpoint.
 * Reason: Prisma schema/client does not expose ScanLog model yet.
 * We'll re-enable DB query after migrations are aligned.
 */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return errorResponse("FORBIDDEN", "Admin required", 403);
  }

  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "ScanLog model not enabled in Prisma client yet",
    data: [],
  });
}
