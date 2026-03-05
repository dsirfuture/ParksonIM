import { NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Temporary no-op scan endpoint.
 * Reason: idempotency helper signatures and Prisma models are not aligned yet.
 * We'll restore real scan (transaction + optimistic lock + idempotency + audit)
 * after Prisma schema/migrations are completed.
 */
export async function POST(req: Request, ctx: any) {
  const session = await getSession();
  if (!session) return errorResponse("FORBIDDEN", "Auth required", 403);

  const id = (ctx?.params?.id as string | undefined)?.trim();
  if (!id) return errorResponse("VALIDATION_FAILED", "id required", 400);

  const body = await req.json().catch(() => ({} as any));
  const barcodeOrSku = (body?.barcode || body?.sku || "").toString().trim();

  // 先不强校验，避免前端报错卡死
  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "Scan not enabled yet (idempotency/audit/receiptItem pending)",
    receiptId: id,
    input: barcodeOrSku || null,
  });
}
