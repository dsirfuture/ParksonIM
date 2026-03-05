import { NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import { errorResponse } from "@/lib/errors";
import { nanoid } from "nanoid";

export const runtime = "nodejs";

/**
 * Temporary no-op import validate endpoint.
 * Reason: Prisma schema/client does not expose ImportBatch model yet.
 * We'll restore real validate->commit workflow after migrations.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return errorResponse("FORBIDDEN", "Admin required", 403);
  }

  // Accept either multipart file or JSON body; do minimal validation only.
  const contentType = req.headers.get("content-type") || "";
  let rowsCount = 0;

  try {
    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      const file = fd.get("file") as File | null;
      if (!file) return errorResponse("VALIDATION_FAILED", "File required", 400);
      // We skip parsing for now to keep build + flow alive
      rowsCount = 0;
    } else {
      const body = await req.json().catch(() => ({} as any));
      rowsCount = Array.isArray(body?.rows) ? body.rows.length : 0;
    }
  } catch {
    // ignore
  }

  const batch_id = `mock_${nanoid()}`;

  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "ImportBatch model not enabled in Prisma client yet",
    batch_id,
    stats: {
      rows: rowsCount,
      valid: rowsCount,
      invalid: 0,
    },
    errors: [],
  });
}
