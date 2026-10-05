import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { getLang } from "@/lib/i18n-server";
import { getExchangeRatePayload, getOverview } from "@/lib/dropshipping";
import { getResolvedLandingPath, hasAppPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";
import { DropshippingClient } from "@/app/dropshipping/DropshippingClient";

export default async function CustomerSlugEntryPage({
  params,
}: {
  params: Promise<{ customerSlug: string }>;
}) {
  const { customerSlug } = await params;
  const slug = String(customerSlug || "").trim().toLowerCase();

  if (!slug) {
    notFound();
  }

  const customer = await prisma.dropshippingCustomer.findFirst({
    where: {
      default_slug: slug,
    },
    select: {
      id: true,
    },
  });

  if (!customer) {
    notFound();
  }

  const session = await getSession();
  if (!session) {
    redirect(`/login?next=%2F${encodeURIComponent(slug)}`);
  }

  const targetPath = await getResolvedLandingPath(session);
  if (
    session.dropshippingCustomerId &&
    session.dropshippingCustomerId !== customer.id
  ) {
    redirect(targetPath);
  }

  if (!(await hasAppPermission(session, "dropshipping.view"))) {
    redirect(targetPath);
  }

  const lang = await getLang();

  try {
    const [overview, exchangeRate] = await Promise.all([
      getOverview(session),
      getExchangeRatePayload(session),
    ]);

    return (
      <AppShell>
        <DropshippingClient
          initialLang={lang}
          initialActiveTab="quick_setup"
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
    console.error("[CustomerSlugEntryPage] failed to load customer landing:", error);
    return (
      <AppShell>
        <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-soft">
          <h1 className="text-xl font-bold text-slate-900">
            {lang === "zh" ? "客户访问入口" : "Portal del cliente"}
          </h1>
          <p className="mt-2 text-sm text-rose-600">
            {lang === "zh"
              ? "页面数据加载失败，请稍后刷新；如果持续失败，请检查服务端日志。"
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
