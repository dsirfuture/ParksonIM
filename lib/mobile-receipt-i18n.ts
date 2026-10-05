import type { Lang } from "@/lib/i18n";

export type MobileReceiptUiText = {
  title: string;
  supplier: string;
  inspectedAt: string;
  sku: string;
  expectedQty: string;
  casePack: string;
  goodQty: string;
  uncheckedQty: string;
  excessQty: string;
  progress: string;
  status: string;
  startCamera: string;
  cameraPermissionTitle: string;
  cameraPermissionMessage: string;
  cameraPermissionConfirm: string;
  takePhoto: string;
  skip: string;
  close: string;
  uncheckedListTitle: string;
  noUncheckedItems: string;
  photoSaved: string;
  scanSuccess: string;
  receiptCompleted: string;
  finishInspection: string;
  finishingInspection: string;
  nextReceipt: string;
  nextSupplier: string;
  scanPlaceholder: string;
  manualSubmit: string;
  cameraUnsupported: string;
  cameraDenied: string;
  noItems: string;
  overReceived: string;
  unknownBarcode: string;
  scanFailed: string;
  quantityFull: string;
  itemRemaining: string;
  uploading: string;
  photoReadFailed: string;
  photoSaveFailed: string;
  stateFailed: string;
  finishInspectionFailed: string;
  langZh: string;
  langEs: string;
};

export type MobileReceiptTtsText = {
  scanSuccess: string;
  scanFailed: string;
  unknownBarcode: string;
  quantityFull: string;
  itemRemaining: string;
  receiptCompleted: string;
  remainingItems: string;
  photoSaved: string;
  uploading: string;
  photoSaveFailed: string;
  photoReadFailed: string;
  stateFailed: string;
  finishInspectionFailed: string;
  overReceived: string;
};

export type MobileReceiptStatusText = {
  completed: string;
  inProgress: string;
  pending: string;
  unexpected: string;
};

export type MobileReceiptServerText = {
  invalidBody: string;
  receiptNotFound: string;
  receiptLocked: string;
  imageOnly: string;
  invalidImage: string;
  tooManyImages: string;
  saveEvidenceFailed: string;
  prismaEvidenceMissing: string;
  invalidCode: string;
  genericScanFailed: string;
};

export type MobileReceiptI18n = {
  lang: Lang;
  speechLang: string;
  ui: MobileReceiptUiText;
  tts: MobileReceiptTtsText;
  status: MobileReceiptStatusText;
  server: MobileReceiptServerText;
  supplierFallback: string;
};

const zh: MobileReceiptI18n = {
  lang: "zh",
  speechLang: "zh-CN",
  ui: {
    title: "验货商品列表",
    supplier: "供应商",
    inspectedAt: "验货时间",
    sku: "SKU",
    expectedQty: "应验",
    casePack: "包装数",
    goodQty: "良品",
    uncheckedQty: "未验",
    excessQty: "超收",
    progress: "进度",
    status: "状态",
    startCamera: "开始扫码",
    cameraPermissionTitle: "PARKSONMX",
    cameraPermissionMessage: "申请使用您手机的摄像头",
    cameraPermissionConfirm: "确认",
    takePhoto: "拍照",
    skip: "跳过",
    close: "关闭",
    uncheckedListTitle: "未验产品列表",
    noUncheckedItems: "当前没有未验商品",
    photoSaved: "图片已保存",
    scanSuccess: "扫码成功",
    receiptCompleted: "此单验货结束",
    finishInspection: "验货完毕",
    finishingInspection: "验货完成中...",
    nextReceipt: "去下一单验货",
    nextSupplier: "下一单供应商",
    scanPlaceholder: "输入 SKU / 条码",
    manualSubmit: "提交",
    cameraUnsupported: "当前手机浏览器暂不支持直接摄像头扫码，请手动输入条码。",
    cameraDenied: "未能打开摄像头，请允许摄像头权限或更换浏览器后重试。",
    noItems: "当前验货单暂无商品明细",
    overReceived: "超收商品",
    unknownBarcode: "新条形码",
    scanFailed: "扫码失败",
    quantityFull: "数量已满",
    itemRemaining: "{sku}未验{count}个",
    uploading: "上传中...",
    photoReadFailed: "图片读取失败",
    photoSaveFailed: "保存图片失败",
    stateFailed: "状态获取失败",
    finishInspectionFailed: "验货完毕失败",
    langZh: "ZH",
    langEs: "ES",
  },
  tts: {
    scanSuccess: "扫码成功",
    scanFailed: "扫码失败",
    unknownBarcode: "新条形码",
    quantityFull: "数量已满",
    itemRemaining: "{sku}未验{count}个",
    receiptCompleted: "此单验货结束",
    remainingItems: "还有{count}个商品未验",
    photoSaved: "图片已保存",
    uploading: "上传中",
    photoSaveFailed: "保存图片失败",
    photoReadFailed: "图片读取失败",
    stateFailed: "状态获取失败",
    finishInspectionFailed: "验货完毕失败",
    overReceived: "超收商品",
  },
  status: {
    completed: "已完成",
    inProgress: "验货中",
    pending: "未验",
    unexpected: "新增",
  },
  server: {
    invalidBody: "提交内容格式不正确",
    receiptNotFound: "未找到对应验货单",
    receiptLocked: "验货单已完成并锁定，不能再修改",
    imageOnly: "只能上传图片文件",
    invalidImage: "图片内容格式不正确",
    tooManyImages: "最多只能上传 20 张图片",
    saveEvidenceFailed: "暂时无法保存证据图片",
    prismaEvidenceMissing: "证据模块不可用",
    invalidCode: "扫码内容不正确",
    genericScanFailed: "当前未能完成扫码 请稍后再试",
  },
  supplierFallback: "未填写",
};

