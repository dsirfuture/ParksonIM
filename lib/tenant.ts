import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { readSignedRecentSessions, readSignedSession, SESSION_COOKIE_NAME, type SessionPayload, RECENT_SESSIONS_COOKIE_NAME } from "@/lib/auth";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { sanitizeAvatarUrl } from "@/lib/avatar-storage";

export type TenantContext = {
  tenantId: string;
  companyId: string;
};

export type Session = {
  userId: string;
  role: "admin" | "worker";
  customerOrgRole: "owner" | "manager" | "staff" | null;
  posRole: "admin_general" | "store_admin" | "cashier";
  posStoreId: string | null;
  tenantId: string;
  companyId: string;
  dropshippingCustomerId: string | null;
  name: string;
  phone: string;
  avatarUrl: string | null;
  userType: "staff" | "dropshipping_customer";
  defaultLandingPath: string | null;
};

export type RememberedAccount = {
  slot: number;
  userId: string;
  name: string;
  phone: string;
  avatarUrl: string | null;
  role: Session["role"];
  customerOrgRole: Session["customerOrgRole"];
  posRole: Session["posRole"];
  defaultLandingPath: string | null;
  isCurrent: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

function normalizeRole(value: string | undefined): Session["role"] {
  if (value === "worker") return value;
  return "admin";
}

function normalizeUserType(value: string | undefined): Session["userType"] {
  if (value === "dropshipping_customer") return value;
  return "staff";
}

function normalizeCustomerOrgRole(value: string | undefined): Session["customerOrgRole"] {
  if (value === "owner" || value === "manager" || value === "staff") return value;
  return null;
}

function normalizePosRole(value: string | undefined, role: Session["role"]): Session["posRole"] {
  if (role === "admin") return "admin_general";
  if (value === "cashier") return value;
  return "store_admin";
}

async function resolveDropshippingCustomerIdForUser(user: {
  tenant_id: string;
  company_id: string;
  user_type: string;
  dropshipping_customer_id: string | null;
  name: string;
}) {
  if (user.dropshipping_customer_id) return user.dropshipping_customer_id;
  if (normalizeUserType(user.user_type) !== "dropshipping_customer") return null;
  const matchedCustomer = await prisma.dropshippingCustomer.findFirst({
    where: {
      tenant_id: user.tenant_id,
      company_id: user.company_id,
      name: user.name,
    },
    select: {
      id: true,
    },
  });
  return matchedCustomer?.id || null;
}

function readDevContext(): TenantContext | null {
  if (process.env.NODE_ENV === "production") return null;

  const tenantId =
    process.env.DEV_TENANT_ID?.trim() || process.env.YOGO_SYNC_TENANT_ID?.trim();
  const companyId =
    process.env.DEV_COMPANY_ID?.trim() ||
    process.env.YOGO_SYNC_COMPANY_ID?.trim();

  if (!isUuid(tenantId) || !isUuid(companyId)) return null;

  return { tenantId, companyId };
}

async function findDevSession(context?: TenantContext | null): Promise<Session | null> {
  let user: {
    id: string;
    role: string;
    pos_role: string;
    pos_store_id: string | null;
    user_type: string;
    customer_org_role: string | null;
    tenant_id: string;
    company_id: string;
    dropshipping_customer_id: string | null;
    name: string;
    phone: string;
    avatar_url: string | null;
    default_landing_path: string | null;
  } | null = null;

  try {
    user = await withPrismaRetry(() =>
      prisma.user.findFirst({
        where: context
          ? {
              tenant_id: context.tenantId,
              company_id: context.companyId,
              active: true,
            }
          : {
              active: true,
            },
        orderBy: [{ role: "asc" }, { created_at: "asc" }],
        select: {
          id: true,
          role: true,
          pos_role: true,
          pos_store_id: true,
          user_type: true,
          customer_org_role: true,
          tenant_id: true,
          company_id: true,
          dropshipping_customer_id: true,
          name: true,
          phone: true,
          avatar_url: true,
          default_landing_path: true,
        },
      }),
    );
  } catch (error) {
    console.error("[getSession] dev session lookup failed:", error);
    return null;
  }

  if (!user && context) {
    return findDevSession(null);
  }

  if (!user) return null;

  const dropshippingCustomerId = await resolveDropshippingCustomerIdForUser(user);

  return {
    userId: user.id,
    role: normalizeRole(user.role),
    customerOrgRole: normalizeCustomerOrgRole(user.customer_org_role || undefined),
    posRole: normalizePosRole(user.pos_role, normalizeRole(user.role)),
    posStoreId: user.pos_store_id || null,
    tenantId: user.tenant_id,
    companyId: user.company_id,
    dropshippingCustomerId,
    name: user.name,
    phone: user.phone,
    avatarUrl: sanitizeAvatarUrl(user.avatar_url),
    userType: normalizeUserType(user.user_type),
    defaultLandingPath: user.default_landing_path || null,
  };
}

export function requireTenantFromSession(session: any): TenantContext {
  if (!session?.tenantId || !session?.companyId) {
    throw new Error("TENANT_CONTEXT_MISSING");
  }

  if (!isUuid(session.tenantId) || !isUuid(session.companyId)) {
    throw new Error("TENANT_CONTEXT_INVALID_UUID");
  }

  return {
    tenantId: session.tenantId,
    companyId: session.companyId,
  };
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const signed = readSignedSession(raw);

  if (!signed) {
    const devContext = readDevContext();
    return devContext ? findDevSession(devContext) : null;
  }

  let user: {
    id: string;
    role: string;
    pos_role: string;
    pos_store_id: string | null;
    user_type: string;
    customer_org_role: string | null;
    tenant_id: string;
    company_id: string;
    dropshipping_customer_id: string | null;
    name: string;
    phone: string;
    avatar_url: string | null;
    default_landing_path: string | null;
  } | null = null;

  try {
    user = await withPrismaRetry(() =>
      prisma.user.findFirst({
        where: {
          id: signed.userId,
          tenant_id: signed.tenantId,
          company_id: signed.companyId,
          active: true,
        },
        select: {
          id: true,
          role: true,
          pos_role: true,
          pos_store_id: true,
          user_type: true,
          customer_org_role: true,
          tenant_id: true,
          company_id: true,
          dropshipping_customer_id: true,
          name: true,
          phone: true,
          avatar_url: true,
          default_landing_path: true,
        },
      }),
    );
  } catch (error) {
    // Prevent transient DB disconnects from crashing the whole page.
    console.error("[getSession] database unavailable:", error);
    return null;
  }

  if (!user) {
    const devContext = readDevContext();
    return devContext ? findDevSession(devContext) : null;
  }

  const dropshippingCustomerId = await resolveDropshippingCustomerIdForUser(user);

  return {
    userId: user.id,
    role: normalizeRole(user.role),
    customerOrgRole: normalizeCustomerOrgRole(user.customer_org_role || undefined),
    posRole: normalizePosRole(user.pos_role, normalizeRole(user.role)),
    posStoreId: user.pos_store_id || null,
    tenantId: user.tenant_id,
    companyId: user.company_id,
    dropshippingCustomerId,
    name: user.name,
    phone: user.phone,
    avatarUrl: sanitizeAvatarUrl(user.avatar_url),
    userType: normalizeUserType(user.user_type),
    defaultLandingPath: user.default_landing_path || null,
  };
}

export async function getRememberedSessionPayloads(): Promise<SessionPayload[]> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(RECENT_SESSIONS_COOKIE_NAME)?.value;
  return readSignedRecentSessions(raw);
}

