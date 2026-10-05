import { NextResponse } from "next/server";
import { getPosSaleDetail } from "@/lib/pos/server/pos-sales.server";
import { ensurePosStoreAccess, requirePosSession } from "@/lib/pos/server/pos-route";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePosSession("pos.sale.view");
  if (!auth.ok) return auth.response;

  const params = await context.params;
  try {
    const item = await getPosSaleDetail({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      id: params.id,
    });
    const access = ensurePosStoreAccess(auth.pos, item.storeId);
    if (!access.ok) return access.response;
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "POS_SALE_NOT_FOUND";
    const status = message === "POS_SALE_NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
