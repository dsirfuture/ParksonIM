import { NextResponse } from "next/server";
import { resolvePosStoreScope } from "@/lib/pos/access";
import { createPosQuote, listPosQuotes } from "@/lib/pos/server/pos-quotes.server";
import { requirePosSession, resolvePosStoreFromRequest } from "@/lib/pos/server/pos-route";
import { type PosQuoteDraftInput } from "@/lib/pos/types";

export async function GET(request: Request) {
  const auth = await requirePosSession("pos.quote.view");
  if (!auth.ok) return auth.response;
  const storeScope = resolvePosStoreFromRequest(auth.pos, request.url, { requireStore: false });
  if (!storeScope.ok) return storeScope.response;

  const items = await listPosQuotes({
    tenantId: auth.scope.tenantId,
    companyId: auth.scope.companyId,
    storeId: storeScope.storeId,
  });
  return NextResponse.json({ ok: true, items });
}

export async function POST(request: Request) {
  const auth = await requirePosSession("pos.quote.view");
  if (!auth.ok) return auth.response;

  const payload = (await request.json()) as { input?: PosQuoteDraftInput };
  if (!payload?.input || !Array.isArray(payload.input.lines) || payload.input.lines.length === 0) {
    return NextResponse.json({ ok: false, error: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const storeScope = resolvePosStoreScope(auth.pos, payload.input.store?.storeId, {
    requireStore: true,
  });
  if (!storeScope.ok) {
    return NextResponse.json({ ok: false, error: storeScope.error }, { status: 403 });
  }

  const item = await createPosQuote({
    tenantId: auth.scope.tenantId,
    companyId: auth.scope.companyId,
    input: {
      ...payload.input,
      store: {
        storeId: storeScope.storeId!,
        storeName: payload.input.store?.storeName || auth.pos.defaultStoreName,
      },
      cashier: {
        cashierId: auth.pos.cashierId,
        cashierName: auth.pos.cashierName,
      },
    },
  });
  return NextResponse.json({ ok: true, item });
}
