import { NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Temporary no-op item update endpoint.
 * Reason: idempotency helper signatures and Prisma models are not aligned yet.
 * We'll restore real implementation (transaction + optimistic lock + idempotency + audit)
 * after Prisma schema/migrations are completed.
 */
export async function PATCH(_req: Request, ctx: any) {
  const session = await getSession();
  if (!session) return errorResponse("FORBIDDEN", "Auth required", 403);

  const id = (ctx?.params?.id as string | undefined)?.trim();
  const itemId = (ctx?.params?.itemId as string | undefined)?.trim();

  if (!id) return errorResponse("VALIDATION_FAILED", "id required", 400);
  if (!itemId) return errorResponse("VALIDATION_FAILED", "itemId required", 400);

  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "Item update not enabled yet (idempotency/audit/locking pending)",
    receiptId: id,
    itemId,
  });
}

// Some clients may call POST for update; keep compatibility
export async function POST(req: Request, ctx: any) {
  return PATCH(req, ctx);
}
