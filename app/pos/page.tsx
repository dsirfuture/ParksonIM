import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getLang } from "@/lib/i18n-server";
import { getAppPermissionMap, getResolvedLandingPath, hasAppPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";
import { getPosAccessContext } from "@/lib/pos/access";
import { listPosStores } from "@/lib/pos/server/pos-stores.server";
import { PosModule, type PosTabId } from "./PosModule";

const TAB_IDS = new Set([
  "workbench",
  "cashier",
  "suspended",
  "quote",
  "sales_docs",
  "returns_void",
  "products_prices",
  "store_inventory",
  "inventory_movement",
  "inventory_import",
  "transfers",
  "finance_stats",
  "inventory_stats",
  "replenishment",
  "audit_logs",
  "cashiers",
  "store_settings",
  "receipt_template",
  "system_settings",
]);

export default async function PosPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const lang = await getLang();

  if (!session) redirect("/login");
  if (!(await hasAppPermission(session, "pos.view"))) {
    redirect(await getResolvedLandingPath(session));
  }

  const appPermissionMap = await getAppPermissionMap(session);
  const posAccess = getPosAccessContext(session);
  const stores = await listPosStores({
    tenantId: session.tenantId,
    companyId: session.companyId,
  });
  const storeOptions = stores.map((store) => ({
    id: store.storeId,
    name: store.storeName,
  }));
  const params = (await searchParams) || {};
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const activeTab: PosTabId = rawTab && TAB_IDS.has(rawTab) ? (rawTab as PosTabId) : "workbench";

  return (
    <AppShell>
      <PosModule
        lang={lang}
        initialActiveTab={activeTab}
        permissionMap={appPermissionMap}
        posAccess={posAccess}
        storeOptions={storeOptions}
      />
    </AppShell>
  );
}
