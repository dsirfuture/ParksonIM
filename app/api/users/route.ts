import { NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Temporary no-op users endpoint.
 * Reason: Prisma schema/client does not expose User model yet.
 * We'll enable real DB query after migrations.
 */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return errorResponse("FORBIDDEN", "Admin required", 403);
  }

  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "User model not enabled in Prisma client yet",
    data: [],
  });
}
