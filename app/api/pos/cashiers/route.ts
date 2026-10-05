import { NextRequest, NextResponse } from "next/server";
import { listPosCashiers, createPosCashier } from "@/lib/pos/server/pos-cashiers.server";
import { requirePosSession } from "@/lib/pos/server/pos-route";

export async function GET(request: NextRequest) {
  const auth = await requirePosSession(["pos.cashiers.view", "pos.cashier.manage"], {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const items = await listPosCashiers({
    tenantId: auth.scope.tenantId,
    companyId: auth.scope.companyId,
    scopeStoreId: auth.pos.allowAllStores ? undefined : auth.pos.defaultStoreId,
    query: {
      storeId: url.searchParams.get("storeId") || undefined,
      keyword: url.searchParams.get("keyword") || undefined,
      role: url.searchParams.get("role") || undefined,
      status: url.searchParams.get("status") || undefined,
    },
  });
  return NextResponse.json({ ok: true, items });
}

export async function POST(request: NextRequest) {
  const auth = await requirePosSession("pos.cashier.manage", {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;

  const payload = await request.json().catch(() => ({}));
  try {
    const item = await createPosCashier({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      actorRole: auth.pos.role,
      forcedStoreId: auth.pos.allowAllStores ? undefined : auth.pos.defaultStoreId,
      input: {
        account: String(payload?.account || ""),
        name: String(payload?.name || ""),
        phone: String(payload?.phone || ""),
        phoneCountry: String(payload?.phoneCountry || "MX"),
        email: String(payload?.email || ""),
        password: String(payload?.password || ""),
        storeId: String(payload?.storeId || ""),
        role: payload?.role || "cashier",
        active: payload?.active !== false,
        permissionOverrides: Array.isArray(payload?.permissionOverrides)
          ? payload.permissionOverrides.map((entry: any) => ({
              permissionKey: String(entry?.permissionKey || ""),
              effect: entry?.effect === "deny" ? "deny" : "grant",
            }))
          : [],
      },
    });
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "POS_CASHIER_SAVE_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
