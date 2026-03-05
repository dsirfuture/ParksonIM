import { cookies } from "next/headers";
import type { Lang } from "./i18n";

export const LANG_COOKIE = "parksonmx_lang";

export async function getLang(): Promise<Lang> {
  const ck = await cookies(); // ✅ cookies() is async in your Next typings
  const v = ck.get(LANG_COOKIE)?.value;

  if (v === "zh" || v === "es") return v;
  return "zh";
}
