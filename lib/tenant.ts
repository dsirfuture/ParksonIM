import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { readSignedSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { sanitizeAvatarUrl } from "@/lib/avatar-storage";

export type TenantContext = {
  tenantId: string;
  companyId: string;
};

export type Session = {
  userId: string;
  role: "admin" | "worker" | "customer";
  tenantId: string;
  companyId: string;
  name: string;
  phone: string;
  avatarUrl: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

function normalizeRole(value: string | undefined): Session["role"] {
  if (value === "worker" || value === "customer") return value;
  return "admin";
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
    tenant_id: string;
    company_id: string;
    name: string;
    phone: string;
    avatar_url: string | null;
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
          tenant_id: true,
          company_id: true,
          name: true,
          phone: true,
          avatar_url: true,
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

  return {
    userId: user.id,
    role: normalizeRole(user.role),
    tenantId: user.tenant_id,
    companyId: user.company_id,
    name: user.name,
    phone: user.phone,
    avatarUrl: sanitizeAvatarUrl(user.avatar_url),
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
    tenant_id: string;
    company_id: string;
    name: string;
    phone: string;
    avatar_url: string | null;
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
          tenant_id: true,
          company_id: true,
          name: true,
          phone: true,
          avatar_url: true,
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

  return {
    userId: user.id,
    role: normalizeRole(user.role),
    tenantId: user.tenant_id,
    companyId: user.company_id,
    name: user.name,
    phone: user.phone,
    avatarUrl: sanitizeAvatarUrl(user.avatar_url),
  };
}