export async function getRememberedAccounts(
  currentSession?: Session | null,
): Promise<RememberedAccount[]> {
  const remembered = await getRememberedSessionPayloads();
  if (!remembered.length) return [];

  const users = await withPrismaRetry(() =>
    prisma.user.findMany({
      where: {
        active: true,
        OR: remembered.map((item) => ({
          id: item.userId,
          tenant_id: item.tenantId,
          company_id: item.companyId,
        })),
      },
      select: {
        id: true,
        role: true,
        pos_role: true,
        customer_org_role: true,
        name: true,
        phone: true,
        avatar_url: true,
        default_landing_path: true,
      },
    }),
  );

  const userMap = new Map(users.map((user) => [user.id, user]));
  return remembered
    .map((item, slot) => {
      const user = userMap.get(item.userId);
      if (!user) return null;
      const role = normalizeRole(user.role);
      return {
        slot,
        userId: user.id,
        name: user.name,
        phone: user.phone,
        avatarUrl: sanitizeAvatarUrl(user.avatar_url),
        role,
        customerOrgRole: normalizeCustomerOrgRole(user.customer_org_role || undefined),
        posRole: normalizePosRole(user.pos_role, role),
        defaultLandingPath: user.default_landing_path || item.defaultPath || null,
        isCurrent: currentSession?.userId === user.id,
      } satisfies RememberedAccount;
    })
    .filter((item): item is RememberedAccount => Boolean(item));
}
