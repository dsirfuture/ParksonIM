import { NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Temporary no-op export endpoint.
 * Reason: Prisma schema/client relations (receipt.items) are not aligned yet,
 * causing TS "include is never" build failure.
 * We'll restore real XLSX export after Prisma models are migrated.
 */
export async function GET(_req: Request, ctx: any) {
  const session = await getSession();
  if (!session) return errorResponse("FORBIDDEN", "Auth required", 403);

  const id = (ctx?.params?.id as string | undefined)?.trim();
  if (!id) return errorResponse("VALIDATION_FAILED", "id required", 400);

  const content = `Export not ready yet.\nreceiptId=${id}\n`;
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="receipt_${id}.txt"`,
    },
  });
}
