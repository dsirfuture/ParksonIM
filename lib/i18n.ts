export type Lang = "zh" | "es";

export const dict: Record<Lang, Record<string, string>> = {
  zh: {
    "app.title": "ParksonMX 验货平台",
    "common.loading": "加载中…",
  },
  es: {
    "app.title": "Plataforma de Inspección ParksonMX",
    "common.loading": "Cargando…",
  },
};

export function t(lang: Lang, key: string): string {
  const v = dict[lang]?.[key];
  return v ?? `[MISSING:${key}]`;
}
