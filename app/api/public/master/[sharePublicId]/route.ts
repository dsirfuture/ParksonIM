import { NextResponse } from "next/server";

/**
 * Temporary no-op public master info endpoint.
 * Reason: Prisma schema/client does not expose MasterShareLink model yet.
 * We'll enable real DB query after migrations.
 */
export async function GET(_req: Request, ctx: any) {
  const sharePublicId = (ctx?.params?.sharePublicId as string | undefined)?.trim();

  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "MasterShareLink model not enabled in Prisma client yet",
    sharePublicId: sharePublicId || null,
    data: null,
  });
}
