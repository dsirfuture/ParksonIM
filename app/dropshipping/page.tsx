import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getExchangeRatePayload, getOverview } from "@/lib/dropshipping";
import { getResolvedLandingPath, hasAppPermission } from "@/lib/permissions";
import { getLang } from "@/lib/i18n-server";
import { getSession } from "@/lib/tenant";
import { DropshippingClient } from "./DropshippingClient";

export default async function DropshippingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const lang = await getLang();

  if (!session) redirect("/login");
  if (!(await hasAppPermission(session, "dropshipping.view"))) {
    redirect(await getResolvedLandingPath(session));
  }

  const params = (await searchParams) || {};
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const allowedTabs = new Set(["overview", "orders", "inventory", "finance", "supplier_misc", "quick_setup"]);
  const initialActiveTab = allowedTabs.has(String(rawTab || "")) ? (String(rawTab) as "overview" | "orders" | "inventory" | "finance" | "supplier_misc" | "quick_setup") : undefined;

  try {
    const [overview, exchangeRate] = await Promise.all([
      getOverview(session),
      getExchangeRatePayload(session),
    ]);

    return (
      <AppShell>
        <DropshippingClient
          initialLang={lang}
          initialActiveTab={initialActiveTab}
          sessionUserType={session.userType}
          initialOverview={overview}
          initialOrders={[]}
          initialInventory={[]}
          initialFinance={[]}
          initialExchangeRate={exchangeRate}
          initialLoadedTabs={{
            overview: true,
            orders: false,
            inventory: false,
            finance: false,
            rate: true,
          }}
        />
      </AppShell>
    );
  } catch (error) {
    console.error("[DropshippingPage] failed to load page data:", error);
    return (
      <AppShell>
        <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-soft">
          <h1 className="text-xl font-bold text-slate-900">
            {lang === "zh" ? "一件代发管理" : "Dropshipping"}
          </h1>
          <p className="mt-2 text-sm text-rose-600">
            {lang === "zh"
              ? "页面数据加载失败，请稍后刷新；如果持续失败，请检查租户数据与服务端日志。"
              : "No se pudo cargar la pagina. Intenta de nuevo y revisa los logs del servidor si el problema continua."}
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
            {error instanceof Error ? error.message : "unknown_error"}
          </pre>
        </section>
      </AppShell>
    );
  }
}
