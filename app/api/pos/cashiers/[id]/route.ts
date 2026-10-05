import { NextRequest, NextResponse } from "next/server";
import { ensurePosStoreAccess, requirePosSession } from "@/lib/pos/server/pos-route";
import { getPosCashierDetail, updatePosCashier } from "@/lib/pos/server/pos-cashiers.server";
import { tryRecordPosAuditLog } from "@/lib/pos/server/pos-audit.server";
import { type PosPermissionOverrideItem } from "@/lib/pos/types";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePosSession(["pos.cashiers.view", "pos.cashier.manage"], {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;
  const params = await context.params;
  try {
    const item = await getPosCashierDetail({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      id: params.id,
    });
    const scopeCheck = ensurePosStoreAccess(auth.pos, item.storeId);
    if (!scopeCheck.ok) return scopeCheck.response;
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "POS_CASHIER_NOT_FOUND";
    return NextResponse.json({ ok: false, error: message }, { status: message === "POS_CASHIER_NOT_FOUND" ? 404 : 400 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requirePosSession("pos.cashier.manage", {
    allowedRoles: ["admin_general", "store_admin"],
  });
  if (!auth.ok) return auth.response;
  const params = await context.params;

  try {
    const existing = await getPosCashierDetail({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      id: params.id,
    });
    const existingScope = ensurePosStoreAccess(auth.pos, existing.storeId);
    if (!existingScope.ok) return existingScope.response;

    const payload = await request.json().catch(() => ({}));
    const targetStoreId = auth.pos.allowAllStores ? String(payload?.storeId || existing.storeId) : auth.pos.defaultStoreId;
    const targetScope = ensurePosStoreAccess(auth.pos, targetStoreId);
    if (!targetScope.ok) return targetScope.response;

    const item = await updatePosCashier({
      tenantId: auth.scope.tenantId,
      companyId: auth.scope.companyId,
      actorRole: auth.pos.role,
      id: params.id,
      forcedStoreId: auth.pos.allowAllStores ? undefined : auth.pos.defaultStoreId,
      input: {
        account: String(payload?.account || existing.account),
        name: String(payload?.name || existing.name),
        phone: String(payload?.phone || existing.phone),
        phoneCountry: String(payload?.phoneCountry || existing.phoneCountry || "MX"),
        email: String(payload?.email || existing.email || ""),
        password: String(payload?.password || ""),
        storeId: targetStoreId,
        role: payload?.role || existing.role,
        active: payload?.active !== false,
        permissionOverrides: Array.isArray(payload?.permissionOverrides)
          ? payload.permissionOverrides.map((entry: any) => ({
              permissionKey: String(entry?.permissionKey || ""),
              effect: entry?.effect === "deny" ? "deny" : "grant",
            }))
          : existing.permissions
            ? [
                ...existing.permissions.grants.map((permissionKey) => ({ permissionKey, effect: "grant" as const })),
                ...existing.permissions.denies.map((permissionKey) => ({ permissionKey, effect: "deny" as const })),
              ]
            : [],
      },
    });

    const nextRole = payload?.role || existing.role;
    const nextOverrides: PosPermissionOverrideItem[] = Array.isArray(payload?.permissionOverrides)
      ? payload.permissionOverrides.map((entry: unknown) => {
          const item = entry as { permissionKey?: string; effect?: string };
          return {
            permissionKey: String(item?.permissionKey || ""),
            effect: item?.effect === "deny" ? "deny" : "grant",
          };
        })
      : [
          ...existing.permissions.grants.map((permissionKey) => ({ permissionKey, effect: "grant" as const })),
          ...existing.permissions.denies.map((permissionKey) => ({ permissionKey, effect: "deny" as const })),
        ];
    const previousOverrides = [
      ...existing.permissions.grants.map((permissionKey) => `${permissionKey}:grant`),
      ...existing.permissions.denies.map((permissionKey) => `${permissionKey}:deny`),
    ].sort();
    const updatedOverrides = nextOverrides
      .map((entry: any) => `${String(entry?.permissionKey || "")}:${entry?.effect === "deny" ? "deny" : "grant"}`)
      .filter(Boolean)
      .sort();

    if (existing.role !== nextRole) {
      await tryRecordPosAuditLog({
        tenantId: auth.scope.tenantId,
        companyId: auth.scope.companyId,
        input: {
          actionType: "cashier_role_updated",
          module: "cashiers",
          actorUserId: auth.session.userId,
          actorName: auth.session.name || auth.session.userId,
          actorRole: auth.pos.role,
          storeId: item.storeId,
          targetType: "cashier",
          targetId: item.id,
          targetFolio: item.account,
          summary: `Updated cashier role: ${item.name}`,
          detailsJson: {
            beforeRole: existing.role,
            afterRole: nextRole,
          },
          resultStatus: "success",
        },
      });
    }

    if (JSON.stringify(previousOverrides) !== JSON.stringify(updatedOverrides)) {
      await tryRecordPosAuditLog({
        tenantId: auth.scope.tenantId,
        companyId: auth.scope.companyId,
        input: {
          actionType: "cashier_permission_updated",
          module: "cashiers",
          actorUserId: auth.session.userId,
          actorName: auth.session.name || auth.session.userId,
          actorRole: auth.pos.role,
          storeId: item.storeId,
          targetType: "cashier",
          targetId: item.id,
          targetFolio: item.account,
          summary: `Updated cashier permissions: ${item.name}`,
          detailsJson: {
            before: previousOverrides,
            after: updatedOverrides,
          },
          resultStatus: "success",
        },
      });
    }

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "POS_CASHIER_SAVE_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
