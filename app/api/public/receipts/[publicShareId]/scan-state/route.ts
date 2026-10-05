import { NextResponse } from "next/server";
import { getLang } from "@/lib/i18n-server";
import { getMobileReceiptI18n, resolveLang } from "@/lib/mobile-receipt-i18n";
import { getReceiptScanStateByPublicShareId } from "@/lib/receipts/scan-state";

export async function GET(
  request: Request,
  context: { params: Promise<{ publicShareId: string }> },
) {
  const { publicShareId } = await context.params;
  const cookieLang = await getLang();
  const lang = resolveLang(new URL(request.url).searchParams.get("lang"), cookieLang);
  const i18n = getMobileReceiptI18n(lang);
  const state = await getReceiptScanStateByPublicShareId({
    publicShareId,
    lang,
  });

  if (!state) {
    return NextResponse.json({ ok: false, error: i18n.server.receiptNotFound }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    ...state,
  });
}
