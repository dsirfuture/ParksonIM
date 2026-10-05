import { NextResponse } from "next/server";
import { getPosAuditLogDetail } from "@/lib/pos/server/pos-audit.server";
import { requirePosSession } from "@/lib/pos/server/pos-route";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePosSession("pos.audit.view", {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;

  try {
    const params = await context.params;
    const item = await getPosAuditLogDetail({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      id: params.id,
    });
    if (!auth.pos.allowAllStores && item.storeId !== auth.pos.defaultStoreId) {
      return NextResponse.json({ ok: false, error: "POS_STORE_SCOPE_DENIED" }, { status: 403 });
    }
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "POS_AUDIT_LOG_NOT_FOUND";
    return NextResponse.json({ ok: false, error: message }, { status: message === "POS_AUDIT_LOG_NOT_FOUND" ? 404 : 400 });
  }
}
