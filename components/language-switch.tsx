"use client";

import { usePathname, useSearchParams } from "next/navigation";

type LanguageSwitchProps = {
  lang: "zh" | "es";
};

export function LanguageSwitch({ lang }: LanguageSwitchProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function switchLang(nextLang: "zh" | "es") {
    if (nextLang === lang) return;

    document.cookie = `lang=${nextLang}; path=/; max-age=31536000; samesite=lax`;

    const params = new URLSearchParams(searchParams.toString());
    params.set("lang", nextLang);
    const nextUrl = `${pathname}?${params.toString()}`;

    window.location.href = nextUrl;
  }

  return (
    <div className="flex items-center gap-2 text-xs font-semibold leading-none">
      <button
        type="button"
        onClick={() => switchLang("zh")}
        className={
          lang === "zh"
            ? "leading-none text-primary"
            : "leading-none text-slate-500 hover:text-slate-700"
        }
      >
        ZH
      </button>

      <span className="leading-none text-slate-300">|</span>

      <button
        type="button"
        onClick={() => switchLang("es")}
        className={
          lang === "es"
            ? "leading-none text-primary"
            : "leading-none text-slate-500 hover:text-slate-700"
        }
      >
        ES
      </button>
    </div>
  );
}
