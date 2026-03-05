import { NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import { errorResponse } from "@/lib/errors";

/**
 * Temporary no-op for master receipts list/create.
 * Reason:
 * - Prisma models (MasterReceipt/MasterShareLink/etc.) not enabled yet
 * - idempotency helper signatures not finalized
 * We'll restore real implementation after Prisma schema+migrations are aligned.
 */

export async function GET() {
  const session = await getSession();
  if (!session) return errorResponse("FORBIDDEN", "Auth required", 403);

  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "MasterReceipt model not enabled yet",
    data: [],
  });
}

export async function POST() {
  const session = await getSession();
  if (!session) return errorResponse("FORBIDDEN", "Auth required", 403);

  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "MasterReceipt model/idempotency not enabled yet",
    data: null,
  });
}
