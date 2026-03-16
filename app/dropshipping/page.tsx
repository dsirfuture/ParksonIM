import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getExchangeRatePayload, getFinanceRows, getInventoryRows, getOverview, listOrders } from "@/lib/dropshipping";
import { hasPermission } from "@/lib/permissions";
import { getLang } from "@/lib/i18n-server";
import { getSession } from "@/lib/tenant";
import { DropshippingClient } from "./DropshippingClient";

export default async function DropshippingPage() {
  const session = await getSession();
  const lang = await getLang();

  if (!session) redirect("/login");
  if (!(await hasPermission(session, "viewReports"))) redirect("/dashboard");

  const [overview, orders, inventory, finance, exchangeRate] = await Promise.all([
    getOverview(session),
    listOrders(session),
    getInventoryRows(session),
    getFinanceRows(session),
    getExchangeRatePayload(session),
  ]);

  return (
    <AppShell>
      <DropshippingClient
        initialLang={lang}
        initialOverview={overview}
        initialOrders={orders}
        initialInventory={inventory}
        initialFinance={finance}
        initialExchangeRate={exchangeRate}
      />
    </AppShell>
  );
}
