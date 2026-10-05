import { NextResponse } from "next/server";
import { canAccessPosStore } from "@/lib/pos/access";
import { getPosTransferDetail } from "@/lib/pos/server/pos-transfers.server";
import { requirePosSession } from "@/lib/pos/server/pos-route";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePosSession("pos.transfer.view", {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;

  const params = await context.params;
  try {
    const item = await getPosTransferDetail({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      id: params.id,
    });
    if (
      !auth.pos.allowAllStores &&
      !canAccessPosStore(auth.pos, item.fromStoreId) &&
      !canAccessPosStore(auth.pos, item.toStoreId)
    ) {
      return NextResponse.json({ ok: false, error: "POS_STORE_SCOPE_DENIED" }, { status: 403 });
    }
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "POS_TRANSFER_NOT_FOUND";
    const status = message === "POS_TRANSFER_NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
