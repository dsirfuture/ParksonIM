import { NextResponse } from "next/server";
import { requirePosSession } from "@/lib/pos/server/pos-route";
import { listPosTicketConfigs } from "@/lib/pos/server/pos-ticket-settings.server";

export async function GET() {
  const auth = await requirePosSession(["pos.receipt_template.view", "pos.ticket.manage"], {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;

  const items = await listPosTicketConfigs({
    tenantId: auth.scope.tenantId,
    companyId: auth.scope.companyId,
    scopeStoreId: auth.pos.allowAllStores ? undefined : auth.pos.defaultStoreId,
  });
  return NextResponse.json({ ok: true, items });
}
