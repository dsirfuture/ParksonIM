import { hashPassword } from "@/lib/auth";
import { sanitizeAvatarUrl } from "@/lib/avatar-storage";
import { prisma } from "@/lib/prisma";
import { POS_CONFIGURABLE_PERMISSION_KEYS, getDefaultPosActionPermissionKeysByRole } from "@/lib/permissions";
import { normalizePhone, normalizePhoneCountry, isValidDisplayName, isValidEmail, isValidPhone } from "@/lib/user-account";
import { createPosCashierUser, findPosCashierDuplicate, getPosCashierUserById, listPosCashierPermissionOverrides, listPosCashierUsers, replacePosCashierPermissionOverrides, updatePosCashierUser, updatePosCashierUserStatus } from "@/lib/pos/repositories/pos-cashiers.repository";
import { type PosCashierDetail, type PosCashierItem, type PosCashierQuery, type PosCashierRole, type PosCashierUpsertInput, type PosPermissionOverrideItem } from "@/lib/pos/types";
import { type PosUserRole } from "@/lib/pos/access";

function cleanText(value: string | null | undefined) {
  return value?.trim() || "";
}

function mapCashierRow(row: {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  phone_country: string | null;
  email: string | null;
  avatar_url: string | null;
  pos_store_id: string | null;
  pos_role: PosUserRole;
  active: boolean;
  updated_at: Date;
}): PosCashierItem {
  return {
    id: row.id,
    account: row.user_id,
    name: row.name,
    phone: row.phone,
    phoneCountry: cleanText(row.phone_country) || "MX",
    email: cleanText(row.email),
    avatarUrl: sanitizeAvatarUrl(row.avatar_url),
    storeId: cleanText(row.pos_store_id) || "default",
    role: row.pos_role as PosCashierRole,
    active: row.active,
    updatedAt: row.updated_at.toISOString(),
  };
}

function normalizePermissionOverrides(input: PosPermissionOverrideItem[] | undefined) {
  const result = new Map<string, "grant" | "deny">();
  for (const item of input || []) {
    const permissionKey = item?.permissionKey?.trim();
    if (!permissionKey || !POS_CONFIGURABLE_PERMISSION_KEYS.includes(permissionKey as any)) continue;
    if (item.effect !== "grant" && item.effect !== "deny") continue;
    result.set(permissionKey, item.effect);
  }
  return Array.from(result.entries()).map(([permissionKey, effect]) => ({ permissionKey, effect }));
}

async function buildCashierPermissionState(params: {
  tenantId: string;
  companyId: string;
  userId: string;
  role: PosCashierRole;
}) {
  const overrideRows = await listPosCashierPermissionOverrides({
    tenantId: params.tenantId,
    companyId: params.companyId,
    userId: params.userId,
  }) as Array<{ permission_key: string; effect: "grant" | "deny" }>;
  const roleDefaults = getDefaultPosActionPermissionKeysByRole(params.role as PosUserRole);
  const grants = overrideRows.filter((item) => item.effect === "grant").map((item) => item.permission_key);
  const denies = overrideRows.filter((item) => item.effect === "deny").map((item) => item.permission_key);
  const effective = Array.from(new Set([
    ...roleDefaults,
    ...grants,
  ])).filter((key) => !denies.includes(key));
  return {
    roleDefaults,
    grants,
    denies,
    effective,
  };
}

function normalizeUpsertInput(input: PosCashierUpsertInput, actorRole: PosUserRole, existingId?: string) {
  const account = cleanText(input.account);
  const name = cleanText(input.name);
  const phoneCountry = normalizePhoneCountry(input.phoneCountry);
  const phone = normalizePhone(input.phone, phoneCountry);
  const email = cleanText(input.email);
  const storeId = cleanText(input.storeId) || "default";
  const role = (input.role || "cashier") as PosCashierRole;
  const password = cleanText(input.password);

  if (!account || account.length < 2) throw new Error("POS_CASHIER_ACCOUNT_REQUIRED");
  if (!isValidDisplayName(name)) throw new Error("POS_CASHIER_NAME_INVALID");
  if (!isValidPhone(input.phone, phoneCountry)) throw new Error("POS_CASHIER_PHONE_INVALID");
  if (!isValidEmail(email)) throw new Error("POS_CASHIER_EMAIL_INVALID");
  if (!storeId) throw new Error("POS_CASHIER_STORE_REQUIRED");
  if (!existingId && password.length < 6) throw new Error("POS_CASHIER_PASSWORD_INVALID");
  if (existingId && password && password.length < 6) throw new Error("POS_CASHIER_PASSWORD_INVALID");

  if (actorRole === "store_admin" && role !== "cashier") {
    throw new Error("POS_ROLE_NOT_ALLOWED");
  }

  return {
    account,
    name,
    phone,
    phoneCountry,
    email,
    storeId,
    role,
    active: input.active !== false,
    passwordHash: password ? hashPassword(password) : undefined,
  };
}

