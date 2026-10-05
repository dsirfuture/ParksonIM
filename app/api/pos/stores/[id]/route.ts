import { NextRequest, NextResponse } from "next/server";
import { ensurePosStoreAccess, requirePosSession } from "@/lib/pos/server/pos-route";
import { getPosStore, savePosStore } from "@/lib/pos/server/pos-stores.server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePosSession(["pos.store_settings.view", "pos.store.manage"], {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;
  const params = await context.params;
  const storeId = decodeURIComponent(params.id);
  const scopeCheck = ensurePosStoreAccess(auth.pos, storeId);
  if (!scopeCheck.ok) return scopeCheck.response;

  const item = await getPosStore({
    tenantId: auth.scope.tenantId,
    companyId: auth.scope.companyId,
    storeId,
  });
  return NextResponse.json({ ok: true, item });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePosSession("pos.store.manage", {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;
  const params = await context.params;
  const storeId = decodeURIComponent(params.id);
  const scopeCheck = ensurePosStoreAccess(auth.pos, storeId);
  if (!scopeCheck.ok) return scopeCheck.response;

  const payload = await request.json().catch(() => ({}));
  try {
    const item = await savePosStore({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      storeId,
      input: {
        storeName: String(payload?.storeName || ""),
        storeCode: String(payload?.storeCode || ""),
        address: String(payload?.address || ""),
        phone: String(payload?.phone || ""),
        rfc: String(payload?.rfc || ""),
        active: payload?.active !== false,
        defaultTicketHeader: String(payload?.defaultTicketHeader || ""),
        ticketSubtitle: String(payload?.ticketSubtitle || ""),
        cashierAutoCloseEnabled: payload?.cashierAutoCloseEnabled === true,
        cashierAutoCloseMinutes: Number(payload?.cashierAutoCloseMinutes || 10),
      },
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "POS_STORE_SAVE_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
