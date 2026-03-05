import { NextResponse } from "next/server";

/**
 * Temporary no-op public evidence endpoint.
 * Reason: Receipt model does not have `public_share_id` field yet.
 * We'll implement proper public evidence via MasterShareLink / ReceiptPublicShare later.
 */
export async function GET(_req: Request, ctx: any) {
  const publicShareId = (ctx?.params?.publicShareId as string | undefined)?.trim();

  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: "Public evidence link mapping not enabled yet",
    publicShareId: publicShareId || null,
    receipt: null,
    evidences: [],
  });
}
