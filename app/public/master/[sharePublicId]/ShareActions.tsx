"use client";

import { useEffect, useMemo, useState } from "react";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

export function ShareActions(props: { lang: Lang; publicPath: string }) {
  const { lang, publicPath } = props;
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const fullUrl = useMemo(() => {
    return origin ? `${origin}${publicPath}` : publicPath;
  }, [origin, publicPath]);

  const copy = async (msg: string) => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      alert(msg);
    } catch {
      alert(t(lang, "public.master.copyFailed"));
    }
  };

  const waUrl = useMemo(() => {
    return `https://wa.me/?text=${encodeURIComponent(fullUrl)}`;
  }, [fullUrl]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
      <button
        type="button"
        className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50"
        onClick={() => copy(t(lang, "public.master.copied"))}
      >
        {t(lang, "public.master.copyLink")}
      </button>

      <a
        className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50"
        href={waUrl}
        target="_blank"
        rel="noreferrer"
      >
        {t(lang, "public.master.shareWhatsapp")}
      </a>

      <button
        type="button"
        className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50"
        onClick={() => copy(t(lang, "public.master.wechatHint"))}
      >
        {t(lang, "public.master.shareWechat")}
      </button>
    </div>
  );
}
