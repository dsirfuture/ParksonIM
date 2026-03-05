import { NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import { errorResponse } from "@/lib/errors";
import { nanoid } from "nanoid";

export const runtime = "nodejs";

/**
 * Temporary no-op evidence upload endpoint.
 * Reason: Prisma schema/client does not expose Evidence model yet.
 * We'll enable real DB create + storage upload after migrations.
 */
export async function POST(req: Request, ctx: any) {
  const session = await getSession();
  if (!session) return errorResponse("FORBIDDEN", "Auth required", 403);

  const id = (ctx?.params?.id as string | undefined)?.trim();
  if (!id) return errorResponse("VALIDATION_FAILED", "id required", 400);

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const itemId = (formData.get("item_id") as string | null) || null;

  if (!file) return errorResponse("VALIDATION_FAILED", "File required", 400);

  // Fake URL (later replace with real object storage upload)
  const fileUrl = `https://storage.parksonmx.com/evidence/${nanoid()}_${file.name}`;

  // Return mock evidence object (so UI can continue)
  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "Evidence model not enabled in Prisma client yet",
    data: {
      id: `mock_${nanoid()}`,
      receipt_id: id,
      item_id: itemId,
      type: "photo",
      file_url: fileUrl,
      file_size: file.size,
      mime_type: file.type,
      checksum: "mock-checksum",
      created_at: new Date().toISOString(),
      created_by: session.userId,
    },
  });
}
