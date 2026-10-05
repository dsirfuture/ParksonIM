import { NextRequest, NextResponse } from "next/server";
import { listPosStores } from "@/lib/pos/server/pos-stores.server";
import { requirePosSession } from "@/lib/pos/server/pos-route";

export async function GET() {
  const auth = await requirePosSession(["pos.store_settings.view", "pos.store.manage"], {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;

  const items = await listPosStores({
    tenantId: auth.scope.tenantId,
    companyId: auth.scope.companyId,
    scopeStoreId: auth.pos.allowAllStores ? undefined : auth.pos.defaultStoreId,
  });

  return NextResponse.json({ ok: true, items });
}
