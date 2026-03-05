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
