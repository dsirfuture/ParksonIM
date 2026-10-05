import { NextResponse } from "next/server";
import { getLang } from "@/lib/i18n-server";
import { getReceiptScanStateById } from "@/lib/receipts/scan-state";
import { getSession } from "@/lib/tenant";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session?.tenantId || !session.companyId) {
    return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  }

  const { id } = await context.params;
  const lang = await getLang();
  const state = await getReceiptScanStateById({
    receiptId: id,
    tenantId: session.tenantId,
    companyId: session.companyId,
    lang,
  });

  if (!state) {
    return NextResponse.json({ ok: false, error: "未找到对应验货单" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    ...state,
  });
}
