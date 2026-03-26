"use client";

import NextImage from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Eye, MapPin, Paperclip, Pencil, Trash2, X } from "lucide-react";
import { getClientLang } from "@/lib/lang-client";

type PermissionState = {
  manageSuppliers: boolean;
  manageProducts: boolean;
  manageCustomers: boolean;
  exportProductCatalog: boolean;
  viewReports: boolean;
  inspectGoods: boolean;
  importReceipts: boolean;
  exportAllData: boolean;
  viewAllData: boolean;
};

type SettingsClientProps = {
  isAdmin: boolean;
  currentPermissions: PermissionState;
};

type TabKey = "perm" | "supplier" | "customer" | "category" | "doc";

type UserPermissionRow = {
  id: string;
  name: string;
  phone: string;
  role: "admin" | "worker";
  permissions: PermissionState;
};

type Supplier = {
  id: string;
  shortName: string;
  fullName: string;
  logoUrl: string;
  contact: string;
  phone: string;
  startDate: string;
  accountPeriodDays: string;
  enabled: boolean;
  discountRules: SupplierDiscountRule[];
};

type SupplierDiscountRule = {
  id: string;
  category: string;
  normalDiscount: string;
  vipDiscount: string;
};

type SupplierProductSourceItem = {
  id: string;
  sku: string;
  barcode: string;
  nameZh: string;
  nameEs: string;
  casePack: number | null;
  cartonPack: number | null;
  unitPrice: string | number | null;
  lastImportBatch: string;
  updatedAt: string;
};

type Customer = {
  id: string;
  sourceType?: "profile" | "yg" | "manual";
  name: string;
  linkedYgName?: string;
  contact: string;
  phone: string;
  whatsapp: string;
  email: string;
  stores: string;
  cityCountry: string;
  customerType: string;
  vipLevel: string;
  creditLevel: string;
  tags: string;
  orderStats: string;
  channelText?: string;
  totalOrderAmountText?: string;
  packingAmountText?: string;
  debtAmountText?: string;
  paymentTermText?: string;
  totalOrderCount?: number;
  detailRows?: Array<{
    overlayRecordId?: string;
    orderNo: string;
    orderDateText: string;
    orderAmountText: string;
    packingAmountText?: string;
    shippedAtText?: string;
    paidAtText?: string;
    paymentTermText?: string;
    latestStatus: string;
  }>;
  manualOrderRecords?: Array<{
    id: string;
    customerName: string;
    customerProfileId?: string;
    ygOrderNo: string;
    externalOrderNo: string;
    orderChannel: string;
    packingAmountText: string;
    shippedAtText: string;
    paidAtText: string;
    paymentTermText: string;
  }>;
};

type ManualOrderForm = {
  id: string;
  sourceType: "yg" | "manual";
  customerProfileId: string;
  customerName: string;
  ygOrderNo: string;
  externalOrderNo: string;
  orderChannel: string;
  packingAmount: string;
  shippedAt: string;
  paidAt: string;
  paymentTermDays: string;
};

type CustomerSummary = {
  totalOrderCount: number;
  totalOrderAmountText: string;
};

type CustomerDetailRow = NonNullable<Customer["detailRows"]>[number];
type CustomerTimelineRow = {
  id: string;
  sourceType: "yg" | "manual";
  manualRecordId: string;
  orderNo: string;
  orderDateText: string;
  orderAmountText: string;
  channelText: string;
  packingAmountText: string;
  shippedAtText: string;
  paymentRows: Array<{
    id: string;
    sourceType: "yg" | "manual";
    payableAmountText: string;
    paidAmountText: string;
    paymentTimeText: string;
    paymentMethodText: string;
    paymentTargetText: string;
    unpaidAmountText: string;
  }>;
};

type CustomerSearchItem = {
  id: string;
  companyName: string;
  relationName: string;
  registeredPhone: string;
  cityCountry: string;
};

type CatalogConfig = {
  customer: string;
  category: string;
  discount: string;
  showStock: boolean;
  showImage: boolean;
  language: "zh" | "es";
  cover: string;
  note: string;
  docHeader: string;
  docFooter: string;
  docPhone: string;
  docLogoUrl: string;
  docLogoPosition: "left" | "right" | "center" | "top" | "bottom";
  docHeaderAlign: "left" | "center" | "right";
  docFooterAlign: "left" | "center" | "right";
  docWhatsapp: string;
  docWechat: string;
  docShowWhatsapp: boolean;
  docShowWechat: boolean;
  docShowContact: boolean;
  docShowHeader: boolean;
  docShowFooter: boolean;
  docShowLogo: boolean;
};

type CategoryMap = {
  id: string;
  categoryZh: string;
  categoryEs: string;
  yogoCode: string;
  active: boolean;
};

type CategoryMapForm = CategoryMap;

const EMPTY_SUPPLIER: Supplier = {
  id: "",
  shortName: "",
  fullName: "",
  logoUrl: "",
  contact: "",
  phone: "",
  startDate: "",
  accountPeriodDays: "",
  enabled: true,
  discountRules: [],
};

const EMPTY_CUSTOMER: Customer = {
  id: "",
  sourceType: "manual",
  name: "",
  linkedYgName: "",
  contact: "",
  phone: "",
  whatsapp: "",
  email: "",
  stores: "",
  cityCountry: "",
  customerType: "",
  vipLevel: "",
  creditLevel: "",
  tags: "",
  orderStats: "",
};

const EMPTY_CATALOG: CatalogConfig = {
  customer: "",
  category: "",
  discount: "",
  showStock: true,
  showImage: true,
  language: "zh",
  cover: "",
  note: "",
  docHeader: "PARKSONMX",
  docFooter: "BS DU S.A. DE C.V.",
  docPhone: "5530153936",
  docLogoUrl: "",
  docLogoPosition: "right",
  docHeaderAlign: "left",
  docFooterAlign: "right",
  docWhatsapp: "",
  docWechat: "",
  docShowWhatsapp: false,
  docShowWechat: false,
  docShowContact: true,
  docShowHeader: true,
  docShowFooter: true,
  docShowLogo: false,
};

const EMPTY_MANUAL_ORDER_FORM: ManualOrderForm = {
  id: "",
  sourceType: "manual",
  customerProfileId: "",
  customerName: "",
  ygOrderNo: "",
  externalOrderNo: "",
  orderChannel: "",
  packingAmount: "",
  shippedAt: "",
  paidAt: "",
  paymentTermDays: "",
};

const EMPTY_CATEGORY_MAP: CategoryMapForm = {
  id: "",
  categoryZh: "",
  categoryEs: "",
  yogoCode: "",
  active: true,
};

const TAB_LIST: TabKey[] = ["perm", "supplier", "customer", "category", "doc"];

const PERMISSION_KEYS: Array<{ key: keyof PermissionState; zh: string; es: string }> = [
  { key: "manageSuppliers", zh: "供应商", es: "Prov" },
  { key: "manageProducts", zh: "产品", es: "Prod" },
  { key: "manageCustomers", zh: "客户", es: "Cli" },
  { key: "exportProductCatalog", zh: "导出目录", es: "ExpCat" },
  { key: "viewReports", zh: "报表", es: "Rep" },
  { key: "inspectGoods", zh: "验货", es: "Insp" },
  { key: "importReceipts", zh: "导入验货单", es: "ImpRec" },
  { key: "exportAllData", zh: "导出全部", es: "ExpAll" },
  { key: "viewAllData", zh: "查看全部", es: "ViewAll" },
];

const SITE_MAP_ROWS: Array<{ zh: string; es: string; key: keyof PermissionState }> = [
  { zh: "友购订单", es: "YG", key: "manageSuppliers" },
  { zh: "产品管理", es: "Prod", key: "manageProducts" },
  { zh: "客户与资料", es: "Cli", key: "manageCustomers" },
  { zh: "产品目录导出", es: "ExpCat", key: "exportProductCatalog" },
  { zh: "账单/报表", es: "Bill/Rep", key: "viewReports" },
  { zh: "验货与导入", es: "Insp/Imp", key: "inspectGoods" },
  { zh: "数据总览/导出", es: "View/Exp", key: "viewAllData" },
];

async function readJson<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

async function readJsonSafe<T = unknown>(res: Response): Promise<T | null> {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  return readJson<T>(res);
}

async function compressImageForUpload(file: File, maxSizeBytes = 900 * 1024): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= maxSizeBytes) {
    return file;
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("read_failed"));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_load_failed"));
    img.src = dataUrl;
  });

  const maxEdge = 1200;
  const ratio = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return file;
  }
  ctx.drawImage(image, 0, 0, width, height);

  let quality = 0.9;
  let blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  while (blob && blob.size > maxSizeBytes && quality > 0.45) {
    quality -= 0.1;
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  }

  if (!blob) {
    return file;
  }

  const targetName = file.name.replace(/\.[^.]+$/, "") || "upload";
  return new File([blob], `${targetName}.jpg`, { type: "image/jpeg" });
}

function normalizeCustomerMergeValue(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeCustomerPhone(value: unknown) {
  return String(value || "").replace(/\D+/g, "").trim();
}

function normalizeCustomerAmount(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

function customerNamesMatch(left: Customer, right: Customer) {
  const leftName = normalizeCustomerMergeValue(left.name);
  const rightName = normalizeCustomerMergeValue(right.name);
  if (!leftName || !rightName) return false;
  return leftName === rightName;
}

function customerContactsMatch(left: Customer, right: Customer) {
  const leftContact = normalizeCustomerMergeValue(left.contact);
  const rightContact = normalizeCustomerMergeValue(right.contact);
  if (!leftContact || !rightContact) return false;
  return leftContact === rightContact;
}

function customerPhonesMatch(left: Customer, right: Customer) {
  const leftPhone = normalizeCustomerPhone(left.phone);
  const rightPhone = normalizeCustomerPhone(right.phone);
  if (!leftPhone || !rightPhone) return false;
  return leftPhone === rightPhone;
}

function customerAmountsMatch(left: Customer, right: Customer) {
  const leftAmount = normalizeCustomerAmount(left.totalOrderAmountText);
  const rightAmount = normalizeCustomerAmount(right.totalOrderAmountText);
  return leftAmount !== "0.00" && leftAmount === rightAmount;
}

function getCustomerMatchScore(left: Customer, right: Customer) {
  let score = 0;
  if (customerNamesMatch(left, right)) score += 1;
  if (customerContactsMatch(left, right)) score += 1;
  if (customerPhonesMatch(left, right)) score += 1;
  if (customerAmountsMatch(left, right)) score += 1;
  return score;
}

function getCustomerCompletenessScore(item: Customer) {
  return [
    item.name,
    item.contact,
    item.phone,
    item.cityCountry,
    item.whatsapp,
    item.email,
    item.stores,
    item.creditLevel,
    item.vipLevel,
  ].reduce((sum, value) => sum + (String(value || "").trim() ? 1 : 0), 0);
}

function pickPreferredCustomerRow(left: Customer, right: Customer) {
  const leftScore = getCustomerCompletenessScore(left);
  const rightScore = getCustomerCompletenessScore(right);
  if (rightScore !== leftScore) {
    return rightScore > leftScore ? right : left;
  }
  const leftDetailCount = left.detailRows?.length || 0;
  const rightDetailCount = right.detailRows?.length || 0;
  if (rightDetailCount !== leftDetailCount) {
    return rightDetailCount > leftDetailCount ? right : left;
  }
  return left;
}

function buildCustomerMergeKey(item: Customer) {
  return [
    normalizeCustomerMergeValue(item.name),
    normalizeCustomerMergeValue(item.contact),
    normalizeCustomerMergeValue(item.phone),
  ]
    .filter(Boolean)
    .join("|");
}

function mergeTwoCustomerRows(existing: Customer, item: Customer) {
  const existingDetailMap = new Map<string, CustomerDetailRow>();
  for (const row of existing.detailRows || []) {
    existingDetailMap.set(row.orderNo, row);
  }
  for (const row of item.detailRows || []) {
    if (!existingDetailMap.has(row.orderNo)) {
      existingDetailMap.set(row.orderNo, row);
    }
  }
  const mergedDetailRows = Array.from(existingDetailMap.values()).sort((left, right) =>
    String(right.orderDateText || "").localeCompare(String(left.orderDateText || ""), "zh-CN"),
  );
  const totalOrderAmount = mergedDetailRows.reduce(
    (sum, row) => sum + Number(row.orderAmountText || 0),
    0,
  );
  const profileRow =
    existing.sourceType === "profile" ? existing : item.sourceType === "profile" ? item : null;
  const ygRow =
    existing.sourceType === "yg" ? existing : item.sourceType === "yg" ? item : null;
  const preferredRow = pickPreferredCustomerRow(existing, item);

  return {
    ...preferredRow,
    name: preferredRow.name || ygRow?.name || profileRow?.name || existing.name || item.name || "",
    linkedYgName:
      existing.linkedYgName ||
      item.linkedYgName ||
      ygRow?.linkedYgName ||
      ygRow?.name ||
      "",
    contact: preferredRow.contact || ygRow?.contact || profileRow?.contact || existing.contact || item.contact || "",
    phone: preferredRow.phone || ygRow?.phone || profileRow?.phone || existing.phone || item.phone || "",
    whatsapp: preferredRow.whatsapp || ygRow?.whatsapp || profileRow?.whatsapp || existing.whatsapp || item.whatsapp || "",
    email: preferredRow.email || ygRow?.email || profileRow?.email || existing.email || item.email || "",
    stores: preferredRow.stores || profileRow?.stores || existing.stores || item.stores || "",
    cityCountry: preferredRow.cityCountry || ygRow?.cityCountry || profileRow?.cityCountry || existing.cityCountry || item.cityCountry || "",
    customerType: preferredRow.customerType || profileRow?.customerType || existing.customerType || item.customerType || "",
    vipLevel: preferredRow.vipLevel || profileRow?.vipLevel || existing.vipLevel || item.vipLevel || "",
    creditLevel: preferredRow.creditLevel || profileRow?.creditLevel || existing.creditLevel || item.creditLevel || "",
    tags: preferredRow.tags || profileRow?.tags || existing.tags || item.tags || "",
    orderStats: String(mergedDetailRows.length || ygRow?.orderStats || profileRow?.orderStats || existing.orderStats || item.orderStats || ""),
    detailRows: mergedDetailRows,
    totalOrderCount: mergedDetailRows.length,
    totalOrderAmountText: totalOrderAmount.toFixed(2),
    packingAmountText: "",
  };
}

function mergeCustomerRows(items: Customer[]) {
  const mergedByExactKey = new Map<string, Customer>();

  for (const item of items) {
    const mergeKey = buildCustomerMergeKey(item) || `${item.sourceType || "profile"}:${item.id}`;
    const existing = mergedByExactKey.get(mergeKey);
    if (!existing) {
      mergedByExactKey.set(mergeKey, {
        ...item,
        detailRows: [...(item.detailRows || [])],
      });
      continue;
    }
    mergedByExactKey.set(mergeKey, mergeTwoCustomerRows(existing, item));
  }

  const dedupedRows: Customer[] = [];
  for (const item of mergedByExactKey.values()) {
    const existingIndex = dedupedRows.findIndex((candidate) => getCustomerMatchScore(candidate, item) >= 2);
    if (existingIndex === -1) {
      dedupedRows.push(item);
      continue;
    }
    dedupedRows[existingIndex] = mergeTwoCustomerRows(dedupedRows[existingIndex], item);
  }

  return dedupedRows;
}

function isVipCustomer(item: Customer) {
  return Number(item.totalOrderAmountText || 0) >= 100000;
}

function getCustomerChannelLabel(item: Customer, t: (zh: string, es: string) => string) {
  return item.sourceType === "manual" ? t("其他渠道", "Canal manual") : t("友购", "Yogo");
}

function VipBadgeIcon() {
  return (
    <NextImage src="/icons/vip.svg" alt="" aria-hidden="true" width={18} height={18} className="h-[18px] w-[18px] shrink-0" />
  );
}

function ReadonlyCustomerField({ value, centered = false, children }: { value?: string; centered?: boolean; children?: ReactNode }) {
  return (
    <div className={`flex min-h-9 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 ${centered ? "justify-center text-center" : ""}`}>
      {children ?? (String(value || "").trim() || "-")}
    </div>
  );
}

function PlainCustomerValue({ value, centered = false, children }: { value?: string; centered?: boolean; children?: ReactNode }) {
  return (
    <div className={`flex min-h-9 items-center px-1 text-sm text-slate-700 ${centered ? "justify-center text-center" : ""}`}>
      {children ?? (String(value || "").trim() || "-")}
    </div>
  );
}

function parseSupplierDiscountRules(input: string): SupplierDiscountRule[] {
  const raw = String(input || "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, idx) => ({
        id: String(item?.id || `rule-${idx}-${Date.now()}`),
        category: String(item?.category || "").trim(),
        normalDiscount: String(item?.normalDiscount ?? "").trim(),
        vipDiscount: String(item?.vipDiscount ?? "").trim(),
      }))
      .filter((item) => item.category);
  } catch {
    return [];
  }
}

