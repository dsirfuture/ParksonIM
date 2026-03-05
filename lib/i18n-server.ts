// lib/i18n-server.ts
import { cookies } from "next/headers";
import type { Lang } from "@/lib/i18n";

const LANG_COOKIE = "lang";

export function getServerLang(): Lang {
  const c = cookies().get(LANG_COOKIE)?.value;
  if (c === "es" || c === "zh") return c;
  return "zh";
}

export function setLangCookieValue(lang: Lang) {
  // Server Actions / Route Handlers can call this if needed.
  // In most pages, you only need getServerLang().
  cookies().set(LANG_COOKIE, lang, { path: "/" });
}
