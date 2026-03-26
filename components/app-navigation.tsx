"use client";

import Link from "next/link";
import { useState } from "react";
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
  const [hoveredGroupHref, setHoveredGroupHref] = useState<string | null>(null);

  const visibleGroups = groups.filter((group) => group.visible !== false);
  const activeGroup =
    visibleGroups.find((group) => group.match.some((item) => pathname.startsWith(item))) || null;
  const openGroupHref =
    hoveredGroupHref ||
    (activeGroup?.children && activeGroup.children.length > 0 ? activeGroup.href : null);

  return (
    <div className="hidden min-w-0 flex-1 items-start justify-end md:flex">
      <nav className="flex items-center gap-1">
        {visibleGroups.map((group) => {
          const active = activeGroup?.href === group.href;
          const showChildren =
            Boolean(group.children?.length) && openGroupHref === group.href;
          return (
            <div
              key={group.href}
              className="relative flex items-center justify-center"
              onMouseEnter={() => setHoveredGroupHref(group.href)}
              onMouseLeave={() => setHoveredGroupHref(null)}
            >
              <Link
                href={group.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-[#f7d8dc] text-primary shadow-sm ring-1 ring-[#efc8cd]"
                    : "text-slate-600 hover:bg-secondary-accent/70 hover:text-primary"
                }`}
                onFocus={() => setHoveredGroupHref(group.href)}
                onBlur={() => setHoveredGroupHref(null)}
              >
                {group.label}
              </Link>

              {showChildren ? (
                <nav className="absolute left-1/2 top-full z-20 mt-2 flex min-w-[136px] -translate-x-1/2 flex-col items-stretch gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-[0_10px_30px_rgba(15,23,42,0.12)]">
                  {group.children!.map((item) => {
                    const childActive = isChildActive(item.href, pathname, search);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`rounded-md px-3 py-1.5 text-center text-xs font-semibold transition ${
                          childActive
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
    </div>
  );
}
