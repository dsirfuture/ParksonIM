"use client";

import { useEffect, useMemo, useState } from "react";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

export function ShareActions(props: { lang: Lang; publicPath: string }) {
  const { lang, publicPath } = props;

  const [origin, setOrigin] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const fullUrl = useMemo(() => {
    if (!origin) return "";
    return `${origin}${publicPath}`;
  }, [origin, publicPath]);

  const waUrl = useMemo(() => {
    if (!fullUrl) return "https://wa.me/";
    return `https://wa.me/?text=${encodeURIComponent(fullUrl)}`;
  }, [fullUrl]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  };

  const fallbackCopy = (text: string) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand("copy");
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(ta);
    }
  };

  const copyLink = async (msg: string) => {
    if (!fullUrl) return;

    try {
      await navigator.clipboard.writeText(fullUrl);
      showToast(msg);
      return;
    } catch {
      // ignore
    }

    const ok = fallbackCopy(fullUrl);
    showToast(ok ? msg : t(lang, "public.master.copyFailed"));
  };

  return (
    <div className="relative flex flex-wrap items-center justify-center gap-3 pt-2">
      <button
        type="button"
        className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50"
        disabled={!fullUrl}
        onClick={() => copyLink(t(lang, "public.master.copied"))}
      >
        {t(lang, "public.master.copyLink")}
      </button>

      <a
        className={`px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 ${
          !fullUrl ? "pointer-events-none opacity-50" : ""
        }`}
        href={waUrl}
        target="_blank"
        rel="noreferrer"
      >
        {t(lang, "public.master.shareWhatsapp")}
      </a>

      <button
        type="button"
        className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50"
        disabled={!fullUrl}
        onClick={() => copyLink(t(lang, "public.master.wechatHint"))}
      >
        {t(lang, "public.master.shareWechat")}
      </button>

      {toast ? (
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs shadow">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
