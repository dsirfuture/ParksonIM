import type { Session } from "@/lib/tenant";

export type PosUserRole = "admin_general" | "store_admin" | "cashier";

export type PosAccessContext = {
  role: PosUserRole;
  defaultStoreId: string;
  defaultStoreName: string;
  allowAllStores: boolean;
  cashierId: string;
  cashierName: string;
};

export type PosStoreScopeResult =
  | {
      ok: true;
      storeId?: string;
    }
  | {
      ok: false;
      error: "POS_STORE_SCOPE_DENIED";
    };

function cleanStoreId(value: string | null | undefined) {
  return value?.trim() || "";
}

export function getPosUserRole(session: Session): PosUserRole {
  if (session.role === "admin") return "admin_general";
  if (session.posRole === "cashier") return "cashier";
  return "store_admin";
}

export function formatPosStoreName(storeId: string) {
  const normalized = cleanStoreId(storeId) || "default";
  if (normalized === "default") return "PARKSON POS";
  if (normalized === "store-demo-001") return "PARKSON STORE DEMO";
  return normalized;
}

export function getPosAccessContext(session: Session): PosAccessContext {
  const defaultStoreId = cleanStoreId(session.posStoreId) || "default";
  return {
    role: getPosUserRole(session),
    defaultStoreId,
    defaultStoreName: formatPosStoreName(defaultStoreId),
    allowAllStores: session.role === "admin",
    cashierId: session.userId,
    cashierName: session.name || session.userId,
  };
}

export function resolvePosStoreScope(
  access: PosAccessContext,
  requestedStoreId: string | null | undefined,
  options?: {
    requireStore?: boolean;
    allowAllStoresForAdmin?: boolean;
  },
): PosStoreScopeResult {
  const requireStore = Boolean(options?.requireStore);
  const allowAllStoresForAdmin = options?.allowAllStoresForAdmin !== false;
  const normalizedRequested = cleanStoreId(requestedStoreId);

  if (access.allowAllStores && allowAllStoresForAdmin) {
    if (normalizedRequested) return { ok: true, storeId: normalizedRequested };
    if (requireStore) return { ok: true, storeId: access.defaultStoreId };
    return { ok: true, storeId: undefined };
  }

  if (normalizedRequested && normalizedRequested !== access.defaultStoreId) {
    return { ok: false, error: "POS_STORE_SCOPE_DENIED" };
  }

  return { ok: true, storeId: access.defaultStoreId };
}

export function canAccessPosStore(access: PosAccessContext, storeId: string | null | undefined) {
  const normalizedStoreId = cleanStoreId(storeId);
  if (!normalizedStoreId) return access.allowAllStores;
  if (access.allowAllStores) return true;
  return normalizedStoreId === access.defaultStoreId;
}

export function isPosRoleAllowed(access: PosAccessContext, allowedRoles?: PosUserRole[]) {
  if (!allowedRoles?.length) return true;
  return allowedRoles.includes(access.role);
}

export function isPosCashier(access: PosAccessContext) {
  return access.role === "cashier";
}

export function hasPosActionPermission(
  permissionMap: Record<string, boolean> | null | undefined,
  permissionKey: string,
) {
  return Boolean(permissionMap?.[permissionKey]);
}

export function canPosRefund(access: PosAccessContext) {
  return access.role !== "cashier";
}

export function canPosManageInventory(access: PosAccessContext) {
  return access.role !== "cashier";
}

export function canPosImportInventory(access: PosAccessContext) {
  return access.role !== "cashier";
}

export function canPosTransfer(access: PosAccessContext) {
  return access.role !== "cashier";
}
