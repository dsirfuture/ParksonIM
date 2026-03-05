import { NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import { errorResponse } from "@/lib/errors";

/**
 * Temporary no-op.
 * Reason: Prisma schema/client does not expose MasterShareLink model yet.
 * We'll enable real update after migrations.
 */
export async function PATCH(req: Request, ctx: any) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return errorResponse("FORBIDDEN", "Admin required", 403);
  }

  const shareId = (ctx?.params?.shareId as string | undefined)?.trim();
  if (!shareId) return errorResponse("VALIDATION_FAILED", "shareId required", 400);

  const body = await req.json().catch(() => ({} as any));
  const active = typeof body?.active === "boolean" ? body.active : true;

  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "MasterShareLink model not enabled in Prisma client yet",
    shareId,
    active,
  });
}

// 有些前端可能用 POST 当 toggle，这里也给一个兼容
export async function POST(req: Request, ctx: any) {
  return PATCH(req, ctx);
}
