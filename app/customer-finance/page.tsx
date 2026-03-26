import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ADMIN_PERMISSIONS, WORKER_DEFAULT_PERMISSIONS, getPermissionState } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";
import { SettingsClient } from "@/app/settings/SettingsClient";

export default async function CustomerFinancePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  let permissions = session.role === "admin" ? ADMIN_PERMISSIONS : WORKER_DEFAULT_PERMISSIONS;
  try {
    permissions = await getPermissionState(session);
  } catch (error) {
    console.error("[CustomerFinancePage] failed to load permissions:", error);
  }

  return (
    <AppShell>
      <SettingsClient
        isAdmin={session.role === "admin"}
        currentPermissions={permissions}
        initialTab="customer"
        visibleTabs={["customer"]}
      />
    </AppShell>
  );
}
