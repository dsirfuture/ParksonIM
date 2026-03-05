import { NextResponse } from "next/server";

/**
 * Temporary no-op cleanup route.
 * Reason: Prisma schema does not contain IdempotencyRecord model yet.
 * This route is not required for core flow; we enable real DB cleanup later.
 */
export async function POST() {
  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "IdempotencyRecord model not enabled yet",
  });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "IdempotencyRecord model not enabled yet",
  });
}
