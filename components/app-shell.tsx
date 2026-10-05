import Image from "next/image";
import Link from "next/link";
import { getLang } from "@/lib/i18n-server";
import { LanguageSwitch } from "@/components/language-switch";
import { getRememberedAccounts, getSession } from "@/lib/tenant";
import { getAppPermissionMap, getDefaultLandingPath } from "@/lib/permissions";
import { getCustomerSettingsAccess } from "@/lib/customer-settings";
import { AvatarMenu } from "@/components/avatar-menu";
import { AppNavigation } from "@/components/app-navigation";

type AppShellProps = {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
};

export async function AppShell({
  title = "ParksonIM",
  subtitle,
  children,
}: AppShellProps) {
  const lang = await getLang();
  const session = await getSession();
  let appPerms: Awaited<ReturnType<typeof getAppPermissionMap>> | null = null;
  let customerSettingsAccess: Awaited<ReturnType<typeof getCustomerSettingsAccess>> = {
    canView: false,
    canManage: false,
  };
  let rememberedAccounts: Awaited<ReturnType<typeof getRememberedAccounts>> = [];
  if (session) {
    try {
      appPerms = await getAppPermissionMap(session);
      customerSettingsAccess = await getCustomerSettingsAccess(session);
      rememberedAccounts = await getRememberedAccounts(session);
    } catch (error) {
      console.error("[AppShell] failed to load permissions:", error);
      appPerms = null;
      customerSettingsAccess = { canView: false, canManage: false };
      rememberedAccounts = [];
    }
  }
  const canOpenSettings =
    Boolean(session) &&
    Boolean(
      appPerms?.["settings.view"] ||
        appPerms?.["settings.manage"] ||
        session?.role === "admin",
    );
  const isDropshippingCustomer = Boolean(session?.dropshippingCustomerId);

  const navGroups = [
    {
      href: "/dashboard",
      label: lang === "zh" ? "仪表盘" : "Dash",
      visible: Boolean(session) && Boolean(appPerms?.["dashboard.view"]),
      match: ["/dashboard"],
    },
    {
      href: "/yg-orders",
      label: lang === "zh" ? "友购数据" : "Yogo",
      visible:
        Boolean(session) &&
        Boolean(appPerms?.["yg_data.view"] || appPerms?.["products.view"]),
      match: ["/yg-orders", "/yg-customers", "/products-management"],
      children: [
        {
          href: "/products-management",
          label: lang === "zh" ? "友购产品" : "YG Prod",
          visible: Boolean(appPerms?.["products.view"]),
        },
        {
          href: "/yg-orders",
          label: lang === "zh" ? "友购订单" : "YG Ord",
          visible: Boolean(appPerms?.["yg_data.orders.view"]),
        },
        {
          href: "/yg-customers",
          label: lang === "zh" ? "友购客户" : "YG Cust",
          visible: Boolean(appPerms?.["yg_data.customers.view"]),
        },
      ].filter((item: any) => item.visible !== false),
    },
    {
      href: "/receipts",
      label: lang === "zh" ? "验货单" : "Rec",
      visible: Boolean(session) && Boolean(appPerms?.["inspection.view"]),
      match: ["/receipts"],
    },
    {
      href: "/billing",
      label: lang === "zh" ? "账单" : "Bill",
      visible: Boolean(session) && Boolean(appPerms?.["billing.view"]),
      match: ["/billing", "/customer-finance"],
      children: [
        {
          href: "/billing",
          label: lang === "zh" ? "出账单" : "Billing",
          visible: Boolean(appPerms?.["billing.view"]),
        },
        {
          href: "/customer-finance",
          label: lang === "zh" ? "客户财务" : "Cust Fin",
          visible: Boolean(appPerms?.["billing.view"]),
        },
      ].filter((item: any) => item.visible !== false),
    },
    {
      href: "/dropshipping",
      label: lang === "zh" ? "一件代发" : "Drops",
      visible: Boolean(session) && Boolean(appPerms?.["dropshipping.view"]) && !isDropshippingCustomer,
      match: ["/dropshipping"],
    },
    {
      href: "/dropshipping?tab=overview",
      label: lang === "zh" ? "总览" : "Resumen",
      visible: Boolean(session) && isDropshippingCustomer && Boolean(appPerms?.["dropshipping.overview.view"]),
      match: ["/dropshipping"],
    },
    {
      href: "/dropshipping?tab=orders",
      label: lang === "zh" ? "订单管理" : "Pedidos",
      visible: Boolean(session) && isDropshippingCustomer && Boolean(appPerms?.["dropshipping.orders.view"]),
      match: ["/dropshipping"],
    },
    {
      href: "/dropshipping?tab=inventory",
      label: lang === "zh" ? "备货和发货" : "Stock y envio",
      visible: Boolean(session) && isDropshippingCustomer && Boolean(appPerms?.["dropshipping.inventory.view"]),
      match: ["/dropshipping"],
    },
    {
      href: "/dropshipping?tab=finance",
      label: lang === "zh" ? "财务结算" : "Pagos",
      visible: Boolean(session) && isDropshippingCustomer && Boolean(appPerms?.["dropshipping.finance.view"]),
      match: ["/dropshipping"],
    },
    {
      href: "/dropshipping?tab=quick_setup",
      label: lang === "zh" ? "代发快捷设置" : "Config",
      visible: Boolean(session) && isDropshippingCustomer && Boolean(appPerms?.["dropshipping.quick_setup.view"]),
      match: ["/dropshipping"],
    },
    {
      href: "/customer-settings",
      label: lang === "zh" ? "设置" : "Ajustes",
      visible: Boolean(session) && Boolean(customerSettingsAccess.canView),
      match: ["/customer-settings"],
    },
    {
      href: "/pos",
      label: lang === "zh" ? "百盛POS" : "PARKSON POS",
      visible: Boolean(session) && Boolean(appPerms?.["pos.view"]),
      match: ["/pos"],
    },
  ];

  return (
    <main className="flex min-h-screen flex-col bg-background-light font-display text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1720px] items-center justify-between px-6 py-3">
          <Link href={session ? getDefaultLandingPath(session) : "/login"} className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white">
              <Image
                src="/BSLOGO.png"
                alt="Parkson Logo"
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
                priority
              />
            </div>

            <div className="min-w-0">
              <div className="text-[15px] font-semibold leading-5 tracking-tight text-slate-900">
                {title}
              </div>
              {subtitle ? (
                <div className="mt-0.5 text-xs leading-4 text-slate-500">
                  {subtitle}
                </div>
              ) : null}
            </div>
          </Link>

          <div className="hidden items-start gap-5 md:flex">
            <AppNavigation
              groups={navGroups}
              loginLabel={lang === "zh" ? "登录" : "Acceso"}
              loggedIn={Boolean(session)}
            />
            {session ? (
              <AvatarMenu
                avatarUrl={session.avatarUrl}
                name={session.name}
                canOpenSettings={canOpenSettings}
                accountLabel={lang === "zh" ? "个人资料" : "Perf"}
                switchUserLabel={lang === "zh" ? "切换用户" : "Cambiar"}
                settingsLabel={lang === "zh" ? "设置" : "Cfg"}
                logoutLabel={lang === "zh" ? "退出" : "Out"}
                switchableAccounts={rememberedAccounts.map((item) => ({
                  slot: item.slot,
                  name: item.name,
                  phone: item.phone,
                  avatarUrl: item.avatarUrl,
                  isCurrent: item.isCurrent,
                }))}
              />
            ) : (
              <Link
                href="/login"
                className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-secondary-accent text-sm font-semibold text-primary"
              >
                A
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1720px] flex-1 flex-col px-6 py-4">
        {children}
      </div>

      <footer className="mt-auto border-t border-slate-200 bg-white">
        <div className="mx-auto flex h-[36px] w-full max-w-[1720px] items-center justify-between px-6">
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="leading-none">© 2026 BS DU S.A. DE C.V.</span>
            <span className="leading-none">
              {lang === "zh"
                ? "连接共享 分销整合"
                : "Conexión compartida e integración de distribución"}
            </span>
          </div>

          <LanguageSwitch lang={lang} />
        </div>
      </footer>
    </main>
  );
}
