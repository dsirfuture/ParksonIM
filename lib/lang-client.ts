export type ClientLang = "zh" | "es";

export function getClientLang(): ClientLang {
  if (typeof document === "undefined") return "zh";
  const cookie = document.cookie || "";
  const match = cookie.match(/(?:^|;\s*)lang=([^;]+)/);
  const value = match?.[1];
  return value === "es" ? "es" : "zh";
}

