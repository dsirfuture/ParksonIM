import Image from "next/image";
import Link from "next/link";
import { getLang } from "@/lib/i18n-server";
import { LanguageSwitch } from "@/components/language-switch";
import { getSession } from "@/lib/tenant";
import { getPermissionState } from "@/lib/permissions";
import { AvatarMenu } from "@/components/avatar-menu";

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
  let perms: Awaited<ReturnType<typeof getPermissionState>> | null = null;
  if (session) {
    try {
      perms = await getPermissionState(session);
    } catch (error) {
      console.error("[AppShell] failed to load permissions:", error);
      perms = null;
    }
  }

  const navItems = [
    {
      href: "/dashboard",
      label: lang === "zh" ? "仪表盘" : "Dash",
      visible: Boolean(session),
    },
    {
      href: "/receipts",
      label: lang === "zh" ? "验货单" : "Rec",
      visible: Boolean(session) && Boolean(perms?.inspectGoods || perms?.importReceipts),
    },
    {
      href: "/yg-orders",
      label: lang === "zh" ? "友购订单" : "YG",
      visible: Boolean(session) && Boolean(perms?.viewAllData || perms?.manageSuppliers),
    },
    {
      href: "/products-management",
      label: lang === "zh" ? "产品管理" : "Prod",
      visible: Boolean(session) && Boolean(perms?.manageProducts),
    },
    {
      href: "/billing",
      label: lang === "zh" ? "账单" : "Bill",
      visible: Boolean(session) && Boolean(perms?.viewReports),
    },
    {
      href: "/dropshipping",
      label: lang === "zh" ? "一件代发" : "Drops",
      visible: Boolean(session) && Boolean(perms?.viewReports),
    },
  ];

  return (
    <main className="flex min-h-screen flex-col bg-background-light font-display text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1720px] items-center justify-between px-6 py-3">
          <Link href={session ? "/dashboard" : "/login"} className="flex min-w-0 items-center gap-3">
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
              <div className="mt-0.5 text-xs leading-4 text-slate-500">
                {subtitle ||
                  (lang === "zh"
                    ? "验货管理平台"
                    : "Plataforma de gestión de inspección")}
              </div>
            </div>
          </Link>

          <div className="hidden items-center gap-5 md:flex">
            <nav className="flex items-center gap-1">
              {navItems
                .filter((item) => item.visible !== false)
                .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  {item.label}
                </Link>
              ))}

              {!session ? (
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  {lang === "zh" ? "登录" : "Acceso"}
                </Link>
              ) : null}
            </nav>

            {session ? (
              <AvatarMenu
                avatarUrl={session.avatarUrl}
                name={session.name}
                isAdmin={session.role === "admin"}
                accountLabel={lang === "zh" ? "个人资料" : "Perf"}
                settingsLabel={lang === "zh" ? "设置" : "Cfg"}
                logoutLabel={lang === "zh" ? "退出" : "Out"}
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
