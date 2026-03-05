import { NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import { errorResponse } from "@/lib/errors";

/**
 * Temporary no-op.
 * Reason: Prisma schema/client does not expose MasterShareLink model yet.
 * We'll enable real share creation after migrations.
 */
export async function POST(_req: Request, ctx: any) {
  const session = await getSession();
  if (!session) return errorResponse("FORBIDDEN", "Auth required", 403);

  const masterId = (ctx?.params?.masterId as string | undefined)?.trim();
  if (!masterId) return errorResponse("VALIDATION_FAILED", "masterId required", 400);

  // Return a mock "public id" so UI can continue
  const mockSharePublicId = `mock_${masterId}`;

  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "MasterShareLink model not enabled in Prisma client yet",
    masterId,
    share_public_id: mockSharePublicId,
    public_url: `/public/master/${mockSharePublicId}`,
  });
}
