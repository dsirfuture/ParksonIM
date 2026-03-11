import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/tenant";
import { ADMIN_PERMISSIONS, WORKER_DEFAULT_PERMISSIONS, getPermissionState } from "@/lib/permissions";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  let permissions = session.role === "admin" ? ADMIN_PERMISSIONS : WORKER_DEFAULT_PERMISSIONS;
  try {
    permissions = await getPermissionState(session);
  } catch (error) {
    console.error("[SettingsPage] failed to load permissions:", error);
  }

  return (
    <AppShell>
      <SettingsClient isAdmin={session.role === "admin"} currentPermissions={permissions} />
    </AppShell>
  );
}
