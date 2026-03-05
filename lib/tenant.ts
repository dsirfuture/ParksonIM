export type TenantContext = {
  tenantId: string;
  companyId: string;
};

export function requireTenantFromSession(session: any): TenantContext {
  // Minimal placeholder: adjust to your real auth/session later
  if (!session?.tenantId || !session?.companyId) {
    throw new Error("TENANT_CONTEXT_MISSING");
  }
  return { tenantId: session.tenantId, companyId: session.companyId };
}
// lib/tenant.ts (append at end)
export type Session = {
  userId: string;
  role: "admin" | "worker" | "customer";
  tenantId: string;
  companyId: string;
};

// Minimal placeholder session getter.
// Later you can replace this with real auth (NextAuth/custom).
export async function getSession(): Promise<Session | null> {
  // For now: allow pages to compile and render.
  // If you want to block without login, return null by default.
  return {
    userId: "dev-user",
    role: "admin",
    tenantId: "dev-tenant",
    companyId: "dev-company",
  };
}
