"use client";

import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

export function ShareActions(props: { lang: Lang; publicPath: string }) {
  const { lang, publicPath } = props;

  const copy = async (msg: string) => {
    const full = `${window.location.origin}${publicPath}`;
    await navigator.clipboard.writeText(full);
    alert(msg);
  };

  const waUrl = `https://wa.me/?text=${encodeURIComponent(
    `${typeof window !== "undefined" ? window.location.origin : ""}${publicPath}`
  )}`;

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
