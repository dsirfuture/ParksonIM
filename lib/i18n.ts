export type Lang = "zh" | "es";

export const dict: Record<Lang, Record<string, string>> = {
  zh: {
    // App
    "app.title": "ParksonMX 验货平台",
    "common.loading": "加载中…",

    // Public Master (总账单公开页)
    "public.master.title": "总账单公开查看",
    "public.master.linkedReceipts": "关联验货单",
    "public.master.th.receiptNo": "单号",
    "public.master.th.supplier": "供应商",
    "public.master.th.status": "状态",
    "public.master.downloadXlsx": "下载完整结算单 (XLSX)",
    "public.master.noPricingNote": "公开页面不展示价格、折扣、金额等商业信息。",
    "public.master.copyLink": "复制链接",
    "public.master.copied": "链接已复制",
    "public.master.copyFailed": "复制失败，请手动复制地址栏链接",
    "public.master.shareWhatsapp": "WhatsApp 分享",
    "public.master.shareWechat": "微信分享",
    "public.master.wechatHint": "链接已复制，请粘贴到微信发送",
  },

  es: {
    // App
    "app.title": "Plataforma de Inspección ParksonMX",
    "common.loading": "Cargando…",

    // Public Master (página pública de liquidación)
    "public.master.title": "Ver Liquidación Total (Pública)",
    "public.master.linkedReceipts": "Recepciones Vinculadas",
    "public.master.th.receiptNo": "N°",
    "public.master.th.supplier": "Proveedor",
    "public.master.th.status": "Estado",
    "public.master.downloadXlsx": "Descargar Liquidación Completa (XLSX)",
    "public.master.noPricingNote":
      "La página pública no muestra precio, descuento ni importe (información comercial).",
    "public.master.copyLink": "Copiar enlace",
    "public.master.copied": "Enlace copiado",
    "public.master.copyFailed": "No se pudo copiar. Copia el enlace desde la barra de direcciones.",
    "public.master.shareWhatsapp": "Compartir por WhatsApp",
    "public.master.shareWechat": "Compartir en WeChat",
    "public.master.wechatHint": "Enlace copiado. Pégalo en WeChat para enviarlo.",
  },
};

export function t(lang: Lang, key: string): string {
  const v = dict[lang]?.[key];
  // ✅ 不做跨语言 fallback，避免出现双语混杂
  return v ?? `[MISSING:${key}]`;
}
