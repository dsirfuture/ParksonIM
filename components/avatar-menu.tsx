"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type AvatarMenuProps = {
  avatarUrl?: string | null;
  name?: string | null;
  canOpenSettings: boolean;
  accountLabel: string;
  switchUserLabel: string;
  settingsLabel: string;
  logoutLabel: string;
  switchableAccounts: Array<{
    slot: number;
    name: string;
    phone: string;
    avatarUrl?: string | null;
    isCurrent: boolean;
  }>;
};

function getAvatarText(name: string | undefined, fallback = "A") {
  const value = String(name || "").trim();
  if (!value) return fallback;
  return value[0]?.toUpperCase() || fallback;
}

export function AvatarMenu({
  avatarUrl,
  name,
  canOpenSettings,
  accountLabel,
  switchUserLabel,
  settingsLabel,
  logoutLabel,
  switchableAccounts,
}: AvatarMenuProps) {
  const [open, setOpen] = useState(false);
  const [switchingSlot, setSwitchingSlot] = useState<number | null>(null);
  const [switchError, setSwitchError] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  async function handleSwitchAccount(slot: number) {
    try {
      setSwitchError("");
      setSwitchingSlot(slot);
      const response = await fetch("/api/auth/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setSwitchError(payload?.error || "切换失败");
        return;
      }
      window.location.href = payload.redirectTo || "/";
    } catch {
      setSwitchError("切换失败");
    } finally {
      setSwitchingSlot(null);
    }
  }

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

          {canOpenSettings ? (
            <Link
              href="/settings"
              className="flex h-11 items-center px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              {settingsLabel}
            </Link>
          ) : null}

          {switchableAccounts.length ? (
            <div className="border-t border-slate-100 px-2 py-2">
              <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {switchUserLabel}
              </div>
              <div className="space-y-1">
                {switchableAccounts.map((account) => (
                  <button
                    key={`${account.slot}-${account.phone}`}
                    type="button"
                    disabled={account.isCurrent || switchingSlot === account.slot}
                    onClick={() => void handleSwitchAccount(account.slot)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary-accent text-xs font-semibold text-primary">
                      {account.avatarUrl ? (
                        <img src={account.avatarUrl} alt={account.name} className="h-full w-full object-cover" />
                      ) : (
                        getAvatarText(account.name, "A")
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{account.name}</span>
                      <span className="block truncate text-xs text-slate-400">
                        {account.phone}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {switchError ? (
                <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-600">
                  {switchError}
                </div>
              ) : null}
            </div>
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
