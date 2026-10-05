import { NextRequest, NextResponse } from "next/server";
import { ensurePosStoreAccess, requirePosSession } from "@/lib/pos/server/pos-route";
import { getPosTicketConfig, savePosTicketConfig } from "@/lib/pos/server/pos-ticket-settings.server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ storeId: string }> },
) {
  const auth = await requirePosSession(["pos.receipt_template.view", "pos.ticket.manage"], {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;
  const params = await context.params;
  const storeId = decodeURIComponent(params.storeId);
  const scopeCheck = ensurePosStoreAccess(auth.pos, storeId);
  if (!scopeCheck.ok) return scopeCheck.response;

  const item = await getPosTicketConfig({
    tenantId: auth.scope.tenantId,
    companyId: auth.scope.companyId,
    storeId,
  });
  return NextResponse.json({ ok: true, item });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ storeId: string }> },
) {
  const auth = await requirePosSession("pos.ticket.manage", {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;
  const params = await context.params;
  const storeId = decodeURIComponent(params.storeId);
  const scopeCheck = ensurePosStoreAccess(auth.pos, storeId);
  if (!scopeCheck.ok) return scopeCheck.response;

  const payload = await request.json().catch(() => ({}));
  try {
    const item = await savePosTicketConfig({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      storeId,
      input: {
        ticketHeaderName: String(payload?.ticketHeaderName || ""),
        ticketHeaderSubtitle: String(payload?.ticketHeaderSubtitle || ""),
        companyFullName: String(payload?.companyFullName || ""),
        logoUrl: String(payload?.logoUrl || ""),
        showLogo: Boolean(payload?.showLogo),
        address: String(payload?.address || ""),
        phone: String(payload?.phone || ""),
        whatsapp: String(payload?.whatsapp || ""),
        website: String(payload?.website || ""),
        qrContent: String(payload?.qrContent || ""),
        rfc: String(payload?.rfc || ""),
        showTicketBarcode: payload?.showTicketBarcode !== false,
        showRfc: Boolean(payload?.showRfc),
        showWhatsapp: Boolean(payload?.showWhatsapp),
        showWebsite: Boolean(payload?.showWebsite),
        showQr: Boolean(payload?.showQr),
        showCashier: payload?.showCashier !== false,
        showCustomer: payload?.showCustomer !== false,
        footerLine1: String(payload?.footerLine1 || ""),
        footerLine2: String(payload?.footerLine2 || ""),
      },
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "POS_TICKET_SETTING_SAVE_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
