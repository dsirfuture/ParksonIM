import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Temporary receipt detail endpoint.
 * Reason: Prisma relation receipt.items is not aligned yet (include becomes never).
 * We'll restore include/items after schema+migrations are fixed.
 */
export async function GET(_req: Request, ctx: any) {
  const session = await getSession();
  if (!session) return errorResponse("FORBIDDEN", "Auth required", 403);

  const id = (ctx?.params?.id as string | undefined)?.trim();
  if (!id) return errorResponse("VALIDATION_FAILED", "id required", 400);

  // Fetch only base fields to avoid `include: { items: true }` typing failure
  const receipt = await prisma.receipt.findFirst({
    where: {
      id,
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
  });

  if (!receipt) return errorResponse("NOT_FOUND", "Receipt not found", 404);

  return NextResponse.json({
    ok: true,
    receipt,
    items: [], // placeholder until ReceiptItem relation is migrated
  });
}
