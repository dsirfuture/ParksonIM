"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type NavChild = {
  href: string;
  label: string;
};

type NavGroup = {
  href: string;
  label: string;
  visible: boolean;
  match: string[];
  children?: NavChild[];
};

type AppNavigationProps = {
  groups: NavGroup[];
  loginLabel: string;
  loggedIn: boolean;
};

function isChildActive(href: string, pathname: string, search: URLSearchParams) {
  if (href === "/billing") {
    return pathname === "/billing";
  }
  return pathname === href;
}

export function AppNavigation({ groups, loginLabel, loggedIn }: AppNavigationProps) {
  const pathname = usePathname();
  const search = useSearchParams();

  const visibleGroups = groups.filter((group) => group.visible !== false);
  const activeGroup =
    visibleGroups.find((group) => group.match.some((item) => pathname.startsWith(item))) || null;
  const secondaryItems = activeGroup?.children || [];

  return (
    <div className="hidden min-w-0 flex-1 flex-col items-end md:flex">
      <nav className="flex items-center gap-1">
        {visibleGroups.map((group) => {
          const active = activeGroup?.href === group.href;
          return (
            <Link
              key={group.href}
              href={group.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-[#f7d8dc] text-primary shadow-sm ring-1 ring-[#efc8cd]"
                  : "text-slate-600 hover:bg-secondary-accent/70 hover:text-primary"
              }`}
            >
              {group.label}
            </Link>
          );
        })}

        {!loggedIn ? (
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-secondary-accent/70 hover:text-primary"
          >
            {loginLabel}
          </Link>
        ) : null}
      </nav>

      {secondaryItems.length > 0 ? (
        <nav className="mt-1.5 flex min-w-[132px] flex-col items-stretch gap-1">
          {secondaryItems.map((item) => {
            const active = isChildActive(item.href, pathname, search);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-center text-xs font-semibold transition ${
                  active
                    ? "bg-[#f7d8dc] text-primary shadow-sm ring-1 ring-[#efc8cd]"
                    : "text-slate-500 hover:bg-secondary-accent/70 hover:text-primary"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
