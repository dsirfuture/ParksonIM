"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type AvatarMenuProps = {
  avatarUrl?: string | null;
  name?: string | null;
  isAdmin: boolean;
  accountLabel: string;
  settingsLabel: string;
  logoutLabel: string;
};

function getAvatarText(name: string | undefined, fallback = "A") {
  const value = String(name || "").trim();
  if (!value) return fallback;
  return value[0]?.toUpperCase() || fallback;
}

export function AvatarMenu({
  avatarUrl,
  name,
  isAdmin,
  accountLabel,
  settingsLabel,
  logoutLabel,
}: AvatarMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-11 w-11 cursor-pointer list-none items-center justify-center overflow-hidden rounded-full bg-secondary-accent text-sm font-semibold text-primary outline-none transition hover:opacity-90"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name || "avatar"}
            className="h-full w-full object-cover"
          />
        ) : (
          getAvatarText(name || undefined, "A")
        )}
      </button>

      {open ? (
        <div className="absolute right-0 top-[52px] z-40 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
          <Link
            href="/account"
            className="flex h-11 items-center px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            {accountLabel}
          </Link>

          {isAdmin ? (
            <Link
              href="/settings"
              className="flex h-11 items-center px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              {settingsLabel}
            </Link>
          ) : null}

          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="flex h-11 w-full items-center px-4 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {logoutLabel}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