export async function listPosCashiers(params: {
  tenantId: string;
  companyId: string;
  query?: PosCashierQuery;
  scopeStoreId?: string;
}) {
  const rows = await listPosCashierUsers({
    tenantId: params.tenantId,
    companyId: params.companyId,
    storeId: params.scopeStoreId || params.query?.storeId,
    keyword: params.query?.keyword,
    role: params.query?.role,
    status: params.query?.status,
  });
  return rows.map(mapCashierRow);
}

export async function getPosCashierDetail(params: { tenantId: string; companyId: string; id: string }) {
  const row = await getPosCashierUserById(params);
  if (!row) throw new Error("POS_CASHIER_NOT_FOUND");
  const base = mapCashierRow(row as any) as PosCashierDetail;
  const permissions = await buildCashierPermissionState({
    tenantId: params.tenantId,
    companyId: params.companyId,
    userId: row.id,
    role: base.role,
  });
  return {
    ...base,
    permissions,
  };
}

export async function createPosCashier(params: {
  tenantId: string;
  companyId: string;
  actorRole: PosUserRole;
  input: PosCashierUpsertInput;
  forcedStoreId?: string;
}) {
  const normalized = normalizeUpsertInput({
    ...params.input,
    storeId: params.forcedStoreId || params.input.storeId,
    role: params.actorRole === "store_admin" ? "cashier" : params.input.role,
  }, params.actorRole);

  const duplicate = await findPosCashierDuplicate({
    tenantId: params.tenantId,
    companyId: params.companyId,
    account: normalized.account,
    phone: normalized.phone,
  });
  if (duplicate) throw new Error("POS_CASHIER_DUPLICATE");

  const row = await createPosCashierUser({
    tenantId: params.tenantId,
    companyId: params.companyId,
    input: {
      ...normalized,
      passwordHash: normalized.passwordHash || hashPassword("123456"),
      role: normalized.role as PosUserRole,
    },
  });
  const overrides = normalizePermissionOverrides(params.input.permissionOverrides);
  if (overrides.length) {
    await replacePosCashierPermissionOverrides({
      tenantId: params.tenantId,
      companyId: params.companyId,
      userId: row.id,
      createdBy: normalized.account,
      overrides: overrides.map((item) => ({
        permissionKey: item.permissionKey,
        effect: item.effect,
      })),
    });
  }
  return mapCashierRow(row as any);
}

export async function updatePosCashier(params: {
  tenantId: string;
  companyId: string;
  actorRole: PosUserRole;
  id: string;
  input: PosCashierUpsertInput;
  forcedStoreId?: string;
}) {
  const normalized = normalizeUpsertInput({
    ...params.input,
    storeId: params.forcedStoreId || params.input.storeId,
    role: params.actorRole === "store_admin" ? "cashier" : params.input.role,
  }, params.actorRole, params.id);

  const duplicate = await findPosCashierDuplicate({
    tenantId: params.tenantId,
    companyId: params.companyId,
    account: normalized.account,
    phone: normalized.phone,
    excludeId: params.id,
  });
  if (duplicate) throw new Error("POS_CASHIER_DUPLICATE");

  const overrides = normalizePermissionOverrides(params.input.permissionOverrides);
  const row = await prisma.$transaction(async (tx) => {
    const updated = await updatePosCashierUser({
      tenantId: params.tenantId,
      companyId: params.companyId,
      id: params.id,
      input: {
        ...normalized,
        role: normalized.role as PosUserRole,
      },
    }, tx);
    await replacePosCashierPermissionOverrides({
      tenantId: params.tenantId,
      companyId: params.companyId,
      userId: params.id,
      createdBy: normalized.account,
      overrides: overrides.map((item) => ({
        permissionKey: item.permissionKey,
        effect: item.effect,
      })),
    }, tx);
    return updated;
  });
  return mapCashierRow(row as any);
}

export async function updatePosCashierStatusRecord(params: {
  tenantId: string;
  companyId: string;
  id: string;
  active: boolean;
}) {
  const row = await updatePosCashierUserStatus(params);
  return mapCashierRow(row as any);
}