const es: MobileReceiptI18n = {
  lang: "es",
  speechLang: "es-MX",
  ui: {
    title: "ARTÍCULOS",
    supplier: "PROV.",
    inspectedAt: "HORA",
    sku: "SKU",
    expectedQty: "ESP.",
    casePack: "BULTOS",
    goodQty: "OK",
    uncheckedQty: "PEND.",
    excessQty: "EXTRA",
    progress: "AVANCE",
    status: "ESTADO",
    startCamera: "Escanear",
    cameraPermissionTitle: "PARKSONMX",
    cameraPermissionMessage: "Solicita usar la cámara de su teléfono",
    cameraPermissionConfirm: "Aceptar",
    takePhoto: "Foto",
    skip: "Saltar",
    close: "Cerrar",
    uncheckedListTitle: "PEND.",
    noUncheckedItems: "Sin pendientes",
    photoSaved: "Foto guardada",
    scanSuccess: "OK",
    receiptCompleted: "Recepción terminada",
    finishInspection: "Finalizar",
    finishingInspection: "Finalizando...",
    nextReceipt: "Ir sig.",
    nextSupplier: "Prov. sig.",
    scanPlaceholder: "SKU / Cód.",
    manualSubmit: "Guardar",
    cameraUnsupported: "Sin cámara. Captura el código.",
    cameraDenied: "No abre cámara. Da permiso o cambia navegador.",
    noItems: "Sin artículos",
    overReceived: "Extra",
    unknownBarcode: "Cód. nuevo",
    scanFailed: "Error esc.",
    quantityFull: "Completo",
    itemRemaining: "Faltan {count} de {sku}",
    uploading: "Subiendo...",
    photoReadFailed: "Error foto",
    photoSaveFailed: "Error guardado",
    stateFailed: "Error estado",
    finishInspectionFailed: "Error cierre",
    langZh: "ZH",
    langEs: "ES",
  },
  tts: {
    scanSuccess: "Correcto",
    scanFailed: "Error",
    unknownBarcode: "Código nuevo",
    quantityFull: "Completo",
    itemRemaining: "Faltan {count} de {sku}",
    receiptCompleted: "Recepción terminada",
    remainingItems: "Faltan {count}",
    photoSaved: "Foto guardada",
    uploading: "Subiendo",
    photoSaveFailed: "Error al guardar foto",
    photoReadFailed: "Error de foto",
    stateFailed: "Error de estado",
    finishInspectionFailed: "Error al cerrar",
    overReceived: "Extra",
  },
  status: {
    completed: "Hecho",
    inProgress: "En rev.",
    pending: "Pend.",
    unexpected: "Nuevo",
  },
  server: {
    invalidBody: "Datos no válidos",
    receiptNotFound: "No existe la recepción",
    receiptLocked: "La recepción ya está cerrada",
    imageOnly: "Solo fotos",
    invalidImage: "Foto inválida",
    tooManyImages: "Máximo 20 fotos",
    saveEvidenceFailed: "No se pudo guardar la foto",
    prismaEvidenceMissing: "Módulo de fotos no disponible",
    invalidCode: "Código inválido",
    genericScanFailed: "No se pudo escanear",
  },
  supplierFallback: "Sin prov.",
};

export const mobileReceiptI18n: Record<Lang, MobileReceiptI18n> = {
  zh,
  es,
};

export function getMobileReceiptI18n(lang: Lang): MobileReceiptI18n {
  return mobileReceiptI18n[lang];
}

export function resolveLang(
  value: string | null | undefined,
  fallback: Lang = "zh",
): Lang {
  if (value === "zh" || value === "es") return value;
  return fallback;
}

export function formatMobileReceiptTemplate(template: string, params: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? ""));
}
