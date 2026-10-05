import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/tenant";
import { ADMIN_PERMISSIONS, WORKER_DEFAULT_PERMISSIONS, getAppPermissionMap, getPermissionState } from "@/lib/permissions";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  let permissions = session.role === "admin" ? ADMIN_PERMISSIONS : WORKER_DEFAULT_PERMISSIONS;
  let appPermissionMap: Awaited<ReturnType<typeof getAppPermissionMap>> | null = null;
  try {
    permissions = await getPermissionState(session);
    appPermissionMap = await getAppPermissionMap(session);
  } catch (error) {
    console.error("[SettingsPage] failed to load permissions:", error);
  }
  const params = (await searchParams) || {};
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const initialTab = rawTab === "perm" || rawTab === "supplier" || rawTab === "category" || rawTab === "doc"
    ? rawTab
    : undefined;

  return (
    <AppShell>
      <SettingsClient
        isAdmin={session.role === "admin"}
        currentUserId={session.userId}
        currentPermissions={permissions}
        initialTab={initialTab}
        visibleTabs={["perm", "supplier", "category", "doc"]}
        canManageAppPermissions={Boolean(appPermissionMap?.["admin.customer_permissions.manage"])}
        canViewInviteCodes={Boolean(appPermissionMap?.["admin.invite_codes.view"])}
        canManageInviteCodes={Boolean(appPermissionMap?.["admin.invite_codes.manage"])}
      />
    </AppShell>
  );
}
