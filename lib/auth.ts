import { getSession } from "@/lib/tenant";

/**
 * Minimal admin check for now.
 * Later we can connect to DB user roles.
 */
export async function isAdmin() {
  const session = await getSession();
  if (!session) return false;

  return session.role === "admin";
}
