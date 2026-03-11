import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { readSignedSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { withPrismaRetry } from "@/lib/prisma-retry";

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

  if (!signed) return null;

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

  if (!user) return null;

  return {
    userId: user.id,
    role: normalizeRole(user.role),
    tenantId: user.tenant_id,
    companyId: user.company_id,
    name: user.name,
    phone: user.phone,
    avatarUrl: user.avatar_url,
  };
}
