import { cookies } from "next/headers";
import type { Lang } from "./i18n";

export const LANG_COOKIE = "lang";

export async function getLang(): Promise<Lang> {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  if (c === "zh" || c === "es") return c;
  return "zh";
}
