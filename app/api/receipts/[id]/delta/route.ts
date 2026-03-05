import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { errorResponse } from "@/lib/errors";

/**
 * Delta polling endpoint (every ~3s).
 * Temporary implementation:
 * - Do NOT rely on receipt.last_activity_at (not in schema currently)
 * - Use updated_at if available; otherwise always report changed=true
 */
export async function GET(req: Request, ctx: any) {
  const session = await getSession();
  if (!session) return errorResponse("FORBIDDEN", "Auth required", 403);

  const id = (ctx?.params?.id as string | undefined)?.trim();
  if (!id) return errorResponse("VALIDATION_FAILED", "id required", 400);

  const url = new URL(req.url);
  const since = url.searchParams.get("since"); // ISO string

  // Try to fetch minimal fields
  const receipt: any = await prisma.receipt.findFirst({
    where: {
      id,
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    select: {
      id: true,
      // If your schema has updated_at, Prisma will allow it.
      // If not, this still compiles because we cast receipt as any.
      updated_at: true as any,
      created_at: true as any,
    } as any,
  });

  if (!receipt) return errorResponse("NOT_FOUND", "Receipt not found", 404);

  // If client didn't send since, force changed=true
  if (!since) {
    return NextResponse.json({ changed: true });
  }

  const sinceDate = new Date(since);

  const ts =
    (receipt.updated_at ? new Date(receipt.updated_at) : null) ??
    (receipt.created_at ? new Date(receipt.created_at) : null);

  // If we still don't have a timestamp, be safe: changed=true
  if (!ts) {
    return NextResponse.json({ changed: true });
  }

  const changed = ts.getTime() > sinceDate.getTime();
  return NextResponse.json({ changed });
}