function toSupplierDiscountRuleText(rules: SupplierDiscountRule[]) {
  return JSON.stringify(
    rules
      .map((item) => ({
        category: String(item.category || "").trim(),
        normalDiscount: String(item.normalDiscount || "").trim(),
        vipDiscount: String(item.vipDiscount || "").trim(),
      }))
      .filter((item) => item.category),
  );
}

function normalizeYogoCodeInput(value: string) {
  const segments = String(value || "")
    .split(/[^\d]+/u)
    .map((item) => item.replace(/\D+/g, "").slice(0, 2))
    .filter(Boolean)
    .map((item) => item.padStart(2, "0"));
  return Array.from(new Set(segments)).join(",");
}

function formatYogoCodeDraft(value: string) {
  return normalizeYogoCodeInput(value).replace(/,/g, " ");
}

export function SettingsClient({ isAdmin, currentPermissions }: SettingsClientProps) {
  const SUPPLIER_PAGE_SIZE = 10;
  const SUPPLIER_PRODUCT_PREVIEW_PAGE_SIZE = 12;
  const CUSTOMER_PAGE_SIZE = 11;
  const [lang, setLang] = useState<"zh" | "es">("zh");
  const [tab, setTab] = useState<TabKey>("perm");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const [permissionRows, setPermissionRows] = useState<UserPermissionRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierKeyword, setSupplierKeyword] = useState("");
  const [supplierPage, setSupplierPage] = useState(1);
  const [supplierForm, setSupplierForm] = useState<Supplier>(EMPTY_SUPPLIER);
  const [uploadingSupplierLogo, setUploadingSupplierLogo] = useState(false);
  const [pendingSupplierImportId, setPendingSupplierImportId] = useState("");
  const [importingSupplierId, setImportingSupplierId] = useState("");
  const [previewingSupplierId, setPreviewingSupplierId] = useState("");
  const [supplierEditorOpen, setSupplierEditorOpen] = useState(false);
  const [supplierProductPreview, setSupplierProductPreview] = useState<{
    open: boolean;
    supplierName: string;
    loading: boolean;
    page: number;
    items: SupplierProductSourceItem[];
  }>({
    open: false,
    supplierName: "",
    loading: false,
    page: 1,
    items: [],
  });
  const [quickCategoryDraft, setQuickCategoryDraft] = useState({
    open: false,
    ruleId: "",
    categoryZh: "",
    categoryEs: "",
    active: true,
    saving: false,
  });

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [manualOrderOpen, setManualOrderOpen] = useState(false);
  const [manualOrderForm, setManualOrderForm] = useState<ManualOrderForm>(EMPTY_MANUAL_ORDER_FORM);
  const [customerSummary, setCustomerSummary] = useState<CustomerSummary>({ totalOrderCount: 0, totalOrderAmountText: "0.00" });
  const [customerKeyword, setCustomerKeyword] = useState("");
  const [customerVipFilter, setCustomerVipFilter] = useState<"all" | "vip" | "normal">("all");
  const [customerPage, setCustomerPage] = useState(1);
  const [customerForm, setCustomerForm] = useState<Customer>(EMPTY_CUSTOMER);
  const [customerEditorOpen, setCustomerEditorOpen] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerSearchResults, setCustomerSearchResults] = useState<CustomerSearchItem[]>([]);
  const [customerDetailId, setCustomerDetailId] = useState("");
  const [customerPaymentDetailId, setCustomerPaymentDetailId] = useState("");
  const [customerDetailDateSort, setCustomerDetailDateSort] = useState<"desc" | "asc">("desc");
  const paymentEvidenceInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [paymentEvidenceNames, setPaymentEvidenceNames] = useState<Record<string, string[]>>({});
  const manualOrderEditorMode = manualOrderForm.sourceType;

  const [catalogConfig, setCatalogConfig] = useState<CatalogConfig>(EMPTY_CATALOG);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [categoryMaps, setCategoryMaps] = useState<CategoryMap[]>([]);
  const [categoryKeyword, setCategoryKeyword] = useState("");
  const [categoryForm, setCategoryForm] = useState<CategoryMapForm>(EMPTY_CATEGORY_MAP);
  const [categoryDefaultActive, setCategoryDefaultActive] = useState(true);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const categoryZhInputRef = useRef<HTMLInputElement | null>(null);
  const supplierProductInputRef = useRef<HTMLInputElement | null>(null);

  const zhFallbackMap: Record<string, string> = {
    "Vista de documento": "文档预览",
    "PDF catalogo cliente (completo)": "客户产品清单 PDF（完整）",
    "La vista completa aplica al PDF de catalogo para cliente.": "当前完整布局预览基于客户产品清单 PDF。",
    "Activo de marca": "品牌资源",
    "Tel": "电话",
    "Alcance": "配置说明",
    "Datos base reutilizables; layout completo para PDF de catalogo cliente.": "基础信息可跨文档复用；完整布局主要用于客户产品清单 PDF。",
    "A. Marca": "A. 品牌信息",
    "Reutilizable en varios documentos.": "可复用于多种文档。",
    "Subiendo...": "上传中...",
    "Subir logo": "上传 Logo",
    "Marca": "品牌名称",
    "Empresa": "公司名称",
    "B. Contacto": "B. 联系方式",
    "Usable en PDF, tabla y futuras plantillas.": "可用于 PDF、表格与后续模板。",
    "Telefono": "电话",
    "C. Visualizacion": "C. 显示设置",
    "Algunos switches aplican solo a layout completo.": "部分开关仅对完整布局文档生效。",
    "Mostrar encabezado": "显示页眉",
    "Mostrar pie": "显示页脚",
    "Mostrar logo": "显示 Logo",
    "Mostrar contacto": "显示联系方式",
    "D. Disposicion": "D. 布局设置",
    "Aplicado principalmente al PDF de catalogo cliente.": "当前主要用于客户产品清单 PDF。",
    "Alineacion encabezado": "页眉对齐",
    "Alineacion pie": "页脚对齐",
    "Posicion logo": "Logo 位置",
    "Izquierda": "左对齐",
    "Centro": "居中",
    "Derecha": "右对齐",
    "Arriba": "上",
    "Abajo": "下",
    "E. Canales": "E. 渠道设置",
    "Los controles de canal usan switch.": "启用类控件统一使用 Switch。",
    "Activar WhatsApp": "启用 WhatsApp",
    "Activar WeChat": "启用微信",
    "F. Documentos y soporte": "F. 适用文档与支持级别",
    "Cada tipo de documento tiene distinto nivel de soporte.": "不同文档类型支持级别不同。",
    "PDF catalogo cliente": "客户产品清单 PDF",
    "Exportacion tabla": "表格导出",
    "Exportacion Excel": "Excel 导出",
    "Tabla interna": "内部打印表",
    "Otras plantillas": "其他模板",
    "Completo": "完整支持",
    "Parcial": "部分支持",
    "No disponible": "暂未支持",
    "Reservado": "后续扩展",
    "Guardar ajustes": "保存文档设置",
  };
  const tx = (zh: string, es: string) => {
    if (lang !== "zh") return es;
    if (!zh || zh.includes("?")) return zhFallbackMap[es] || es;
    return zh;
  };

  const tabText = (key: TabKey) =>
    ({
      perm: tx("权限", "Perm"),
      supplier: tx("供应商", "Prov"),
      customer: tx("客户", "Cli"),
      category: tx("分类管理", "Cat map"),
      doc: tx("文档设置", "Doc"),
    })[key];

  const canManageSuppliers = isAdmin || currentPermissions.manageSuppliers;
  const canManageCustomers = isAdmin || currentPermissions.manageCustomers;
  const canManageProducts = isAdmin || currentPermissions.manageProducts;

  useEffect(() => {
    setLang(getClientLang());
    void loadAll();
  }, []);

  async function loadAll() {
    try {
      setLoading(true);
      setError("");

      const [pRes, sRes, cRes, cfgRes, cmRes] = await Promise.all([
        fetch("/api/settings/permissions"),
        fetch("/api/settings/suppliers"),
        fetch("/api/settings/customers"),
        fetch("/api/settings/catalog-config"),
        fetch("/api/settings/category-maps"),
      ]);

      const [pJson, sJson, cJson, cfgJson, cmJson] = await Promise.all([
        readJson<any>(pRes),
        readJson<any>(sRes),
        readJson<any>(cRes),
        readJson<any>(cfgRes),
        readJson<any>(cmRes),
      ]);

      if (pRes.ok && pJson?.ok) setPermissionRows(pJson.items || []);
      if (sRes.ok && sJson?.ok) {
        setSuppliers(
          (sJson.items || []).map((item: any) => ({
            ...item,
            discountRules: parseSupplierDiscountRules(String(item.discountRule || "")),
          })),
        );
      }
      if (cRes.ok && cJson?.ok) {
        setCustomers(cJson.items || []);
        setCustomerSummary({
          totalOrderCount: Number(cJson.summary?.totalOrderCount || 0),
          totalOrderAmountText: String(cJson.summary?.totalOrderAmountText || "0.00"),
        });
      }
      if (cfgRes.ok && cfgJson?.ok && cfgJson.item) {
        setCatalogConfig({ ...EMPTY_CATALOG, ...cfgJson.item });
      }
      if (cmRes.ok && cmJson?.ok) setCategoryMaps(cmJson.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("加载设置失败", "Load fail"));
    } finally {
      setLoading(false);
    }
  }

  async function loadCategoryMaps() {
    const res = await fetch("/api/settings/category-maps");
    const json = await readJson<any>(res);
    if (!res.ok || !json?.ok) throw new Error(json?.error || tx("加载分类失败", "Load category fail"));
    setCategoryMaps(json.items || []);
  }

  function showSaved(text = tx("已保存", "Saved")) {
    setSaved(text);
    window.setTimeout(() => setSaved(""), 1400);
  }

  async function savePermission(userId: string, permissions: PermissionState) {
    try {
      setError("");
      const res = await fetch("/api/settings/permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, permissions }),
      });
      const json = await readJson<any>(res);
      if (!res.ok || !json?.ok) throw new Error(json?.error || tx("保存失败", "Save fail"));
      showSaved(tx("权限已保存", "Perm saved"));
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("保存失败", "Save fail"));
    }
  }

  async function saveEntity(endpoint: string, payload: unknown, okTextZh: string, okTextEs: string) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await readJson<any>(res);
    if (!res.ok || !json?.ok) throw new Error(json?.error || tx("保存失败", "Save fail"));
    showSaved(tx(okTextZh, okTextEs));
  }

  async function saveSupplier() {
    try {
      setError("");
      await saveEntity(
        "/api/settings/suppliers",
        {
          ...supplierForm,
          address: "",
          discountRule: toSupplierDiscountRuleText(supplierForm.discountRules),
        },
        "供应商已保存",
        "Prov saved",
      );
      setSupplierForm(EMPTY_SUPPLIER);
      setSupplierEditorOpen(false);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("保存供应商失败", "Save prov fail"));
    }
  }

  async function uploadSupplierLogo(file: File) {
    try {
      setError("");
      setUploadingSupplierLogo(true);
      const prepared = await compressImageForUpload(file);
      const form = new FormData();
      form.append("file", prepared);
      const res = await fetch("/api/settings/suppliers/logo", {
        method: "POST",
        body: form,
      });
      const json = await readJsonSafe<any>(res);
      if (!res.ok || !json?.ok || !json?.url) {
        throw new Error(
          json?.error
            || (res.status === 413
              ? tx("图片太大，已超出上传限制，请换小一点的图片", "Imagen demasiado grande")
              : tx("上传失败，请换一张更小的图片再试", "Upload failed, try a smaller image")),
        );
      }
      setSupplierForm((prev) => ({ ...prev, logoUrl: json.url }));
      showSaved(tx("Logo 已上传", "Logo uploaded"));
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("上传失败", "Upload fail"));
    } finally {
      setUploadingSupplierLogo(false);
    }
  }

  async function deleteSupplier(id: string) {
    try {
      setError("");
      const res = await fetch(`/api/settings/suppliers/${id}`, { method: "DELETE" });
      const json = await readJson<any>(res);
      if (!res.ok || !json?.ok) throw new Error(json?.error || tx("删除失败", "Delete fail"));
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("删除供应商失败", "Delete prov fail"));
    }
  }

  async function importSupplierProducts(supplierId: string, file: File) {
    try {
      setError("");
      setImportingSupplierId(supplierId);
      const form = new FormData();
      form.append("supplierId", supplierId);
      form.append("file", file);

      const res = await fetch("/api/settings/suppliers/products/import", {
        method: "POST",
        body: form,
      });
      const json = await readJsonSafe<any>(res);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || tx("导入产品资料失败", "Import fail"));
      }

      showSaved(
        tx(
          `已导入 ${json.total || 0} 条产品资料`,
          `Importadas ${json.total || 0} filas`,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("导入产品资料失败", "Import fail"));
    } finally {
      setPendingSupplierImportId("");
      setImportingSupplierId("");
    }
  }

  async function previewSupplierProducts(supplier: Supplier) {
    try {
      setError("");
      setPreviewingSupplierId(supplier.id);
      setSupplierProductPreview({
        open: true,
        supplierName: supplier.shortName || supplier.fullName || "-",
        loading: true,
        page: 1,
        items: [],
      });
      const res = await fetch(`/api/settings/suppliers/products/import?supplierId=${encodeURIComponent(supplier.id)}`);
      const json = await readJsonSafe<any>(res);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || tx("加载供应商产品资料失败", "Load fail"));
      }
      setSupplierProductPreview({
        open: true,
        supplierName: supplier.shortName || supplier.fullName || "-",
        loading: false,
        page: 1,
        items: json.items || [],
      });
    } catch (e) {
      setSupplierProductPreview((prev) => ({ ...prev, loading: false }));
      setError(e instanceof Error ? e.message : tx("加载供应商产品资料失败", "Load fail"));
    } finally {
      setPreviewingSupplierId("");
    }
  }

  async function saveCustomer() {
    try {
      setError("");
      await saveEntity("/api/settings/customers", customerForm, "客户已保存", "Cli saved");
      setCustomerForm(EMPTY_CUSTOMER);
      setCustomerEditorOpen(false);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("保存客户失败", "Save cli fail"));
    }
  }

  async function saveManualOrder() {
    try {
      setError("");
      await saveEntity("/api/settings/customers/manual-orders", manualOrderForm, "记录已保存", "Record saved");
      setManualOrderOpen(false);
      setManualOrderForm(EMPTY_MANUAL_ORDER_FORM);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("保存记录失败", "Save record fail"));
    }
  }

  function openManualOrderEditor(input: {
    id?: string;
    sourceType?: "yg" | "manual";
    customerProfileId?: string;
    customerName?: string;
    ygOrderNo?: string;
    externalOrderNo?: string;
    orderChannel?: string;
    packingAmount?: string;
    shippedAt?: string;
    paidAt?: string;
    paymentTermDays?: string;
  }) {
    setManualOrderForm({
      id: input.id || "",
      sourceType: input.sourceType || "manual",
      customerProfileId: input.customerProfileId || "",
      customerName: input.customerName || "",
      ygOrderNo: input.ygOrderNo || "",
      externalOrderNo: input.externalOrderNo || "",
      orderChannel: input.orderChannel || "",
      packingAmount: input.packingAmount || "",
      shippedAt: input.shippedAt || "",
      paidAt: input.paidAt || "",
      paymentTermDays: input.paymentTermDays || "",
    });
    setManualOrderOpen(true);
  }

  function handleTimelineRowEdit(row: CustomerTimelineRow) {
    setCustomerPaymentDetailId("");
    if (row.sourceType === "yg") {
      const detailRow = detailCustomer?.detailRows?.find((item) => item.orderNo === row.orderNo);
      openManualOrderEditor({
        id: detailRow?.overlayRecordId || row.manualRecordId || "",
        sourceType: "yg",
        customerProfileId: detailCustomer?.sourceType === "profile" ? detailCustomer.id : "",
        customerName: detailCustomer?.name || "",
        ygOrderNo: row.orderNo || "",
        externalOrderNo: "",
        orderChannel: "YOGO",
        packingAmount: row.packingAmountText || "",
        shippedAt: row.shippedAtText || "",
        paidAt: detailRow?.paidAtText || "",
        paymentTermDays: detailRow?.paymentTermText || "",
      });
      return;
    }
    const manualRow = detailCustomer?.manualOrderRecords?.find((item) => item.id === row.manualRecordId);
    if (!manualRow) {
      setError(tx("未找到可编辑记录。", "Editable record not found."));
      return;
    }
    openManualOrderEditor({
      id: manualRow.id,
      sourceType: "manual",
      customerProfileId: manualRow.customerProfileId || (detailCustomer?.sourceType === "profile" ? detailCustomer.id : ""),
      customerName: manualRow.customerName || detailCustomer?.name || "",
      ygOrderNo: manualRow.ygOrderNo || "",
      externalOrderNo: manualRow.externalOrderNo || "",
      orderChannel: manualRow.orderChannel || "",
      packingAmount: manualRow.packingAmountText || "",
      shippedAt: manualRow.shippedAtText || "",
      paidAt: manualRow.paidAtText || "",
      paymentTermDays: manualRow.paymentTermText || "",
    });
  }

  function handlePaymentRowEdit(row: CustomerTimelineRow) {
    handleTimelineRowEdit(row);
  }

  function handlePaymentEvidenceUpload(paymentRowId: string, sourceType: "yg" | "manual") {
    paymentEvidenceInputRefs.current[paymentRowId]?.click();
  }

  function handlePaymentEvidenceSelected(paymentRowId: string, files: FileList | null) {
    const nextNames = Array.from(files || [])
      .map((file) => String(file.name || "").trim())
      .filter(Boolean);
    setPaymentEvidenceNames((prev) => ({ ...prev, [paymentRowId]: nextNames }));
    if (nextNames.length > 0) {
      showSaved(tx("付款证据已加入待上传列表", "Payment evidence added to pending list"));
    }
  }

  async function deleteCustomer(id: string, customerName: string) {
    try {
      setError("");
      const confirmed = window.confirm(
        lang === "zh"
          ? `确认删除客户“${customerName || "-"}”吗？删除前需要输入完整公司名称确认。`
          : `Delete customer "${customerName || "-"}"? You must type the full company name to confirm.`,
      );
      if (!confirmed) return;
      const confirmText = window.prompt(
        lang === "zh"
          ? `请输入完整客户公司名称以确认删除：${customerName || "-"}`
          : `Type full customer company name to confirm deletion: ${customerName || "-"}`,
      );
      if ((confirmText || "").trim() !== String(customerName || "").trim()) {
        setError(
          lang === "zh"
            ? "客户公司名称校验失败，未执行删除"
            : "Customer name confirmation failed. Delete cancelled.",
        );
        return;
      }
      const res = await fetch(`/api/settings/customers/${id}`, { method: "DELETE" });
      const json = await readJson<any>(res);
      if (!res.ok || !json?.ok) throw new Error(json?.error || tx("删除失败", "Delete fail"));
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("删除客户失败", "Delete cli fail"));
    }
  }

  async function saveCatalog() {
    try {
      setError("");
      await saveEntity("/api/settings/catalog-config", catalogConfig, "目录配置已保存", "Cat cfg saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("保存目录配置失败", "Save cfg fail"));
    }
  }

  async function uploadDocLogo(file: File) {
    try {
      setError("");
      setUploadingLogo(true);
      const prepared = await compressImageForUpload(file);
      const form = new FormData();
      form.append("file", prepared);
      const res = await fetch("/api/settings/catalog-config/logo", {
        method: "POST",
        body: form,
      });
      const json = await readJsonSafe<any>(res);
      if (!res.ok || !json?.ok || !json?.url) {
        throw new Error(
          json?.error
            || (res.status === 413
              ? tx("图片太大，已超出上传限制，请换小一点的图片", "Imagen demasiado grande")
              : tx("上传失败，请换一张更小的图片再试", "Upload failed, try a smaller image")),
        );
      }
      setCatalogConfig((p) => ({ ...p, docLogoUrl: json.url }));
      showSaved(tx("Logo 已上传，请保存文档设置", "Logo uploaded, save settings"));
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("上传失败", "Upload fail"));
    } finally {
      setUploadingLogo(false);
    }
  }

  async function saveCategoryMap() {
    try {
      setError("");
      await saveEntity(
        "/api/settings/category-maps",
        {
          ...categoryForm,
          yogoCode: normalizeYogoCodeInput(categoryForm.yogoCode),
        },
        "分类已保存",
        "Category saved",
      );
      setCategoryForm(EMPTY_CATEGORY_MAP);
      await loadCategoryMaps();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("保存分类失败", "Save category fail"));
      return false;
    }
  }

  function addSupplierDiscountRule() {
    const newRule = {
      id: `rule-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      category: "",
      normalDiscount: "",
      vipDiscount: "",
    };
    setSupplierForm((prev) => ({
      ...prev,
      // Put the newly added rule at the top for faster editing.
      discountRules: [newRule, ...prev.discountRules],
    }));
  }

  function updateSupplierDiscountRule(
    id: string,
    patch: Partial<Pick<SupplierDiscountRule, "category" | "normalDiscount" | "vipDiscount">>,
  ) {
    setSupplierForm((prev) => ({
      ...prev,
      discountRules: prev.discountRules.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  }

  function removeSupplierDiscountRule(id: string) {
    setSupplierForm((prev) => ({
      ...prev,
      discountRules: prev.discountRules.filter((item) => item.id !== id),
    }));
  }

  function openQuickCategoryForRules() {
    let targetRuleId =
      supplierForm.discountRules.find((item) => !item.category)?.id ||
      supplierForm.discountRules[0]?.id ||
      "";
    if (!targetRuleId) {
      targetRuleId = `rule-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      setSupplierForm((prev) => ({
        ...prev,
        discountRules: [
          ...prev.discountRules,
          { id: targetRuleId, category: "", normalDiscount: "", vipDiscount: "" },
        ],
      }));
    }
    setQuickCategoryDraft({
      open: true,
      ruleId: targetRuleId,
      categoryZh: "",
      categoryEs: "",
      active: true,
      saving: false,
    });
  }

  async function saveQuickCategory() {
    const zh = quickCategoryDraft.categoryZh.trim();
    if (!zh || !quickCategoryDraft.ruleId) return;
    try {
      setQuickCategoryDraft((prev) => ({ ...prev, saving: true }));
      const res = await fetch("/api/settings/category-maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "",
          categoryZh: zh,
          categoryEs: quickCategoryDraft.categoryEs.trim(),
          active: quickCategoryDraft.active,
        }),
      });
      const json = await readJson<any>(res);
      if (!res.ok || !json?.ok) throw new Error(json?.error || tx("保存分类失败", "Save category fail"));
      await loadCategoryMaps();
      updateSupplierDiscountRule(quickCategoryDraft.ruleId, { category: zh });
      setQuickCategoryDraft({
        open: false,
        ruleId: "",
        categoryZh: "",
        categoryEs: "",
        active: true,
        saving: false,
      });
      showSaved(tx("分类已保存", "Category saved"));
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("保存分类失败", "Save category fail"));
      setQuickCategoryDraft((prev) => ({ ...prev, saving: false }));
    }
  }

  async function deleteCategoryMap(id: string) {
    try {
      setError("");
      const res = await fetch("/api/settings/category-maps", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await readJson<any>(res);
      if (!res.ok || !json?.ok) throw new Error(json?.error || tx("删除失败", "Delete fail"));
      await loadCategoryMaps();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("删除分类失败", "Delete category fail"));
    }
  }

  const filteredSuppliers = useMemo(
    () =>
      suppliers.filter((s) =>
        [s.shortName, s.fullName, s.contact, s.phone]
          .join(" ")
          .toLowerCase()
          .includes(supplierKeyword.trim().toLowerCase()),
      ),
    [suppliers, supplierKeyword],
  );

  useEffect(() => {
    setSupplierPage(1);
  }, [supplierKeyword, suppliers.length]);

  const supplierTotalPages = Math.max(1, Math.ceil(filteredSuppliers.length / SUPPLIER_PAGE_SIZE));
  const safeSupplierPage = Math.min(supplierPage, supplierTotalPages);
  const pagedSuppliers = useMemo(
    () =>
      filteredSuppliers.slice(
        (safeSupplierPage - 1) * SUPPLIER_PAGE_SIZE,
        safeSupplierPage * SUPPLIER_PAGE_SIZE,
      ),
    [filteredSuppliers, safeSupplierPage, SUPPLIER_PAGE_SIZE],
  );

  const supplierPreviewTotalPages = Math.max(
    1,
    Math.ceil(supplierProductPreview.items.length / SUPPLIER_PRODUCT_PREVIEW_PAGE_SIZE),
  );
  const safeSupplierPreviewPage = Math.min(supplierProductPreview.page, supplierPreviewTotalPages);
  const pagedSupplierPreviewItems = useMemo(
    () =>
      supplierProductPreview.items.slice(
        (safeSupplierPreviewPage - 1) * SUPPLIER_PRODUCT_PREVIEW_PAGE_SIZE,
        safeSupplierPreviewPage * SUPPLIER_PRODUCT_PREVIEW_PAGE_SIZE,
      ),
    [supplierProductPreview.items, safeSupplierPreviewPage, SUPPLIER_PRODUCT_PREVIEW_PAGE_SIZE],
  );

  const mergedCustomers = useMemo(() => mergeCustomerRows(customers), [customers]);

  const filteredCustomers = useMemo(
    () =>
      mergedCustomers
        .filter((c) =>
          Number(c.totalOrderAmountText || 0) > 0
          &&
          !String(c.name || "").includes("百盛供应链")
          &&
          [c.name, c.contact, c.phone, c.whatsapp, c.tags]
            .join(" ")
            .toLowerCase()
            .includes(customerKeyword.trim().toLowerCase())
          && (
            customerVipFilter === "all"
            || (customerVipFilter === "vip" && isVipCustomer(c))
            || (customerVipFilter === "normal" && !isVipCustomer(c))
          ),
        )
        .sort((left, right) => Number(right.totalOrderAmountText || 0) - Number(left.totalOrderAmountText || 0)),
    [mergedCustomers, customerKeyword, customerVipFilter],
  );
  useEffect(() => {
    setCustomerPage(1);
  }, [customerKeyword, customerVipFilter, mergedCustomers.length]);

  const customerTotalPages = Math.max(1, Math.ceil(filteredCustomers.length / CUSTOMER_PAGE_SIZE));
  const safeCustomerPage = Math.min(customerPage, customerTotalPages);
  const pagedCustomers = useMemo(
    () =>
      filteredCustomers.slice(
        (safeCustomerPage - 1) * CUSTOMER_PAGE_SIZE,
        safeCustomerPage * CUSTOMER_PAGE_SIZE,
      ),
    [filteredCustomers, safeCustomerPage, CUSTOMER_PAGE_SIZE],
  );
  const detailCustomer = useMemo(
    () => mergedCustomers.find((item) => item.id === customerDetailId) || null,
    [customerDetailId, mergedCustomers],
  );
  const sortedDetailRows = useMemo<CustomerTimelineRow[]>(() => {
    const orderRows = (detailCustomer?.detailRows || []).map((row) => ({
      id: `detail:${row.orderNo}`,
      sourceType: "yg" as const,
      manualRecordId: row.overlayRecordId || "",
      orderNo: row.orderNo,
      orderDateText: row.orderDateText,
      orderAmountText: row.orderAmountText,
      channelText: tx("友购", "Yogo"),
      packingAmountText: row.packingAmountText || "",
      shippedAtText: row.shippedAtText || "",
      paymentRows: [
        {
          id: `detail:${row.orderNo}:payment`,
          sourceType: "yg" as const,
          payableAmountText: row.packingAmountText || row.orderAmountText || "",
          paidAmountText: row.paidAtText && (row.packingAmountText || row.orderAmountText) ? row.packingAmountText || row.orderAmountText : "",
          paymentTimeText: row.paidAtText || "",
          paymentMethodText: "",
          paymentTargetText: "",
          unpaidAmountText: (row.packingAmountText || row.orderAmountText)
            ? (row.paidAtText ? "0.00" : row.packingAmountText || row.orderAmountText)
            : "",
        },
      ],
    }));
    const manualRows = (detailCustomer?.manualOrderRecords || []).map((row) => ({
      id: `manual:${row.id}`,
      sourceType: "manual" as const,
      manualRecordId: row.id,
      orderNo: row.ygOrderNo || row.externalOrderNo || "-",
      orderDateText: row.shippedAtText || row.paidAtText || "-",
      orderAmountText: "",
      channelText: row.orderChannel || tx("其他渠道", "Canal manual"),
      packingAmountText: row.packingAmountText || "",
      shippedAtText: row.shippedAtText || "",
      paymentRows: [
        {
          id: `manual:${row.id}:payment`,
          sourceType: "manual" as const,
          payableAmountText: row.packingAmountText || "",
          paidAmountText: row.paidAtText && row.packingAmountText ? row.packingAmountText : "",
          paymentTimeText: row.paidAtText || "",
          paymentMethodText: "",
          paymentTargetText: "",
          unpaidAmountText: row.packingAmountText ? (row.paidAtText ? "0.00" : row.packingAmountText) : "",
        },
      ],
    }));
    return [...orderRows, ...manualRows].sort((left, right) => {
      const compareResult = String(left.orderDateText || "").localeCompare(String(right.orderDateText || ""), "zh-CN");
      return customerDetailDateSort === "asc" ? compareResult : -compareResult;
    });
  }, [customerDetailDateSort, detailCustomer?.detailRows, detailCustomer?.manualOrderRecords, lang, tx]);
  const activePaymentDetail = useMemo(
    () => sortedDetailRows.find((row) => row.id === customerPaymentDetailId) || null,
    [customerPaymentDetailId, sortedDetailRows],
  );
  const detailPackingAmountTotal = useMemo(
    () =>
      sortedDetailRows.reduce((sum, row) => {
        const value = Number(row.packingAmountText || 0);
        return Number.isFinite(value) ? sum + value : sum;
      }, 0),
    [sortedDetailRows],
  );
  const hasAnyPackingAmount = useMemo(
    () => sortedDetailRows.some((row) => Boolean(String(row.packingAmountText || "").trim())),
    [sortedDetailRows],
  );
  useEffect(() => {
    if (!detailCustomer) {
      setCustomerPaymentDetailId("");
    }
  }, [detailCustomer]);
  useEffect(() => {
    if (!activePaymentDetail) {
      setPaymentEvidenceNames({});
    }
  }, [activePaymentDetail]);

  useEffect(() => {
    if (!customerEditorOpen) {
      setCustomerSearchLoading(false);
      setCustomerSearchResults([]);
      return;
    }
    const keyword = customerForm.name.trim();
    if (!keyword) {
      setCustomerSearchLoading(false);
      setCustomerSearchResults([]);
      return;
    }

    let aborted = false;
    setCustomerSearchLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/settings/customers/search?keyword=${encodeURIComponent(keyword)}`);
        const json = await readJsonSafe<{ ok?: boolean; items?: CustomerSearchItem[]; error?: string }>(res);
        if (aborted) return;
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || (lang === "zh" ? "加载友购客户搜索失败" : "Load YG customer search fail"));
        }
        setCustomerSearchResults(Array.isArray(json.items) ? json.items : []);
      } catch (e) {
        if (!aborted) {
          setError(e instanceof Error ? e.message : (lang === "zh" ? "加载友购客户搜索失败" : "Load YG customer search fail"));
          setCustomerSearchResults([]);
        }
      } finally {
        if (!aborted) {
          setCustomerSearchLoading(false);
        }
      }
    }, 220);

    return () => {
      aborted = true;
      window.clearTimeout(timer);
    };
  }, [customerEditorOpen, customerForm.name, lang]);

  function handleCustomerSearchSelect(item: CustomerSearchItem) {
    setCustomerForm((prev) => ({
      ...prev,
      name: item.companyName || prev.name,
      contact: item.relationName || prev.contact,
      phone: item.registeredPhone || prev.phone,
      whatsapp: item.registeredPhone || prev.whatsapp,
    }));
    setCustomerSearchOpen(false);
  }

  const filteredCategoryMaps = useMemo(
    () =>
      categoryMaps.filter((item) =>
        item.categoryZh.trim() !== "0" &&
        [item.categoryZh, item.categoryEs, item.yogoCode]
          .join(" ")
          .toLowerCase()
          .includes(categoryKeyword.trim().toLowerCase()),
      ),
    [categoryMaps, categoryKeyword],
  );

  const supplierCategoryOptions = useMemo(
    () =>
      categoryMaps
        .filter((item) => item.active && item.categoryZh.trim() && item.categoryZh.trim() !== "0")
        .map((item) => item.categoryZh.trim()),
    [categoryMaps],
  );

  const alignClassMap: Record<CatalogConfig["docHeaderAlign"], string> = {
    left: "justify-start text-left",
    center: "justify-center text-center",
    right: "justify-end text-right",
  };

  const previewLogoPositionClass: Record<CatalogConfig["docLogoPosition"], string> = {
    left: "left-3 top-2",
    right: "right-3 top-2",
    center: "left-1/2 top-2 -translate-x-1/2",
    top: "left-1/2 top-1 -translate-x-1/2",
    bottom: "left-1/2 bottom-9 -translate-x-1/2",
  };

  function renderSwitch(
    label: string,
    checked: boolean,
    onChange: (next: boolean) => void,
  ) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`flex h-8 items-center justify-between rounded-lg border px-2.5 text-xs transition ${
          checked
            ? "border-primary/30 bg-[#2F3C7E]/5 text-slate-800"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        }`}
      >
        <span className="font-medium">{label}</span>
        <span className={`relative h-5 w-8 rounded-full transition ${checked ? "bg-primary" : "bg-slate-300"}`}>
          <span
            className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition ${
              checked ? "left-[18px]" : "left-0.5"
            }`}
          />
        </span>
      </button>
    );
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-wrap gap-2 border-b border-slate-200 px-5 py-4">
          {TAB_LIST.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`inline-flex h-9 items-center rounded-xl px-3 text-sm font-semibold ${
                tab === t ? "bg-primary text-white" : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              {tabText(t)}
            </button>
          ))}
          {saved ? <span className="ml-auto text-sm text-emerald-600">{saved}</span> : null}
        </div>

        {error ? <div className="mx-5 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div> : null}
        {loading ? <div className="p-5 text-sm text-slate-500">{tx("加载中...", "Load...")}</div> : null}

        {!loading && tab === "perm" ? (
          <div className="space-y-4 p-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              {tx("当前角色：", "Role:")}
              <span className="font-semibold">{isAdmin ? tx("超级管理员", "Admin") : tx("员工", "Staff")}</span>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-2 text-sm font-semibold text-slate-800">{tx("权限与页面对应", "Perm -> Page")}</div>
              <div className="grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                {SITE_MAP_ROWS.map((row) => (
                  <div key={row.key} className="flex items-center justify-between rounded-md border border-slate-100 px-2 py-1.5">
                    <span>{lang === "zh" ? row.zh : row.es}</span>
                    <code className="rounded bg-slate-100 px-1.5 py-0.5">{row.key}</code>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">{tx("账号", "User")}</th>
                    {PERMISSION_KEYS.map((p) => (
                      <th key={p.key} className="px-3 py-2 text-left">{lang === "zh" ? p.zh : p.es}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {permissionRows.map((u) => (
                    <tr key={u.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-semibold">{`${u.name} (${u.phone})`}</td>
                      {PERMISSION_KEYS.map((p) => (
                        <td key={p.key} className="px-3 py-2">
                          {u.role === "admin" ? (
                            "✓"
                          ) : (
                            <input
                              type="checkbox"
                              checked={u.permissions[p.key]}
                              disabled={!isAdmin}
                              onChange={(e) => {
                                const next = permissionRows.map((row) =>
                                  row.id === u.id
                                    ? { ...row, permissions: { ...row.permissions, [p.key]: e.target.checked } }
                                    : row,
                                );
                                setPermissionRows(next);
                                const changed = next.find((row) => row.id === u.id);
                                if (changed) void savePermission(u.id, changed.permissions);
                              }}
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isAdmin ? (
              <Link href="/admin/users" className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white">
                {tx("去账号管理", "Go users")}
              </Link>
            ) : null}
          </div>
        ) : null}

        {!loading && tab === "supplier" ? (
          <div className="space-y-4 p-5">
            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">{tx("供应商列表", "Lista prov")}</h3>
                  <button
                    type="button"
                    disabled={!canManageSuppliers}
                    onClick={() => {
                      setSupplierForm(EMPTY_SUPPLIER);
                      setSupplierEditorOpen(true);
                    }}
                    className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    {tx("新增供应商", "Nuevo prov")}
                  </button>
                </div>
                <input value={supplierKeyword} onChange={(e) => setSupplierKeyword(e.target.value)} placeholder={tx("搜索供应商", "Search prov")} className="h-10 w-full max-w-[280px] rounded-xl border border-slate-200 px-3 text-sm" />
              </div>
              <div className="max-h-[540px] overflow-auto">
                <table className="w-full min-w-[1040px] text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="w-[76px] px-3 py-2 text-left whitespace-nowrap">LOGO</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">{tx("简称", "Short")}</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">{tx("全称", "Full")}</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">{tx("联系人 / 电话", "Cont / Tel")}</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">{tx("折扣规则", "Disc rule")}</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">{tx("账期", "Term")}</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">{tx("状态", "Status")}</th>
                      <th className="w-[220px] px-3 py-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedSuppliers.map((s) => (
                      <tr key={s.id} className="border-t border-slate-100">
                        <td className="px-3 py-1.5">
                          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                            {s.logoUrl ? (
                              <img
                                src={s.logoUrl}
                                alt={`${s.shortName || "supplier"}-logo`}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <span className="text-[10px] font-medium text-slate-400">
                                {lang === "zh" ? "未上传" : "Sin logo"}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 font-semibold">{s.shortName || "-"}</td>
                        <td className="px-3 py-1.5">{s.fullName || "-"}</td>
                        <td className="px-3 py-1.5">{`${s.contact || "-"} / ${s.phone || "-"}`}</td>
                        <td className="px-3 py-1.5">
                          {s.discountRules.length
                            ? tx(`已配置 ${s.discountRules.length} 条`, `${s.discountRules.length} reglas`)
                            : tx("未配置", "Sin configurar")}
                        </td>
                        <td className="px-3 py-1.5">{s.accountPeriodDays ? `${s.accountPeriodDays} ${tx("天", "d")}` : "-"}</td>
                        <td className="px-3 py-1.5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              s.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {s.enabled ? tx("启用", "Activo") : tx("停用", "Inactivo")}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={!canManageSuppliers || importingSupplierId === s.id}
                              onClick={() => {
                                setError("");
                                setPendingSupplierImportId(s.id);
                                supplierProductInputRef.current?.click();
                              }}
                              className="inline-flex h-8 items-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold leading-none text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            >
                              {importingSupplierId === s.id
                                ? tx("导入中...", "Importando...")
                                : tx("导入产品资料", "Importar productos")}
                            </button>
                            <button
                              type="button"
                              disabled={previewingSupplierId === s.id}
                              onClick={() => void previewSupplierProducts(s)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                              aria-label={tx("查看导入资料", "Ver productos")}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSupplierForm(s);
                                setSupplierEditorOpen(true);
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-primary hover:bg-slate-50"
                              aria-label={tx("编辑", "Edit")}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={!canManageSuppliers}
                              onClick={() => void deleteSupplier(s.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                              aria-label={tx("删除", "Del")}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <input
                ref={supplierProductInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  const supplierId = pendingSupplierImportId;
                  e.target.value = "";
                  if (file && supplierId) {
                    void importSupplierProducts(supplierId, file);
                  } else {
                    setPendingSupplierImportId("");
                    setImportingSupplierId("");
                  }
                }}
              />
              {filteredSuppliers.length > 0 ? (
                <div className="border-t border-slate-200 px-4 py-3">
                  <div className="flex flex-nowrap items-center justify-center gap-2 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setSupplierPage(1)}
                      disabled={safeSupplierPage <= 1}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {tx("回到首页", "Ini")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSupplierPage((prev) => Math.max(prev - 1, 1))}
                      disabled={safeSupplierPage <= 1}
                      className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {tx("上一页", "Ant")}
                    </button>
                    <div className="inline-flex h-9 min-w-[72px] items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                      {safeSupplierPage} / {supplierTotalPages}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSupplierPage((prev) => Math.min(prev + 1, supplierTotalPages))}
                      disabled={safeSupplierPage >= supplierTotalPages}
                      className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {tx("下一页", "Sig")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSupplierPage(supplierTotalPages)}
                      disabled={safeSupplierPage >= supplierTotalPages}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {tx("去最后页", "Fin")}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {!loading && supplierProductPreview.open ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4">
            <div className="max-h-[86vh] w-full max-w-[1100px] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-soft">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-base font-semibold text-slate-900">
                  {tx("导入资料详情", "Detalle importado")} · {supplierProductPreview.supplierName}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  {tx("查看当前供应商已导入的产品资料。", "Ver productos importados del proveedor actual.")}
                </p>
              </div>
              <div className="p-4">
                {supplierProductPreview.loading ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    {tx("加载中...", "Cargando...")}
                  </div>
                ) : supplierProductPreview.items.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    {tx("还没有导入资料", "Sin datos importados")}
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[980px] text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-3 py-2 text-left">{tx("编码", "SKU")}</th>
                          <th className="px-3 py-2 text-left">{tx("条码", "Barcode")}</th>
                          <th className="px-3 py-2 text-left">{tx("中文名", "CN")}</th>
                          <th className="px-3 py-2 text-left">{tx("西文名", "ES")}</th>
                          <th className="px-3 py-2 text-left">{tx("中包数", "Case")}</th>
                          <th className="px-3 py-2 text-left">{tx("装箱数", "Carton")}</th>
                          <th className="px-3 py-2 text-left">{tx("单价", "Price")}</th>
                          <th className="px-3 py-2 text-left">{tx("更新时间", "Updated")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedSupplierPreviewItems.map((item) => (
                          <tr key={item.id} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-semibold">{item.sku || "-"}</td>
                            <td className="px-3 py-2">{item.barcode || "-"}</td>
                            <td className="px-3 py-2">{item.nameZh || "-"}</td>
                            <td className="px-3 py-2">{item.nameEs || "-"}</td>
                            <td className="px-3 py-2">{item.casePack ?? "-"}</td>
                            <td className="px-3 py-2">{item.cartonPack ?? "-"}</td>
                            <td className="px-3 py-2">{item.unitPrice ?? "-"}</td>
                            <td className="px-3 py-2">{item.updatedAt ? item.updatedAt.slice(0, 10).replace(/-/g, "/") : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              {!supplierProductPreview.loading && supplierProductPreview.items.length > 0 ? (
                <div className="border-t border-slate-200 px-4 py-3">
                  <div className="flex flex-nowrap items-center justify-center gap-2 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setSupplierProductPreview((prev) => ({ ...prev, page: 1 }))}
                      disabled={safeSupplierPreviewPage <= 1}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {tx("回到首页", "Ini")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSupplierProductPreview((prev) => ({
                          ...prev,
                          page: Math.max(prev.page - 1, 1),
                        }))
                      }
                      disabled={safeSupplierPreviewPage <= 1}
                      className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {tx("上一页", "Ant")}
                    </button>
                    <div className="inline-flex h-9 min-w-[72px] items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                      {safeSupplierPreviewPage} / {supplierPreviewTotalPages}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSupplierProductPreview((prev) => ({
                          ...prev,
                          page: Math.min(prev.page + 1, supplierPreviewTotalPages),
                        }))
                      }
                      disabled={safeSupplierPreviewPage >= supplierPreviewTotalPages}
                      className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {tx("下一页", "Sig")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSupplierProductPreview((prev) => ({
                          ...prev,
                          page: supplierPreviewTotalPages,
                        }))
                      }
                      disabled={safeSupplierPreviewPage >= supplierPreviewTotalPages}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {tx("去最后页", "Fin")}
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                <button
                  type="button"
                  onClick={() =>
                    setSupplierProductPreview({
                      open: false,
                      supplierName: "",
                      loading: false,
                      page: 1,
                      items: [],
                    })
                  }
                  className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                >
                  {tx("关闭", "Cerrar")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && quickCategoryDraft.open ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/30 px-4">
            <div className="w-full max-w-[520px] rounded-2xl border border-slate-200 bg-white shadow-soft">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">{tx("新增品类", "Nueva categoria")}</h3>
              </div>
              <div className="grid gap-3 p-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{tx("中文分类", "Categoria CN")}</label>
                  <input
                    value={quickCategoryDraft.categoryZh}
                    onChange={(e) => setQuickCategoryDraft((prev) => ({ ...prev, categoryZh: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{tx("西语分类", "Categoria ES")}</label>
                  <input
                    value={quickCategoryDraft.categoryEs}
                    onChange={(e) => setQuickCategoryDraft((prev) => ({ ...prev, categoryEs: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{tx("启用状态", "Estado")}</label>
                  {renderSwitch(tx("启用", "On"), quickCategoryDraft.active, (next) => setQuickCategoryDraft((prev) => ({ ...prev, active: next })))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                <button
                  type="button"
                  onClick={() =>
                    setQuickCategoryDraft({
                      open: false,
                      ruleId: "",
                      categoryZh: "",
                      categoryEs: "",
                      active: true,
                      saving: false,
                    })
                  }
                  className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
                >
                  {tx("取消", "Cancelar")}
                </button>
                <button
                  type="button"
                  disabled={quickCategoryDraft.saving || !quickCategoryDraft.categoryZh.trim()}
                  onClick={() => void saveQuickCategory()}
                  className="inline-flex h-9 items-center rounded-xl bg-primary px-3 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {quickCategoryDraft.saving ? tx("保存中...", "Guardando...") : tx("保存品类", "Guardar")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && supplierEditorOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
            <div className="max-h-[86vh] w-full max-w-[560px] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-soft">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-base font-semibold text-slate-900">{tx("供应商信息", "Info prov")}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {tx("用于新增、编辑和维护供应商基础资料。", "Alta, edicion y mantenimiento de datos base del proveedor.")}
                </p>
              </div>
              <div className="space-y-3 p-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("简称", "Short")}</label>
                      <input value={supplierForm.shortName} onChange={(e) => setSupplierForm((p) => ({ ...p, shortName: e.target.value }))} className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("全称", "Full")}</label>
                      <input value={supplierForm.fullName} onChange={(e) => setSupplierForm((p) => ({ ...p, fullName: e.target.value }))} className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm" />
                    </div>
                  </div>

                  <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("联系人", "Cont")}</label>
                      <input value={supplierForm.contact} onChange={(e) => setSupplierForm((p) => ({ ...p, contact: e.target.value }))} className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("电话", "Tel")}</label>
                      <input value={supplierForm.phone} onChange={(e) => setSupplierForm((p) => ({ ...p, phone: e.target.value }))} className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("账期天数", "Term days")}</label>
                      <input value={supplierForm.accountPeriodDays} onChange={(e) => setSupplierForm((p) => ({ ...p, accountPeriodDays: e.target.value }))} className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("合作开始日期", "Inicio coop.")}</label>
                      <input type="date" value={supplierForm.startDate} onChange={(e) => setSupplierForm((p) => ({ ...p, startDate: e.target.value }))} className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm" />
                    </div>
                    <div className="min-w-[118px] justify-self-end">
                      <label className="mb-1 block text-xs font-medium text-slate-600 text-right">{tx("启用状态", "Estado")}</label>
                      <div className="pt-0.5 flex justify-end">
                        {renderSwitch(tx("启用", "On"), supplierForm.enabled, (next) => setSupplierForm((p) => ({ ...p, enabled: next })))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 grid gap-3 lg:grid-cols-[280px_1fr]">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("供应商 LOGO", "Logo proveedor")}</label>
                      <div className="flex items-center gap-3">
                        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-200 bg-white">
                          {supplierForm.logoUrl ? (
                            <img src={supplierForm.logoUrl} alt="supplier-logo" className="h-full w-full object-contain" />
                          ) : (
                            <span className="text-[11px] text-slate-400">{tx("未上传", "Sin logo")}</span>
                          )}
                        </div>
                        <label className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                          {uploadingSupplierLogo ? tx("上传中...", "Subiendo...") : tx("上传图片", "Subir imagen")}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingSupplierLogo}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void uploadSupplierLogo(file);
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                      <div className="mb-1.5 flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-900">{tx("分类折扣规则", "Reglas por categoria")}</h4>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {tx("可按不同品类分别设置折扣。未配置的品类默认不应用专属折扣。", "Configure descuentos por categoria. Las no configuradas no aplican descuento especial.")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={openQuickCategoryForRules}
                          className="inline-flex h-8 shrink-0 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                        >
                          {tx("新增品类", "Nueva categoria")}
                        </button>
                      </div>

                      {supplierForm.discountRules.length > 0 ? (
                        <div className="max-h-[170px] space-y-2 overflow-auto pr-1">
                          {supplierForm.discountRules.map((rule) => {
                            const usedByOthers = new Set(
                              supplierForm.discountRules
                                .filter((item) => item.id !== rule.id)
                                .map((item) => item.category)
                                .filter(Boolean),
                            );
                            return (
                              <div key={rule.id} className="grid gap-2 lg:grid-cols-[52fr_18fr_18fr_12fr]">
                                <select
                                  value={rule.category}
                                  onChange={(e) => updateSupplierDiscountRule(rule.id, { category: e.target.value })}
                                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                                >
                                  <option value="">{tx("选择品类", "Sel categoria")}</option>
                                  {supplierCategoryOptions.map((cat) => (
                                    <option key={cat} value={cat} disabled={usedByOthers.has(cat)}>
                                      {cat}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  value={rule.normalDiscount}
                                  onChange={(e) => updateSupplierDiscountRule(rule.id, { normalDiscount: e.target.value })}
                                  placeholder={tx("普通折扣", "Desc normal")}
                                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                                />
                                <input
                                  value={rule.vipDiscount}
                                  onChange={(e) => updateSupplierDiscountRule(rule.id, { vipDiscount: e.target.value })}
                                  placeholder={tx("VIP折扣", "Desc VIP")}
                                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeSupplierDiscountRule(rule.id)}
                                  className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                                  aria-label={tx("删除", "Del")}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      <div className={`${supplierForm.discountRules.length > 0 ? "mt-2.5" : "mt-1"}`}>
                        <button type="button" onClick={addSupplierDiscountRule} className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
                          {tx("新增规则", "Agregar regla")}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setSupplierEditorOpen(false);
                    setSupplierForm(EMPTY_SUPPLIER);
                  }}
                  className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                >
                  {tx("取消", "Cancelar")}
                </button>
                <button type="button" disabled={!canManageSuppliers} onClick={() => void saveSupplier()} className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40">{tx("保存供应商", "Save prov")}</button>
                <button type="button" onClick={() => setSupplierForm(EMPTY_SUPPLIER)} className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">{tx("清空", "Clear")}</button>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && tab === "customer" ? (
          <div className="space-y-4 p-5">
            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div className="flex items-center gap-6">
                  <h3 className="text-base font-semibold text-slate-900">{tx("客户列表", "Lista cli")}</h3>
                  <span className="text-sm text-slate-500">
                    {tx("下单客户共计", "Clientes con pedido")}: <span className="font-semibold text-slate-900">{filteredCustomers.length}</span>
                  </span>
                  <span className="text-sm text-slate-500">
                    {tx("累计下单共计", "Pedidos acumulados")}: <span className="font-semibold text-slate-900">{customerSummary.totalOrderCount}</span>
                  </span>
                  <span className="text-sm text-slate-500">
                    {tx("累计下单总金额", "Monto total acumulado")}: <span className="font-semibold text-slate-900">$ {customerSummary.totalOrderAmountText}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setManualOrderForm(EMPTY_MANUAL_ORDER_FORM);
                      setManualOrderOpen(true);
                    }}
                    className="ml-6 inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {tx("新增记录", "Nuevo registro")}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={customerVipFilter}
                    onChange={(e) => setCustomerVipFilter(e.target.value as "all" | "vip" | "normal")}
                    className="h-10 min-w-[140px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  >
                    <option value="all">{tx("全部VIP", "VIP all")}</option>
                    <option value="vip">{tx("仅VIP", "Solo VIP")}</option>
                    <option value="normal">{tx("非VIP", "No VIP")}</option>
                  </select>
                  <input
                    value={customerKeyword}
                    onChange={(e) => setCustomerKeyword(e.target.value)}
                    placeholder={tx("搜索客户", "Search cli")}
                    className="h-10 w-full max-w-[280px] rounded-xl border border-slate-200 px-3 text-sm"
                  />
                </div>
              </div>
              <div className="max-h-[540px] overflow-auto">
                <table className="w-full min-w-[1300px] text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left whitespace-nowrap">{tx("客户", "Client")}</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">{tx("下单渠道", "Canal")}</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">{tx("全渠道下单", "Total amount")}</th>
                      <th className="px-3 py-2 text-center whitespace-nowrap">{tx("全渠道次数", "Total count")}</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">{tx("配货金额", "Packing amount")}</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">{tx("欠款金额", "Debt amount")}</th>
                      <th className="px-3 py-2 text-center whitespace-nowrap">{tx("VIP", "VIP")}</th>
                      <th className="px-3 py-2 text-center whitespace-nowrap">{tx("信用", "Credit")}</th>
                      <th className="px-3 py-2 text-center whitespace-nowrap">{tx("账期", "Term")}</th>
                      <th className="w-[66px] px-3 py-2 text-center whitespace-nowrap">{tx("详情", "Detail")}</th>
                      <th className="w-[66px] px-3 py-2 text-center whitespace-nowrap">{tx("编辑", "Edit")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCustomers.map((c) => (
                      <tr key={c.id} className="border-t border-slate-100">
                        <td className="px-3 py-1.5">{c.name || "-"}</td>
                        <td className="px-3 py-1.5">{c.channelText || getCustomerChannelLabel(c, tx)}</td>
                        <td className="px-3 py-1.5">$ {c.totalOrderAmountText || "0.00"}</td>
                        <td className="px-3 py-1.5 text-center">{(c.totalOrderCount ?? c.orderStats) || "-"}</td>
                        <td className="px-3 py-1.5">{c.packingAmountText ? `$ ${c.packingAmountText}` : "-"}</td>
                        <td className="px-3 py-1.5">{c.debtAmountText ? `$ ${c.debtAmountText}` : "-"}</td>
                        <td className="px-3 py-1.5 text-center">{isVipCustomer(c) ? <span className="inline-flex justify-center"><VipBadgeIcon /></span> : ""}</td>
                        <td className="px-3 py-1.5 text-center">{c.creditLevel || "-"}</td>
                        <td className="px-3 py-1.5 text-center">{c.paymentTermText || "-"}</td>
                        <td className="px-3 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setCustomerDetailDateSort("desc");
                              setCustomerDetailId(c.id);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                            aria-label={tx("详情", "Detail")}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setCustomerForm({
                                ...c,
                                id: c.sourceType === "yg" ? "" : c.id,
                              });
                              setCustomerEditorOpen(true);
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-primary hover:bg-slate-50"
                            aria-label={tx("编辑", "Edit")}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredCustomers.length > 0 ? (
                <div className="border-t border-slate-200 px-4 py-3">
                  <div className="flex flex-nowrap items-center justify-center gap-2 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setCustomerPage(1)}
                      disabled={safeCustomerPage <= 1}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {tx("回到首页", "Ini")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerPage((prev) => Math.max(prev - 1, 1))}
                      disabled={safeCustomerPage <= 1}
                      className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {tx("上一页", "Ant")}
                    </button>
                    <div className="inline-flex h-9 min-w-[72px] items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                      {safeCustomerPage} / {customerTotalPages}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCustomerPage((prev) => Math.min(prev + 1, customerTotalPages))}
                      disabled={safeCustomerPage >= customerTotalPages}
                      className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {tx("下一页", "Sig")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerPage(customerTotalPages)}
                      disabled={safeCustomerPage >= customerTotalPages}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {tx("去最后页", "Fin")}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {!loading && manualOrderOpen ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4">
            <div className="max-h-[90vh] w-full max-w-[980px] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-soft">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {manualOrderForm.id ? tx("编辑记录", "Editar registro") : tx("新增记录", "Nuevo registro")}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {tx("录入其他渠道订单信息，并用于客户列表统计。", "Registrar pedidos de otros canales para estadisticas de clientes.")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setManualOrderOpen(false);
                    setManualOrderForm(EMPTY_MANUAL_ORDER_FORM);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
                  aria-label={tx("关闭", "Close")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{tx("真实客户名称", "Cliente real")}</label>
                    <input
                      value={manualOrderForm.customerName}
                      onChange={(e) => setManualOrderForm((prev) => ({ ...prev, customerName: e.target.value }))}
                      disabled={manualOrderEditorMode === "yg"}
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{tx("下单渠道", "Canal")}</label>
                    <input
                      value={manualOrderEditorMode === "yg" ? tx("友购", "Yogo") : manualOrderForm.orderChannel}
                      onChange={(e) => setManualOrderForm((prev) => ({ ...prev, orderChannel: e.target.value }))}
                      disabled={manualOrderEditorMode === "yg"}
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{tx("友购订单号", "Pedido YG")}</label>
                    <input
                      value={manualOrderForm.ygOrderNo}
                      onChange={(e) => setManualOrderForm((prev) => ({ ...prev, ygOrderNo: e.target.value }))}
                      disabled={manualOrderEditorMode === "yg"}
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                  {manualOrderEditorMode === "manual" ? (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("其他订单号", "Pedido externo")}</label>
                      <input
                        value={manualOrderForm.externalOrderNo}
                        onChange={(e) => setManualOrderForm((prev) => ({ ...prev, externalOrderNo: e.target.value }))}
                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                      />
                    </div>
                  ) : null}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{tx("配货金额", "Packing amount")}</label>
                    <input
                      value={manualOrderForm.packingAmount}
                      onChange={(e) => setManualOrderForm((prev) => ({ ...prev, packingAmount: e.target.value }))}
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                    />
                  </div>
                  {manualOrderEditorMode === "manual" ? (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("账期", "Term")}</label>
                      <input
                        value={manualOrderForm.paymentTermDays}
                        onChange={(e) => setManualOrderForm((prev) => ({ ...prev, paymentTermDays: e.target.value.replace(/[^\d]/g, "") }))}
                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                      />
                    </div>
                  ) : null}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{tx("发货日期", "Fecha envio")}</label>
                    <input
                      type="date"
                      value={manualOrderForm.shippedAt}
                      onChange={(e) => setManualOrderForm((prev) => ({ ...prev, shippedAt: e.target.value }))}
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{tx("付款日期", "Fecha pago")}</label>
                    <input
                      type="date"
                      value={manualOrderForm.paidAt}
                      onChange={(e) => setManualOrderForm((prev) => ({ ...prev, paidAt: e.target.value }))}
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                <button
                  type="button"
                  onClick={() => {
                    setManualOrderOpen(false);
                    setManualOrderForm(EMPTY_MANUAL_ORDER_FORM);
                  }}
                  className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                >
                  {tx("取消", "Cancelar")}
                </button>
                <button
                  type="button"
                  onClick={() => void saveManualOrder()}
                  className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white"
                >
                  {manualOrderForm.id ? tx("保存修改", "Guardar cambios") : tx("保存记录", "Guardar")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && detailCustomer ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4">
            <div className="max-h-[86vh] w-full max-w-[980px] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-soft">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <h3 className="text-base font-semibold text-slate-900">
                  {tx("客户下单详情", "Detalle de pedidos")} · {detailCustomer.name || "-"}
                </h3>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                    {tx("下单次数", "Order count")}: <span className="font-semibold text-slate-900">{detailCustomer.totalOrderCount ?? sortedDetailRows.length}</span>
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                    {tx("下单金额", "Order amount")}: <span className="font-semibold text-slate-900">{detailCustomer.totalOrderAmountText ? `$ ${detailCustomer.totalOrderAmountText}` : "-"}</span>
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                    {tx("累计配货金额", "Packing total")}: <span className="font-semibold text-slate-900">{hasAnyPackingAmount ? `$ ${detailPackingAmountTotal.toFixed(2)}` : "-"}</span>
                  </span>
                </div>
              </div>
              <div className="p-4">
                {sortedDetailRows.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    {tx("当前没有匹配到下单记录", "No hay pedidos vinculados")}
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200">
                    <table className="w-full table-auto text-sm">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-3 py-2 text-left">{tx("订单号", "Order no")}</th>
                          <th className="px-3 py-2 text-left whitespace-nowrap">{tx("渠道", "Canal")}</th>
                          <th className="px-3 py-2 text-left whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setCustomerDetailDateSort((prev) => (prev === "desc" ? "asc" : "desc"))}
                              className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900"
                            >
                              <span>{tx("下单日期", "Order date")}</span>
                              {customerDetailDateSort === "desc" ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                            </button>
                          </th>
                          <th className="px-3 py-2 text-left whitespace-nowrap">{tx("下单金额", "Order amount")}</th>
                          <th className="px-3 py-2 text-left whitespace-nowrap">{tx("配货金额", "Packing amount")}</th>
                          <th className="px-3 py-2 text-left whitespace-nowrap">{tx("发货日期", "Ship date")}</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap">{tx("操作", "Acciones")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedDetailRows.map((item) => (
                          <tr key={item.id} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-semibold break-all whitespace-normal">{item.orderNo || "-"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{item.channelText || "-"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{item.orderDateText || "-"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {item.orderAmountText ? `$ ${item.orderAmountText}` : "-"}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {item.packingAmountText ? `$ ${item.packingAmountText}` : "-"}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">{item.shippedAtText || "-"}</td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleTimelineRowEdit(item)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-primary hover:bg-slate-50"
                                  aria-label={tx("编辑", "Edit")}
                                  title={tx("编辑", "Edit")}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCustomerPaymentDetailId(item.id)}
                                  className="inline-flex h-8 items-center rounded-xl bg-primary px-3 text-sm font-semibold text-white hover:opacity-95"
                                >
                                  {tx("付款", "Pago")}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setCustomerDetailId("")}
                  className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                >
                  {tx("关闭", "Cerrar")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && detailCustomer && activePaymentDetail ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 px-4">
            <div className="max-h-[80vh] w-full max-w-[860px] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-soft">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <h3 className="text-base font-semibold text-slate-900">
                  {tx("付款详情", "Detalle de pago")} · {activePaymentDetail.orderNo || "-"}
                </h3>
              </div>
              <div className="p-4">
                <div className="rounded-xl border border-slate-200">
                  <table className="w-full table-auto text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left whitespace-nowrap">{tx("需付金额", "Monto por pagar")}</th>
                        <th className="px-3 py-2 text-left whitespace-nowrap">{tx("已付金额", "Monto pagado")}</th>
                        <th className="px-3 py-2 text-left whitespace-nowrap">{tx("付款时间", "Fecha pago")}</th>
                        <th className="px-3 py-2 text-left whitespace-nowrap">{tx("付款方式", "Metodo pago")}</th>
                        <th className="px-3 py-2 text-left whitespace-nowrap">{tx("付款对象", "Destinatario")}</th>
                        <th className="px-3 py-2 text-left whitespace-nowrap">{tx("未付金额", "Monto pendiente")}</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">{tx("操作", "Acciones")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePaymentDetail.paymentRows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 whitespace-nowrap">{row.payableAmountText ? `$ ${row.payableAmountText}` : "-"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{row.paidAmountText ? `$ ${row.paidAmountText}` : "-"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{row.paymentTimeText || "-"}</td>
                          <td className="px-3 py-2 break-words whitespace-normal">{row.paymentMethodText || "-"}</td>
                          <td className="px-3 py-2 break-words whitespace-normal">{row.paymentTargetText || "-"}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{row.unpaidAmountText ? `$ ${row.unpaidAmountText}` : "-"}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <input
                                ref={(node) => {
                                  paymentEvidenceInputRefs.current[row.id] = node;
                                }}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={(event) => {
                                  handlePaymentEvidenceSelected(row.id, event.target.files);
                                  event.currentTarget.value = "";
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handlePaymentEvidenceUpload(row.id, row.sourceType)}
                                className="inline-flex h-8 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                title={tx("上传付款证据", "Upload payment evidence")}
                                aria-label={tx("上传付款证据", "Upload payment evidence")}
                              >
                                <Paperclip className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePaymentRowEdit(activePaymentDetail)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-primary hover:bg-slate-50"
                                title={tx("编辑", "Edit")}
                                aria-label={tx("编辑", "Edit")}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {paymentEvidenceNames[row.id]?.length ? `${paymentEvidenceNames[row.id].length} ${tx("个文件待上传", "files pending")}` : ""}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setCustomerPaymentDetailId("")}
                  className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                >
                  {tx("关闭", "Cerrar")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && customerEditorOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
            <div className="max-h-[86vh] w-full max-w-[560px] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-soft">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-base font-semibold text-slate-900">{tx("客户信息", "Info cli")}</h3>
              </div>
              <div className="space-y-3 p-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("友购客户名称", "Cliente Yogo")}</label>
                      <ReadonlyCustomerField value={customerForm.linkedYgName || customerForm.name} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("真实客户名称", "Cliente real")}</label>
                      <input
                        value={customerForm.name}
                        onChange={(e) => setCustomerForm((p) => ({ ...p, name: e.target.value }))}
                        className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("联系人", "Cont")}</label>
                      <ReadonlyCustomerField value={customerForm.contact} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("手机", "Mob")}</label>
                      <ReadonlyCustomerField value={customerForm.phone} />
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("VIP等级", "VIP lvl")}</label>
                      <PlainCustomerValue>
                        {isVipCustomer(customerForm) ? <span className="inline-flex"><VipBadgeIcon /></span> : "-"}
                      </PlainCustomerValue>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("信用等级", "Credit")}</label>
                      <PlainCustomerValue value={customerForm.creditLevel} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("下单次数", "Order count")}</label>
                      <PlainCustomerValue value={Number(customerForm.totalOrderCount || 0) > 0 ? String(customerForm.totalOrderCount) : "-"} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerEditorOpen(false);
                    setCustomerForm(EMPTY_CUSTOMER);
                  }}
                  className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                >
                  {tx("取消", "Cancelar")}
                </button>
                <button type="button" disabled={!canManageCustomers} onClick={() => void saveCustomer()} className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40">{tx("保存客户", "Save cli")}</button>
                <button type="button" onClick={() => setCustomerForm(EMPTY_CUSTOMER)} className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">{tx("清空", "Clear")}</button>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && tab === "category" ? (
          <div className="space-y-3 p-3">
            <div className="grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
              <div className="rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900">{tx("分类列表", "Lista de categorias")}</h3>
                    <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                      {tx("点击分类可弹窗编辑；维护中文与西语映射。", "Haga clic en una categoria para editar en modal.")}
                    </p>
                  </div>
                  <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
                    <div className="shrink-0">
                      {renderSwitch(tx("启用", "Habilitado"), categoryDefaultActive, (next) => setCategoryDefaultActive(next))}
                    </div>
                    <div className="w-full sm:w-[280px]">
                      <input
                        value={categoryKeyword}
                        onChange={(e) => setCategoryKeyword(e.target.value)}
                        placeholder={tx("搜索分类", "Buscar categoria")}
                        className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div className="h-[580px] overflow-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left">{tx("中文分类", "Categoria ZH")}</th>
                        <th className="px-3 py-2 text-left">{tx("西语分类", "Categoria ES")}</th>
                        <th className="px-3 py-2 text-left">{tx("友购序号", "YG Code")}</th>
                        <th className="px-3 py-2 text-left">{tx("状态", "Estado")}</th>
                        <th className="px-3 py-2 text-left w-[92px]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCategoryMaps.map((item) => (
                        <tr
                          key={item.id}
                          className="cursor-pointer border-t border-slate-100 transition hover:bg-slate-50"
                          onClick={() => {
                            setCategoryForm(item);
                            setCategoryModalOpen(true);
                          }}
                        >
                          <td className="px-3 py-2 font-semibold text-slate-900">{item.categoryZh}</td>
                          <td className="px-3 py-2 text-slate-700">{item.categoryEs || tx("未设置", "Sin configurar")}</td>
                          <td className="px-3 py-2 text-slate-700">{item.yogoCode || "-"}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                item.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {item.active ? tx("启用", "Activo") : tx("停用", "Inactivo")}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCategoryForm(item);
                                  setCategoryModalOpen(true);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-primary"
                                title={tx("编辑", "Editar")}
                                aria-label={tx("编辑", "Editar")}
                              >
                                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                                  <path d="M13.9 3.6a1.4 1.4 0 0 1 2 2L8 13.5l-3.1.9.9-3.1 8.1-7.7Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                disabled={!canManageProducts}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void deleteCategoryMap(item.id);
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 disabled:opacity-40"
                                title={tx("删除", "Eliminar")}
                                aria-label={tx("删除", "Eliminar")}
                              >
                                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                                  <path d="M4.5 5.5h11m-9.5 0v9.2c0 .7.6 1.3 1.3 1.3h5.4c.7 0 1.3-.6 1.3-1.3V5.5m-6.8 0V4.3c0-.7.6-1.3 1.3-1.3h2.8c.7 0 1.3.6 1.3 1.3v1.2M8 8.4v4.8m4-4.8v4.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white min-h-[580px]">
                <div className="border-b border-slate-200 px-3 py-2">
                  <h3 className="text-sm font-semibold text-slate-900">{tx("快捷操作", "Acciones rapidas")}</h3>
                  <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                    {tx("右侧统一设置启用状态并执行同步。", "Defina estado habilitado y sincronice categorias.")}
                  </p>
                </div>
                <div className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      disabled={!canManageProducts}
                      onClick={() => {
                        setCategoryForm({ ...EMPTY_CATEGORY_MAP, active: categoryDefaultActive });
                        setCategoryModalOpen(true);
                        window.setTimeout(() => categoryZhInputRef.current?.focus(), 10);
                      }}
                      className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft disabled:opacity-40"
                    >
                      {tx("新增分类", "Nueva categoria")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void loadCategoryMaps()}
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                    >
                      {tx("同步产品分类", "Sincronizar categorias")}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {categoryModalOpen ? (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
                <div className="w-full max-w-[620px] rounded-xl border border-slate-200 bg-white shadow-xl">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <h4 className="text-sm font-semibold text-slate-900">{tx("编辑分类", "Editar categoria")}</h4>
                  </div>
                  <div className="grid gap-3 p-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">{tx("中文分类", "Categoria ZH")}</label>
                      <input
                        ref={categoryZhInputRef}
                        value={categoryForm.categoryZh}
                        onChange={(e) => setCategoryForm((p) => ({ ...p, categoryZh: e.target.value }))}
                        placeholder={tx("请输入中文分类", "Ingrese categoria ZH")}
                        className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">{tx("西语分类", "Categoria ES")}</label>
                      <input
                        value={categoryForm.categoryEs}
                        onChange={(e) => setCategoryForm((p) => ({ ...p, categoryEs: e.target.value }))}
                        placeholder={tx("请输入西语分类", "Ingrese categoria ES")}
                        className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">{tx("友购序号", "YG Code")}</label>
                      <input
                        value={categoryForm.yogoCode}
                        onChange={(e) => setCategoryForm((p) => ({ ...p, yogoCode: e.target.value }))}
                        onBlur={(e) =>
                          setCategoryForm((p) => ({
                            ...p,
                            yogoCode: formatYogoCodeDraft(e.target.value),
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const normalized = formatYogoCodeDraft((e.currentTarget as HTMLInputElement).value);
                            setCategoryForm((p) => ({
                              ...p,
                              yogoCode: normalized ? `${normalized} ` : "",
                            }));
                          }
                        }}
                        placeholder={tx("例如 10 11 12", "Ej. 10 11 12")}
                        className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">{tx("可输入多个序号（空格/换行都可），系统会自动识别并规范化", "Puede ingresar multiples codigos y el sistema los normaliza automaticamente")}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">{tx("启用状态", "Estado habilitado")}</label>
                      {renderSwitch(tx("启用", "Habilitado"), categoryForm.active, (next) => setCategoryForm((p) => ({ ...p, active: next })))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryModalOpen(false);
                        setCategoryForm(EMPTY_CATEGORY_MAP);
                      }}
                      className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                    >
                      {tx("取消", "Cancelar")}
                    </button>
                    <button
                      type="button"
                      disabled={!canManageProducts}
                      onClick={async () => {
                        const ok = await saveCategoryMap();
                        if (ok) setCategoryModalOpen(false);
                      }}
                      className="inline-flex h-9 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft disabled:opacity-40"
                    >
                      {tx("保存分类", "Guardar categoria")}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {!loading && tab === "doc" ? (
          <div className="space-y-2 p-2">
            <div className="grid gap-2 xl:grid-cols-[minmax(360px,0.92fr)_minmax(620px,1.08fr)]">
              <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100/70 p-2">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold text-slate-800">{tx("文档预览", "Vista de documento")}</h3>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    {tx("客户产品清单 PDF（完整）", "PDF catalogo cliente (completo)")}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  {tx("当前完整布局预览基于客户产品清单 PDF。", "La vista completa aplica al PDF de catalogo para cliente.")}
                </p>

                <div className="mt-2 flex min-h-[560px] items-center justify-center">
                  <div
                    className={`relative w-[292px] overflow-hidden rounded-md border border-slate-200 bg-white px-3 shadow-sm aspect-[210/297] ${
                      catalogConfig.docShowHeader ? "pt-9" : "pt-3"
                    } ${catalogConfig.docShowFooter ? "pb-11" : "pb-3"}`}
                  >
                      {catalogConfig.docShowLogo ? (
                        <div className={`absolute z-10 ${previewLogoPositionClass[catalogConfig.docLogoPosition]}`}>
                          <div className="inline-flex h-5 min-w-[52px] items-center justify-center px-1">
                            {catalogConfig.docLogoUrl ? (
                              <img src={catalogConfig.docLogoUrl} alt="logo-preview" className="h-3.5 w-auto object-contain" />
                            ) : (
                              <span className="text-[8px] text-slate-400">LOGO</span>
                            )}
                          </div>
                        </div>
                      ) : null}

                      {catalogConfig.docShowHeader ? (
                        <div className={`absolute left-3 right-3 top-2 flex text-[9px] text-slate-500 ${alignClassMap[catalogConfig.docHeaderAlign]}`}>
                          <span>{catalogConfig.docHeader || "PARKSONMX"}</span>
                        </div>
                      ) : null}

                      <div className="h-full rounded border border-dashed border-slate-200 bg-slate-50/70 p-2">
                        <div className="space-y-1.5">
                          <div className="h-1.5 w-4/5 rounded bg-slate-200" />
                          <div className="h-1.5 w-3/5 rounded bg-slate-200" />
                          <div className="h-1.5 w-2/3 rounded bg-slate-200" />
                          <div className="mt-2 h-14 rounded border border-slate-200 bg-white/70" />
                          <div className="h-10 rounded border border-slate-200 bg-white/70" />
                        </div>
                      </div>

                      {catalogConfig.docShowFooter ? (
                        <div className={`absolute bottom-2 left-3 right-3 flex text-[7px] text-slate-500 ${alignClassMap[catalogConfig.docFooterAlign]}`}>
                          <div className="max-w-full">
                            <div className="truncate">{catalogConfig.docFooter || "BS DU S.A. DE C.V."}</div>
                            {catalogConfig.docShowContact ? (
                              <div className="mt-0.5 flex flex-wrap gap-x-1">
                                {catalogConfig.docPhone ? <span>{tx("电话", "Tel")}: {catalogConfig.docPhone}</span> : null}
                                {catalogConfig.docShowWhatsapp && catalogConfig.docWhatsapp ? <span>WhatsApp: {catalogConfig.docWhatsapp}</span> : null}
                                {catalogConfig.docShowWechat && catalogConfig.docWechat ? <span>WeChat: {catalogConfig.docWechat}</span> : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] leading-4 text-slate-600">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700">{tx("配置说明", "Alcance")}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-500">
                      {tx("实时预览已启用", "Vista en tiempo real")}
                    </span>
                  </div>
                  <p className="mt-1">
                    {tx("基础信息可跨文档复用；完整布局主要用于客户产品清单 PDF。", "Datos base reutilizables; layout completo para PDF de catalogo cliente.")}
                  </p>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <div className="grid gap-2 border-b border-slate-200 p-2.5 lg:grid-cols-2">
                    <section>
                      <h4 className="text-xs font-semibold text-slate-900">{tx("A. 品牌信息", "A. Marca")}</h4>
                      <p className="mt-0.5 text-[10px] text-slate-500">{tx("可复用于多种文档。", "Reutilizable en varios documentos.")}</p>
                      <div className="mt-1.5 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <div className="inline-flex h-10 min-w-[84px] items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2">
                            {catalogConfig.docLogoUrl ? (
                              <img src={catalogConfig.docLogoUrl} alt="doc-logo" className="h-7 w-auto object-contain" />
                            ) : (
                              <span className="text-[10px] text-slate-400">LOGO</span>
                            )}
                          </div>
                          <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) void uploadDocLogo(file);
                                e.currentTarget.value = "";
                              }}
                            />
                            {uploadingLogo ? tx("上传中...", "Subiendo...") : tx("上传 Logo", "Subir logo")}
                          </label>
                        </div>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          <div>
                            <label className="mb-0.5 block text-[10px] font-medium text-slate-500">{tx("品牌名称", "Marca")}</label>
                            <input
                              value={catalogConfig.docHeader}
                              onChange={(e) => setCatalogConfig((p) => ({ ...p, docHeader: e.target.value }))}
                              placeholder="PARKSONMX"
                              className="h-8 w-full rounded-md border border-slate-200 px-2.5 text-xs"
                            />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[10px] font-medium text-slate-500">{tx("公司名称", "Empresa")}</label>
                            <input
                              value={catalogConfig.docFooter}
                              onChange={(e) => setCatalogConfig((p) => ({ ...p, docFooter: e.target.value }))}
                              placeholder="BS DU S.A. DE C.V."
                              className="h-8 w-full rounded-md border border-slate-200 px-2.5 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xs font-semibold text-slate-900">{tx("B. 联系方式", "B. Contacto")}</h4>
                      <p className="mt-0.5 text-[10px] text-slate-500">{tx("可用于 PDF、表格与后续模板。", "Usable en PDF, tabla y futuras plantillas.")}</p>
                      <div className="mt-1.5 grid gap-1.5 sm:grid-cols-3">
                        <div>
                          <label className="mb-0.5 block text-[10px] font-medium text-slate-500">{tx("电话", "Telefono")}</label>
                          <input
                            value={catalogConfig.docPhone}
                            onChange={(e) => setCatalogConfig((p) => ({ ...p, docPhone: e.target.value }))}
                            className="h-8 w-full rounded-md border border-slate-200 px-2.5 text-xs"
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[10px] font-medium text-slate-500">WhatsApp</label>
                          <input
                            value={catalogConfig.docWhatsapp}
                            onChange={(e) => setCatalogConfig((p) => ({ ...p, docWhatsapp: e.target.value }))}
                            className="h-8 w-full rounded-md border border-slate-200 px-2.5 text-xs"
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-[10px] font-medium text-slate-500">WeChat ID</label>
                          <input
                            value={catalogConfig.docWechat}
                            onChange={(e) => setCatalogConfig((p) => ({ ...p, docWechat: e.target.value }))}
                            className="h-8 w-full rounded-md border border-slate-200 px-2.5 text-xs"
                          />
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="border-b border-slate-200 bg-gradient-to-r from-[#2F3C7E]/6 via-[#2F3C7E]/3 to-transparent p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-semibold text-slate-900">{tx("C. 实时预览控制中心", "C. Centro de vista en tiempo real")}</h4>
                      <span className="rounded-full border border-primary/20 bg-white px-2 py-0.5 text-[10px] text-primary">
                        {tx("左侧即时更新", "Actualizacion inmediata")}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-600">
                      {tx("统一控制文档显示与布局；改动会立即反馈到左侧预览。", "Control unificado de visualizacion y posicion con efecto inmediato.")}
                    </p>
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <div className="rounded-md border border-slate-200 bg-white p-2">
                        <div className="mb-1 text-[10px] font-semibold text-slate-600">{tx("显示内容", "Contenido visible")}</div>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {renderSwitch(tx("显示页眉", "Mostrar encabezado"), catalogConfig.docShowHeader, (next) => setCatalogConfig((p) => ({ ...p, docShowHeader: next })))}
                          {renderSwitch(tx("显示页脚", "Mostrar pie"), catalogConfig.docShowFooter, (next) => setCatalogConfig((p) => ({ ...p, docShowFooter: next })))}
                          {renderSwitch(tx("显示 Logo", "Mostrar logo"), catalogConfig.docShowLogo, (next) => setCatalogConfig((p) => ({ ...p, docShowLogo: next })))}
                          {renderSwitch(tx("显示联系方式", "Mostrar contacto"), catalogConfig.docShowContact, (next) => setCatalogConfig((p) => ({ ...p, docShowContact: next })))}
                        </div>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-white p-2">
                        <div className="mb-1 text-[10px] font-semibold text-slate-600">{tx("布局位置", "Posicion de layout")}</div>
                        <div className="grid gap-1.5 sm:grid-cols-3">
                          <div>
                            <label className="mb-0.5 block text-[10px] font-medium text-slate-500">{tx("页眉对齐", "Alineacion encabezado")}</label>
                            <select
                              value={catalogConfig.docHeaderAlign}
                              onChange={(e) => setCatalogConfig((p) => ({ ...p, docHeaderAlign: e.target.value as CatalogConfig["docHeaderAlign"] }))}
                              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs"
                            >
                              <option value="left">{tx("左对齐", "Izquierda")}</option>
                              <option value="center">{tx("居中", "Centro")}</option>
                              <option value="right">{tx("右对齐", "Derecha")}</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[10px] font-medium text-slate-500">{tx("页脚对齐", "Alineacion pie")}</label>
                            <select
                              value={catalogConfig.docFooterAlign}
                              onChange={(e) => setCatalogConfig((p) => ({ ...p, docFooterAlign: e.target.value as CatalogConfig["docFooterAlign"] }))}
                              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs"
                            >
                              <option value="left">{tx("左对齐", "Izquierda")}</option>
                              <option value="center">{tx("居中", "Centro")}</option>
                              <option value="right">{tx("右对齐", "Derecha")}</option>
                            </select>
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[10px] font-medium text-slate-500">{tx("Logo 位置", "Posicion logo")}</label>
                            <select
                              value={catalogConfig.docLogoPosition}
                              onChange={(e) => setCatalogConfig((p) => ({ ...p, docLogoPosition: e.target.value as CatalogConfig["docLogoPosition"] }))}
                              className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs"
                            >
                              <option value="left">{tx("左", "Izquierda")}</option>
                              <option value="right">{tx("右", "Derecha")}</option>
                              <option value="center">{tx("中", "Centro")}</option>
                              <option value="top">{tx("上", "Arriba")}</option>
                              <option value="bottom">{tx("下", "Abajo")}</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 p-2.5 lg:grid-cols-2">
                    <section>
                      <h4 className="text-xs font-semibold text-slate-900">{tx("D. 渠道设置", "D. Canales")}</h4>
                      <p className="mt-0.5 text-[10px] text-slate-500">{tx("启用类控件统一使用 Switch。", "Los controles de canal usan switch.")}</p>
                      <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
                        {renderSwitch(tx("启用 WhatsApp", "Activar WhatsApp"), catalogConfig.docShowWhatsapp, (next) => setCatalogConfig((p) => ({ ...p, docShowWhatsapp: next })))}
                        {renderSwitch(tx("启用微信", "Activar WeChat"), catalogConfig.docShowWechat, (next) => setCatalogConfig((p) => ({ ...p, docShowWechat: next })))}
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xs font-semibold text-slate-900">{tx("E. 适用文档与支持级别", "E. Documentos y soporte")}</h4>
                      <p className="mt-0.5 text-[10px] text-slate-500">{tx("不同文档类型支持级别不同。", "Cada tipo de documento tiene distinto nivel de soporte.")}</p>
                      <div className="mt-1.5 space-y-1 text-[11px] text-slate-600">
                        <div className="grid grid-cols-[1fr_auto] items-center rounded border border-slate-100 px-2 py-1"><span>{tx("客户产品清单 PDF", "PDF catalogo cliente")}</span><span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] text-emerald-700">{tx("完整支持", "Completo")}</span></div>
                        <div className="grid grid-cols-[1fr_auto] items-center rounded border border-slate-100 px-2 py-1"><span>{tx("表格导出", "Exportacion tabla")}</span><span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">{tx("部分支持", "Parcial")}</span></div>
                        <div className="grid grid-cols-[1fr_auto] items-center rounded border border-slate-100 px-2 py-1"><span>{tx("Excel 导出", "Exportacion Excel")}</span><span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">{tx("部分支持", "Parcial")}</span></div>
                        <div className="grid grid-cols-[1fr_auto] items-center rounded border border-slate-100 px-2 py-1"><span>{tx("内部打印表", "Tabla interna")}</span><span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{tx("暂未支持", "No disponible")}</span></div>
                        <div className="grid grid-cols-[1fr_auto] items-center rounded border border-slate-100 px-2 py-1"><span>{tx("其他模板", "Otras plantillas")}</span><span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{tx("后续扩展", "Reservado")}</span></div>
                      </div>
                    </section>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-2.5 py-2">
                    <span className="text-[10px] text-slate-500">{tx("保存后将用于文档导出配置。", "Guardar para aplicar en exportacion de documentos.")}</span>
                    <button
                      type="button"
                      disabled={!canManageProducts}
                      onClick={() => void saveCatalog()}
                      className="inline-flex h-9 min-w-[168px] items-center justify-center rounded-md bg-primary px-4 text-xs font-semibold text-white shadow-soft transition hover:brightness-95 disabled:opacity-40"
                    >
                      {tx("保存文档设置", "Guardar ajustes")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
