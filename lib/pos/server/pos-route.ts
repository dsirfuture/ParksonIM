import { NextResponse } from "next/server";
import { getSession, requireTenantFromSession, type Session } from "@/lib/tenant";
import { hasAppPermission, type AppPermissionKey } from "@/lib/permissions";
import { canAccessPosStore, getPosAccessContext, isPosRoleAllowed, resolvePosStoreScope, type PosAccessContext, type PosUserRole } from "@/lib/pos/access";
import { tryRecordPosAuditLog } from "@/lib/pos/server/pos-audit.server";

function inferModuleFromPermission(permission: AppPermissionKey | AppPermissionKey[]) {
  const first = Array.isArray(permission) ? permission[0] : permission;
  return first?.split(".")[0] || "pos";
}

export async function requirePosSession(
  permission: AppPermissionKey | AppPermissionKey[],
  options?: { allowedRoles?: PosUserRole[] },
) {
  const session = await getSession();
  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 }),
    };
  }

  const required = Array.isArray(permission) ? permission : [permission];
  const allowed = await Promise.all(required.map((item) => hasAppPermission(session, item)));
  if (!allowed.some(Boolean)) {
    void tryRecordPosAuditLog({
      tenantId: session.tenantId,
      companyId: session.companyId,
      input: {
        actionType: "access_denied",
        module: inferModuleFromPermission(permission),
        actorUserId: session.userId,
        actorName: session.name || session.userId,
        actorRole: String(session.posRole || session.role || "store_admin"),
        storeId: session.posStoreId || null,
        summary: `权限拒绝：${required.join(", ")}`,
        detailsJson: {
          attemptedAction: required.join(", "),
          reason: "POS_PERMISSION_DENIED",
        },
        resultStatus: "denied",
      },
    });
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "POS_PERMISSION_DENIED" }, { status: 403 }),
    };
  }

  const pos = getPosAccessContext(session);
  if (!isPosRoleAllowed(pos, options?.allowedRoles)) {
    void tryRecordPosAuditLog({
      tenantId: session.tenantId,
      companyId: session.companyId,
      input: {
        actionType: "access_denied",
        module: inferModuleFromPermission(permission),
        actorUserId: session.userId,
        actorName: session.name || session.userId,
        actorRole: pos.role,
        storeId: pos.defaultStoreId || null,
        summary: `角色拒绝：${required.join(", ")}`,
        detailsJson: {
          attemptedAction: required.join(", "),
          reason: "POS_ROLE_NOT_ALLOWED",
          allowedRoles: options?.allowedRoles || [],
        },
        resultStatus: "denied",
      },
    });
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: "POS_ROLE_NOT_ALLOWED" }, { status: 403 }),
    };
  }

  return {
    ok: true as const,
    session,
    scope: requireTenantFromSession(session),
    pos,
  };
}

export function readPosStoreId(session: Session, url: string) {
  const requestUrl = new URL(url);
  const access = getPosAccessContext(session);
  const result = resolvePosStoreScope(access, requestUrl.searchParams.get("storeId"), {
    allowAllStoresForAdmin: true,
    requireStore: false,
  });
  return result.ok ? result.storeId : access.defaultStoreId;
}

export function resolvePosStoreFromRequest(
  pos: PosAccessContext,
  url: string,
  options?: {
    requireStore?: boolean;
    allowAllStoresForAdmin?: boolean;
  },
) {
  const requestUrl = new URL(url);
  const result = resolvePosStoreScope(pos, requestUrl.searchParams.get("storeId"), options);
  if (!result.ok) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: result.error }, { status: 403 }),
    };
  }
  return {
    ok: true as const,
    storeId: result.storeId,
  };
}

export function ensurePosStoreAccess(pos: PosAccessContext, storeId: string | null | undefined) {
  if (canAccessPosStore(pos, storeId)) {
    return { ok: true as const };
  }
  return {
    ok: false as const,
    response: NextResponse.json({ ok: false, error: "POS_STORE_SCOPE_DENIED" }, { status: 403 }),
  };
}
