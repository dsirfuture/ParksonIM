import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getLang } from "@/lib/i18n-server";
import { getResolvedLandingPath } from "@/lib/permissions";
import { getCustomerSettingsAccess } from "@/lib/customer-settings";
import { getSession } from "@/lib/tenant";
import { CustomerTeamManager } from "@/app/account/CustomerTeamManager";

export default async function CustomerSettingsPage() {
  const lang = await getLang();
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const access = await getCustomerSettingsAccess(session);
  if (!access.canView) {
    redirect(await getResolvedLandingPath(session));
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[1200px]">
        <CustomerTeamManager lang={lang} canManage={access.canManage} />
      </div>
    </AppShell>
  );
}
