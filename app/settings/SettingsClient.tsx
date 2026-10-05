"use client";

import NextImage from "next/image";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, Eye, MapPin, Paperclip, Pencil, Trash2, X } from "lucide-react";
import { ImageLightbox } from "@/components/image-lightbox";
import { getClientLang } from "@/lib/lang-client";
import { CustomerPermissionsClient } from "@/app/admin/customer-permissions/CustomerPermissionsClient";

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
  currentUserId?: string;
  currentPermissions: PermissionState;
  initialTab?: TabKey;
  visibleTabs?: TabKey[];
  canManageAppPermissions?: boolean;
  canViewInviteCodes?: boolean;
  canManageInviteCodes?: boolean;
};

type TabKey = "perm" | "supplier" | "customer" | "category" | "doc";

type UserPermissionRow = {
  id: string;
  name: string;
  phone: string;
  role: "admin" | "worker";
  permissions: PermissionState;
};

type ManagedUserRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  avatar_url: string | null;
  role: "admin" | "worker";
  active: boolean;
  created_at: string;
};

type ManagedUserForm = {
  id: string;
  name: string;
  phone: string;
  email: string;
  password: string;
  role: "admin" | "worker";
  active: boolean;
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
  discount: string;
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
    payableAmountText?: string;
    packingAmountText?: string;
    shippedAtText?: string;
    paidAtText?: string;
    paymentTermText?: string;
    latestStatus: string;
    isVoided?: boolean;
    paymentRows?: Array<{
      id: string;
      paymentAmountText: string;
      paymentTimeText: string;
      paymentMethodText: string;
      paymentTargetText: string;
      noteText: string;
    }>;
  }>;
  manualOrderRecords?: Array<{
    id: string;
    customerName: string;
    customerProfileId?: string;
    ygOrderNo: string;
    externalOrderNo: string;
    orderChannel: string;
    isVoided?: boolean;
    billingAmountOverrideText?: string;
    packingAmountText: string;
    shippedAtText: string;
    paidAtText: string;
    paymentTermText: string;
    paymentRows?: Array<{
      id: string;
      paymentAmountText: string;
      paymentTimeText: string;
      paymentMethodText: string;
      paymentTargetText: string;
      noteText: string;
    }>;
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
  billingAmountOverride: string;
  packingAmount: string;
  ygShippedAt: string;
  shippedAt: string;
  paidAt: string;
  paymentTermDays: string;
};

type DetailRowEditForm = ManualOrderForm & {
  displayOrderNo: string;
  displayOrderNoField: "ygOrderNo" | "externalOrderNo";
};

type PaymentRowEditForm = {
  id: string;
  payableAmount: string;
  currentPaymentAmount: string;
  paymentTime: string;
  paymentMethod: string;
  paymentTarget: string;
  note: string;
};

type DetailCustomerInfoForm = {
  id: string;
  sourceType: "profile" | "yg" | "manual";
  linkedYgName: string;
  name: string;
  contact: string;
  phone: string;
  stores: string;
  cityCountry: string;
  paymentTermText: string;
};

type PaymentEvidenceItem = {
  name: string;
  url: string;
  sizeBytes?: number;
  uploadedAt?: string;
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
  payableAmountText: string;
  paidAmountText: string;
  unpaidAmountText: string;
  dueDateText: string;
  isVoided?: boolean;
  statusKey: PaymentStatusKey;
  paymentRows: Array<{
    id: string;
    sourceType: "yg" | "manual";
    payableAmountText: string;
    currentPaymentAmountText: string;
    paidAmountText: string;
    paymentTimeText: string;
    paymentMethodText: string;
    paymentTargetText: string;
    unpaidAmountText: string;
    noteText: string;
  }>;
};

type PaymentStatusKey = "paid" | "partial" | "overdue" | "unpaid" | "voided";

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

const EMPTY_MANAGED_USER_FORM: ManagedUserForm = {
  id: "",
  name: "",
  phone: "",
  email: "",
  password: "",
  role: "worker",
  active: true,
};

function SupplierLogoThumb({
  src,
  alt,
  emptyText,
  className,
}: {
  src?: string;
  alt: string;
  emptyText: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const safeSrc = String(src || "").trim();
  useEffect(() => {
    setFailed(false);
  }, [safeSrc]);
  const showImage = Boolean(safeSrc) && !failed;
  return (
    <div className={className}>
      {showImage ? (
        <img
          src={safeSrc}
          alt={alt}
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="text-[10px] font-medium text-slate-400">{emptyText}</span>
      )}
    </div>
  );
}

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
  billingAmountOverride: "",
  packingAmount: "",
  ygShippedAt: "",
  shippedAt: "",
  paidAt: "",
  paymentTermDays: "",
};

const EMPTY_DETAIL_ROW_EDIT_FORM: DetailRowEditForm = {
  ...EMPTY_MANUAL_ORDER_FORM,
  displayOrderNo: "",
  displayOrderNoField: "externalOrderNo",
};

const EMPTY_PAYMENT_ROW_EDIT_FORM: PaymentRowEditForm = {
  id: "",
  payableAmount: "",
  currentPaymentAmount: "",
  paymentTime: "",
  paymentMethod: "",
  paymentTarget: "",
  note: "",
};

const EMPTY_DETAIL_CUSTOMER_INFO_FORM: DetailCustomerInfoForm = {
  id: "",
  sourceType: "manual",
  linkedYgName: "",
  name: "",
  contact: "",
  phone: "",
  stores: "",
  cityCountry: "",
  paymentTermText: "",
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

function getCustomerDisplayName(item: Customer) {
  return String(item.name || "").trim() || String(item.linkedYgName || "").trim() || "-";
}

function getEditedRealNameMergeKey(item: Customer) {
  const realNameKey = normalizeCustomerMergeValue(item.name);
  if (!realNameKey) return "";
  if (item.sourceType === "profile" || item.sourceType === "manual") {
    return realNameKey;
  }
  const linkedNameKey = normalizeCustomerMergeValue(item.linkedYgName);
  return linkedNameKey && linkedNameKey !== realNameKey ? realNameKey : "";
}

function buildCustomerRealNameAliasMap(items: Customer[]) {
  const aliasMap = new Map<string, string>();
  for (const item of items) {
    const realNameKey = getEditedRealNameMergeKey(item);
    if (!realNameKey) continue;
    const linkedNameKey = normalizeCustomerMergeValue(item.linkedYgName);
    if (linkedNameKey && linkedNameKey !== realNameKey) {
      aliasMap.set(linkedNameKey, realNameKey);
    }
  }
  return aliasMap;
}

function buildCustomerMergeKey(item: Customer, aliasMap?: Map<string, string>) {
  const editedRealNameKey = getEditedRealNameMergeKey(item);
  if (editedRealNameKey) return `real:${editedRealNameKey}`;
  const aliasedRealName =
    aliasMap?.get(normalizeCustomerMergeValue(item.name))
    || aliasMap?.get(normalizeCustomerMergeValue(item.linkedYgName));
  if (aliasedRealName) return `real:${aliasedRealName}`;
  const nameKey = normalizeCustomerMergeValue(item.name) || normalizeCustomerMergeValue(item.linkedYgName);
  if (nameKey) return `name:${nameKey}`;
  return [
    normalizeCustomerMergeValue(item.contact),
    normalizeCustomerMergeValue(item.phone),
  ]
    .filter(Boolean)
    .join("|");
}

function mergeTwoCustomerRows(existing: Customer, item: Customer) {
  const existingDetailMap = new Map<string, CustomerDetailRow>();
  for (const row of existing.detailRows || []) {
    const detailKey = [String(row.orderNo || "").trim().toLowerCase(), String(row.orderAmountText || "").trim()].join("|");
    if (detailKey !== "|") {
      existingDetailMap.set(detailKey, row);
    }
  }
  for (const row of item.detailRows || []) {
    const detailKey = [String(row.orderNo || "").trim().toLowerCase(), String(row.orderAmountText || "").trim()].join("|");
    if (detailKey !== "|" && !existingDetailMap.has(detailKey)) {
      existingDetailMap.set(detailKey, row);
    }
  }
  const mergedDetailRows = Array.from(existingDetailMap.values()).sort((left, right) =>
    String(right.orderDateText || "").localeCompare(String(left.orderDateText || ""), "zh-CN"),
  );
  const manualRecordMap = new Map<string, NonNullable<Customer["manualOrderRecords"]>[number]>();
  for (const row of [...(existing.manualOrderRecords || []), ...(item.manualOrderRecords || [])]) {
    const manualKey = String(row.id || "").trim() || [
      String(row.ygOrderNo || "").trim().toLowerCase(),
      String(row.externalOrderNo || "").trim().toLowerCase(),
      String(row.orderChannel || "").trim().toLowerCase(),
      String(row.packingAmountText || "").trim(),
    ].join("|");
    if (!manualKey || manualRecordMap.has(manualKey)) continue;
    manualRecordMap.set(manualKey, row);
  }
  const mergedManualRows = Array.from(manualRecordMap.values()).sort((left, right) =>
    String(right.shippedAtText || right.paidAtText || "").localeCompare(String(left.shippedAtText || left.paidAtText || ""), "zh-CN"),
  );
  const totalOrderAmount = mergedDetailRows.reduce(
    (sum, row) => sum + Number(row.orderAmountText || 0),
    0,
  );
  const channelSet = new Set<string>();
  for (const row of mergedDetailRows) {
    channelSet.add("友购");
  }
  for (const row of mergedManualRows) {
    const channel = normalizeCustomerChannelLabel(row.orderChannel || "");
    if (channel) channelSet.add(channel);
  }
  const mergedOrderCountKeys = new Set<string>();
  for (const row of mergedDetailRows) {
    const key = String(row.orderNo || "").trim().toLowerCase() || [`detail`, String(row.orderDateText || "").trim(), String(row.orderAmountText || "").trim()].join("|");
    if (key) mergedOrderCountKeys.add(key);
  }
  for (const row of mergedManualRows) {
    const key =
      String(row.ygOrderNo || "").trim().toLowerCase()
      || String(row.externalOrderNo || "").trim().toLowerCase()
      || [`manual`, String(row.orderChannel || "").trim().toLowerCase(), String(row.shippedAtText || row.paidAtText || "").trim(), String(row.packingAmountText || "").trim()].join("|");
    if (key) mergedOrderCountKeys.add(key);
  }
  const profileRow =
    existing.sourceType === "profile" ? existing : item.sourceType === "profile" ? item : null;
  const manualProfileRow =
    existing.sourceType === "manual" ? existing : item.sourceType === "manual" ? item : null;
  const ygRow =
    existing.sourceType === "yg" ? existing : item.sourceType === "yg" ? item : null;
  const preferredRow = pickPreferredCustomerRow(existing, item);
  const persistedRow = profileRow || manualProfileRow;

  return {
    ...preferredRow,
    name:
      profileRow?.name
      || manualProfileRow?.name
      || preferredRow.name
      || existing.name
      || item.name
      || ygRow?.name
      || "",
    linkedYgName:
      existing.linkedYgName ||
      item.linkedYgName ||
      ygRow?.linkedYgName ||
      ygRow?.name ||
      "",
    contact: persistedRow?.contact || preferredRow.contact || ygRow?.contact || existing.contact || item.contact || "",
    phone: persistedRow?.phone || preferredRow.phone || ygRow?.phone || existing.phone || item.phone || "",
    whatsapp: persistedRow?.whatsapp || preferredRow.whatsapp || ygRow?.whatsapp || existing.whatsapp || item.whatsapp || "",
    email: persistedRow?.email || preferredRow.email || ygRow?.email || existing.email || item.email || "",
    stores: persistedRow?.stores || preferredRow.stores || existing.stores || item.stores || "",
    cityCountry: persistedRow?.cityCountry || preferredRow.cityCountry || ygRow?.cityCountry || existing.cityCountry || item.cityCountry || "",
    customerType: persistedRow?.customerType || preferredRow.customerType || existing.customerType || item.customerType || "",
    vipLevel: persistedRow?.vipLevel || preferredRow.vipLevel || existing.vipLevel || item.vipLevel || "",
    creditLevel: persistedRow?.creditLevel || preferredRow.creditLevel || existing.creditLevel || item.creditLevel || "",
    paymentTermText:
      persistedRow?.paymentTermText ||
      preferredRow.paymentTermText ||
      ygRow?.paymentTermText ||
      existing.paymentTermText ||
      item.paymentTermText ||
      "",
    tags: persistedRow?.tags || preferredRow.tags || existing.tags || item.tags || "",
    channelText: Array.from(channelSet).join(" / ") || normalizeCustomerChannelLabel(preferredRow.channelText || existing.channelText || item.channelText || ""),
    orderStats: String(mergedOrderCountKeys.size || ygRow?.orderStats || profileRow?.orderStats || existing.orderStats || item.orderStats || ""),
    detailRows: mergedDetailRows,
    manualOrderRecords: mergedManualRows,
    totalOrderCount: mergedOrderCountKeys.size,
    totalOrderAmountText: totalOrderAmount.toFixed(2),
    packingAmountText: "",
  };
}

function mergeCustomerRows(items: Customer[]) {
  const mergedByExactKey = new Map<string, Customer>();
  const realNameAliasMap = buildCustomerRealNameAliasMap(items);

  for (const item of items) {
    const mergeKey = buildCustomerMergeKey(item, realNameAliasMap) || `${item.sourceType || "profile"}:${item.id}`;
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

function mergeTimelineRows(primary: CustomerTimelineRow, secondary: CustomerTimelineRow): CustomerTimelineRow {
  const paymentMap = new Map<string, CustomerTimelineRow["paymentRows"][number]>();
  for (const row of [...(primary.paymentRows || []), ...(secondary.paymentRows || [])]) {
    const key = String(row.id || `${row.paymentTimeText}:${row.currentPaymentAmountText}:${row.noteText}`);
    if (!paymentMap.has(key)) {
      paymentMap.set(key, row);
    }
  }
  return {
    ...primary,
    orderDateText: primary.orderDateText || secondary.orderDateText,
    orderAmountText: primary.orderAmountText || secondary.orderAmountText,
    channelText: primary.channelText || secondary.channelText,
    packingAmountText: primary.packingAmountText || secondary.packingAmountText,
    shippedAtText: primary.shippedAtText || secondary.shippedAtText,
    payableAmountText: primary.payableAmountText || secondary.payableAmountText,
    paidAmountText: primary.paidAmountText || secondary.paidAmountText,
    unpaidAmountText: primary.unpaidAmountText || secondary.unpaidAmountText,
    dueDateText: primary.dueDateText || secondary.dueDateText,
    isVoided: primary.isVoided || secondary.isVoided,
    statusKey: primary.statusKey || secondary.statusKey,
    paymentRows: Array.from(paymentMap.values()),
  };
}

function isVipCustomer(item: Customer) {
  return Number(item.totalOrderAmountText || 0) >= 100000;
}

function getCustomerChannelLabel(item: Customer, t: (zh: string, es: string) => string) {
  return normalizeCustomerChannelLabel(item.channelText || "") || (item.sourceType === "manual" ? "-" : t("友购", "Yogo"));
}

function VipBadgeIcon() {
  return (
    <NextImage src="/icons/vip.svg" alt="" aria-hidden="true" width={18} height={18} className="h-[18px] w-[18px] shrink-0" />
  );
}

function normalizeStoreNumberInput(value: string) {
  return value
    .replace(/[\r\n]+/g, ",")
    .replace(/，/g, ",")
    .replace(/\s+/g, ",")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .join(",");
}

function mapSearchUrl(address: string) {
  const text = (address || "").trim();
  if (!text) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
}

function parseAmountValue(value: unknown) {
  const amount = Number(String(value || "").replace(/[^0-9.-]/g, "").trim() || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function parseLooseDate(value: string) {
  const text = String(value || "").trim();
  if (!text || text === "-") return null;
  const normalized = text.replace(/[.]/g, "-").replace(/\//g, "-");
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDateValue(date: Date | null) {
  if (!date || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

function buildDueDateText(baseDateText: string, paymentTermText: string) {
  const baseDate = parseLooseDate(baseDateText);
  const termDays = Number.parseInt(String(paymentTermText || "").replace(/[^\d-]/g, ""), 10);
  if (!baseDate || !Number.isFinite(termDays)) return "";
  const dueDate = new Date(baseDate);
  // Billing term starts on the day after shipment.
  // Example: shipped 2026/01/01 with 30 days term => due 2026/02/01.
  dueDate.setDate(dueDate.getDate() + termDays + 1);
  return formatDateValue(dueDate);
}

function buildPaymentStatus(params: {
  payableAmountText: string;
  paidAmountText: string;
  dueDateText: string;
  isVoided?: boolean;
}) {
  if (params.isVoided) {
    return {
      statusKey: "voided" as PaymentStatusKey,
      paidAmountText: "0.00",
      unpaidAmountText: "0.00",
    };
  }
  const payable = parseAmountValue(params.payableAmountText);
  const paid = parseAmountValue(params.paidAmountText);
  const unpaid = Math.max(payable - paid, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = parseLooseDate(params.dueDateText);
  const isOverdue = unpaid > 0 && Boolean(dueDate) && (dueDate?.getTime() || 0) < today.getTime();
  let statusKey: PaymentStatusKey = "unpaid";
  if (payable > 0 && unpaid <= 0) {
    statusKey = "paid";
  } else if (paid > 0 && unpaid > 0) {
    statusKey = "partial";
  } else if (isOverdue) {
    statusKey = "overdue";
  }
  return {
    statusKey,
    paidAmountText: paid > 0 ? paid.toFixed(2) : "",
    unpaidAmountText: unpaid > 0 ? unpaid.toFixed(2) : payable > 0 && statusKey === "paid" ? "0.00" : "",
  };
}

function getPaymentStatusLabel(statusKey: PaymentStatusKey, t: (zh: string, es: string) => string) {
  switch (statusKey) {
    case "voided":
      return t("作废", "Anulado");
    case "paid":
      return t("已结清", "Liquidado");
    case "partial":
      return t("部分付款", "Parcial");
    case "overdue":
      return t("逾期未结", "Vencido");
    default:
      return t("未付款", "Sin pago");
  }
}

function getOverdueLabel(count: number, t: (zh: string, es: string) => string) {
  if (count <= 0) return t("无", "No");
  if (count === 1) return t("1笔", "1");
  if (count === 2) return t("2笔", "2");
  return t("3笔+", "3+");
}

function getCustomerCreditLevelDisplay(
  rawValue: string,
  debtAmountText: string,
  overdueCount: number,
) {
  const normalized = String(rawValue || "").trim().toUpperCase();
  if (/^[A-E]$/.test(normalized)) return normalized;
  const debtAmount = parseAmountValue(debtAmountText);
  if (overdueCount >= 3) return "E";
  if (overdueCount === 2) return "D";
  if (overdueCount === 1) return "C";
  if (debtAmount > 0) return "B";
  return "A";
}

function getStatusTone(statusKey: PaymentStatusKey) {
  switch (statusKey) {
    case "voided":
      return "border-slate-300 bg-slate-100 text-slate-600";
    case "paid":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "partial":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "overdue":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function normalizeCustomerChannelLabel(value: string) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  if (["友购", "yogo"].includes(normalized)) return "友购";
  if (["微信", "wechat"].includes(normalized)) return "微信";
  if (["whatsapp", "what's app"].includes(normalized)) return "WhatsApp";
  return "";
}

function buildComputedPaymentRows(
  sourceType: "yg" | "manual",
  payableAmountText: string,
  rows: Array<{
    id: string;
    paymentAmountText?: string;
    paymentTimeText?: string;
    paymentMethodText?: string;
    paymentTargetText?: string;
    noteText?: string;
  }>,
) {
  const payable = parseAmountValue(payableAmountText);
  let cumulativePaid = 0;
  return rows.map((row) => {
    const currentPayment = parseAmountValue(row.paymentAmountText);
    cumulativePaid += currentPayment;
    const paidAmountText = cumulativePaid > 0 ? cumulativePaid.toFixed(2) : "";
    const unpaidAmount = Math.max(payable - cumulativePaid, 0);
    return {
      id: row.id,
      sourceType,
      payableAmountText: payable > 0 ? payable.toFixed(2) : "",
      currentPaymentAmountText: currentPayment > 0 ? currentPayment.toFixed(2) : "",
      paidAmountText,
      paymentTimeText: row.paymentTimeText || "",
      paymentMethodText: row.paymentMethodText || "",
      paymentTargetText: row.paymentTargetText || "",
      unpaidAmountText: payable > 0 ? unpaidAmount.toFixed(2) : "",
      noteText: row.noteText || "",
    };
  });
}

function buildCustomerTimelineRows(
  customer: Customer | null | undefined,
  customerDetailDateSort: "asc" | "desc",
  tx: (zh: string, es: string) => string,
) {
  const orderRows = (customer?.detailRows || []).map((row) => {
    const dueDateText = buildDueDateText(row.shippedAtText || row.orderDateText || "", row.paymentTermText || "");
    const computedPaymentRows = buildComputedPaymentRows("yg", row.payableAmountText || "", row.paymentRows || []);
    const latestPaymentRow = computedPaymentRows[computedPaymentRows.length - 1];
    const paymentState = buildPaymentStatus({
      payableAmountText: row.payableAmountText || "",
      paidAmountText: latestPaymentRow?.paidAmountText || "",
      dueDateText,
      isVoided: Boolean(row.isVoided),
    });
    return {
      id: `detail:${row.orderNo}`,
      sourceType: "yg" as const,
      manualRecordId: row.overlayRecordId || "",
      orderNo: row.orderNo,
      orderDateText: row.orderDateText,
      orderAmountText: row.orderAmountText,
      channelText: "友购",
      packingAmountText: row.packingAmountText || "",
      shippedAtText: row.shippedAtText || "",
      payableAmountText: row.payableAmountText || "",
      paidAmountText: latestPaymentRow?.paidAmountText || paymentState.paidAmountText,
      unpaidAmountText: latestPaymentRow?.unpaidAmountText || paymentState.unpaidAmountText,
      dueDateText,
      isVoided: Boolean(row.isVoided),
      statusKey: paymentState.statusKey,
      paymentRows: row.isVoided ? [] : computedPaymentRows,
    };
  });

  const manualRows = (customer?.manualOrderRecords || []).map((row) => {
    const payableAmountText = row.packingAmountText || "";
    const dueDateText = buildDueDateText(row.shippedAtText || "", row.paymentTermText || "");
    const computedPaymentRows = buildComputedPaymentRows("manual", payableAmountText, row.paymentRows || []);
    const latestPaymentRow = computedPaymentRows[computedPaymentRows.length - 1];
    const paymentState = buildPaymentStatus({
      payableAmountText,
      paidAmountText: latestPaymentRow?.paidAmountText || "",
      dueDateText,
      isVoided: Boolean(row.isVoided),
    });
    return {
      id: `manual:${row.id}`,
      sourceType: "manual" as const,
      manualRecordId: row.id,
      orderNo: row.ygOrderNo || row.externalOrderNo || "-",
      orderDateText: row.shippedAtText || row.paidAtText || "-",
      orderAmountText: "",
      channelText: normalizeCustomerChannelLabel(row.orderChannel || ""),
      packingAmountText: row.packingAmountText || "",
      shippedAtText: row.shippedAtText || "",
      payableAmountText,
      paidAmountText: latestPaymentRow?.paidAmountText || paymentState.paidAmountText,
      unpaidAmountText: latestPaymentRow?.unpaidAmountText || paymentState.unpaidAmountText,
      dueDateText,
      isVoided: Boolean(row.isVoided),
      statusKey: paymentState.statusKey,
      paymentRows: row.isVoided ? [] : computedPaymentRows,
    };
  });

  const dedupedRows = new Map<string, CustomerTimelineRow>();
  for (const row of [...orderRows, ...manualRows]) {
    const orderKey = String(row.orderNo || "").trim().toLowerCase();
    const mapKey = orderKey && orderKey !== "-" ? orderKey : row.id;
    const existing = dedupedRows.get(mapKey);
    if (!existing) {
      dedupedRows.set(mapKey, row);
      continue;
    }
    if (existing.sourceType === "yg" && row.sourceType !== "yg") {
      dedupedRows.set(mapKey, mergeTimelineRows(existing, row));
      continue;
    }
    if (row.sourceType === "yg" && existing.sourceType !== "yg") {
      dedupedRows.set(mapKey, mergeTimelineRows(row, existing));
      continue;
    }
    dedupedRows.set(mapKey, mergeTimelineRows(existing, row));
  }

  return Array.from(dedupedRows.values()).sort((left, right) => {
    const compareResult = String(left.orderDateText || "").localeCompare(String(right.orderDateText || ""), "zh-CN");
    return customerDetailDateSort === "asc" ? compareResult : -compareResult;
  });
}

function ReadonlyCustomerField({ value, centered = false, children }: { value?: string; centered?: boolean; children?: ReactNode }) {
  return (
    <div className={`flex h-11 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-xs font-normal text-slate-700 ${centered ? "justify-center text-center" : ""}`}>
      {children ?? (String(value || "").trim() || "-")}
    </div>
  );
}

function PlainCustomerValue({ value, centered = false, children }: { value?: string; centered?: boolean; children?: ReactNode }) {
  return (
    <div className={`flex h-11 items-center rounded-2xl px-1 text-xs font-normal text-slate-700 ${centered ? "justify-center text-center" : ""}`}>
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
        discount: String(item?.discount ?? item?.normalDiscount ?? item?.vipDiscount ?? "").trim(),
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
        discount: String(item.discount || "").trim(),
      }))
      .filter((item) => item.category),
  );
}

function formatSupplierDiscountInput(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const numeric = raw.replace(/[^\d.]/g, "");
  if (!numeric) return "";
  const parsed = Number(numeric);
  if (!Number.isFinite(parsed)) return "";
  const normalized = Number.isInteger(parsed) ? String(parsed) : String(parsed);
  return `${normalized}%`;
}

function formatSupplierDiscountSummary(rules: SupplierDiscountRule[]) {
  return rules
    .map((item) => formatSupplierDiscountInput(item.discount))
    .filter(Boolean)
    .join("，");
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

function paymentEvidenceLooksLikeImage(item: { name?: string; url?: string }) {
  const target = `${item.name || ""} ${item.url || ""}`.toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic|heif)(\?|$)/i.test(target);
}

function PaymentMethodSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none"
    >
      <option value="">-</option>
      <option value="转账">转账</option>
      <option value="现金">现金</option>
    </select>
  );
}

function PaymentTargetSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none"
    >
      <option value="">-</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

export function SettingsClient({
  isAdmin,
  currentUserId = "",
  currentPermissions,
  initialTab = "perm",
  visibleTabs,
  canManageAppPermissions = false,
  canViewInviteCodes = false,
  canManageInviteCodes = false,
}: SettingsClientProps) {
  const SUPPLIER_PAGE_SIZE = 10;
  const SUPPLIER_PRODUCT_PREVIEW_PAGE_SIZE = 12;
  const CUSTOMER_PAGE_SIZE = 14;
  const CUSTOMER_DETAIL_PAGE_SIZE = 4;
  const CUSTOMER_PAYMENT_PAGE_SIZE = 5;
  const [lang, setLang] = useState<"zh" | "es">("zh");
  const allowedTabs = visibleTabs && visibleTabs.length > 0 ? TAB_LIST.filter((item) => visibleTabs.includes(item)) : TAB_LIST;
  const singleCustomerTabView = allowedTabs.length === 1 && allowedTabs[0] === "customer";
  const [tab, setTab] = useState<TabKey>(allowedTabs.includes(initialTab) ? initialTab : allowedTabs[0] || "perm");
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
  const [supplierRuleDraft, setSupplierRuleDraft] = useState({
    open: false,
    category: "",
    discount: "",
    saving: false,
  });
  const [supplierDiscountPreview, setSupplierDiscountPreview] = useState<{
    open: boolean;
    supplierName: string;
    rules: SupplierDiscountRule[];
  }>({
    open: false,
    supplierName: "",
    rules: [],
  });
  const [userManagerOpen, setUserManagerOpen] = useState(false);
  const [managedUsers, setManagedUsers] = useState<ManagedUserRow[]>([]);
  const [managedUserLoading, setManagedUserLoading] = useState(false);
  const [managedUserSaving, setManagedUserSaving] = useState(false);
  const [managedUserEditorOpen, setManagedUserEditorOpen] = useState(false);
  const [managedUserForm, setManagedUserForm] = useState<ManagedUserForm>(EMPTY_MANAGED_USER_FORM);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [manualOrderOpen, setManualOrderOpen] = useState(false);
  const [manualOrderForm, setManualOrderForm] = useState<ManualOrderForm>(EMPTY_MANUAL_ORDER_FORM);
  const [customerSummary, setCustomerSummary] = useState<CustomerSummary>({ totalOrderCount: 0, totalOrderAmountText: "0.00" });
  const [customerKeyword, setCustomerKeyword] = useState("");
  const [customerVipFilter, setCustomerVipFilter] = useState<"all" | "vip" | "normal">("all");
  const [customerSettlementFilter, setCustomerSettlementFilter] = useState<"all" | "settled" | "unsettled">("all");
  const [customerPage, setCustomerPage] = useState(1);
  const [customerForm, setCustomerForm] = useState<Customer>(EMPTY_CUSTOMER);
  const [customerEditorOpen, setCustomerEditorOpen] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerSearchResults, setCustomerSearchResults] = useState<CustomerSearchItem[]>([]);
  const [customerDetailId, setCustomerDetailId] = useState("");
  const [customerDetailPage, setCustomerDetailPage] = useState(1);
  const [customerPaymentDetailId, setCustomerPaymentDetailId] = useState("");
  const [customerPaymentPage, setCustomerPaymentPage] = useState(1);
  const [customerDetailDateSort, setCustomerDetailDateSort] = useState<"desc" | "asc">("desc");
  const [detailEditingRowId, setDetailEditingRowId] = useState("");
  const [detailRowEditForm, setDetailRowEditForm] = useState<DetailRowEditForm>(EMPTY_DETAIL_ROW_EDIT_FORM);
  const [paymentEditingRowId, setPaymentEditingRowId] = useState("");
  const [paymentRowEditForm, setPaymentRowEditForm] = useState<PaymentRowEditForm>(EMPTY_PAYMENT_ROW_EDIT_FORM);
  const [paymentEvidencePreview, setPaymentEvidencePreview] = useState<{ src: string; title: string } | null>(null);
  const [detailCustomerInfoForm, setDetailCustomerInfoForm] = useState<DetailCustomerInfoForm>(EMPTY_DETAIL_CUSTOMER_INFO_FORM);
  const [detailCustomerInfoEditOpen, setDetailCustomerInfoEditOpen] = useState(false);
  const [savingDetailCustomerInfo, setSavingDetailCustomerInfo] = useState(false);
  const paymentEvidenceInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [paymentEvidenceItems, setPaymentEvidenceItems] = useState<Record<string, PaymentEvidenceItem[]>>({});
  const [uploadingPaymentEvidenceRowId, setUploadingPaymentEvidenceRowId] = useState("");
  const manualOrderEditorMode = manualOrderForm.sourceType;
  const manualOrderAutoBillingAmount = useMemo(() => {
    const orderKey = String(manualOrderForm.ygOrderNo || "").trim().toLowerCase();
    if (!orderKey) return "";
    for (const customer of customers) {
      for (const row of customer.detailRows || []) {
        if (String(row.orderNo || "").trim().toLowerCase() !== orderKey) continue;
        return String(row.payableAmountText || "").trim();
      }
    }
    return "";
  }, [customers, manualOrderForm.ygOrderNo]);
  const manualOrderBillingAmountValue = manualOrderForm.billingAmountOverride || manualOrderAutoBillingAmount;

  const [catalogConfig, setCatalogConfig] = useState<CatalogConfig>(EMPTY_CATALOG);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [categoryMaps, setCategoryMaps] = useState<CategoryMap[]>([]);
  const [categoryKeyword, setCategoryKeyword] = useState("");
  const [categoryForm, setCategoryForm] = useState<CategoryMapForm>(EMPTY_CATEGORY_MAP);
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
    if (!allowedTabs.includes(tab)) {
      setTab(allowedTabs[0] || "perm");
    }
  }, [allowedTabs, tab]);

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

      if (!cRes.ok || !cJson?.ok) {
        throw new Error(cJson?.error || tx("客户财务加载失败", "Customer finance load failed"));
      }

      if (pRes.ok && pJson?.ok) setPermissionRows(pJson.items || []);
      if (sRes.ok && sJson?.ok) {
        setSuppliers(
          (sJson.items || []).map((item: any) => ({
            ...item,
            discountRules: parseSupplierDiscountRules(String(item.discountRule || "")),
          })),
        );
      }
      setCustomers(cJson.items || []);
      setCustomerSummary({
        totalOrderCount: Number(cJson.summary?.totalOrderCount || 0),
        totalOrderAmountText: String(cJson.summary?.totalOrderAmountText || "0.00"),
      });
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

  async function loadManagedUsers() {
    try {
      setManagedUserLoading(true);
      setError("");
      const res = await fetch("/api/admin/users");
      const json = await readJson<any>(res);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || tx("账号加载失败", "User load fail"));
      }
      setManagedUsers(json.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("账号加载失败", "User load fail"));
    } finally {
      setManagedUserLoading(false);
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

  function openUserManager() {
    setUserManagerOpen(true);
    void loadManagedUsers();
  }

  function openManagedUserEditor(user?: ManagedUserRow) {
    setManagedUserForm(
      user
        ? {
            id: user.id,
            name: user.name,
            phone: user.phone,
            email: user.email || "",
            password: "",
            role: user.role,
            active: user.active,
          }
        : EMPTY_MANAGED_USER_FORM,
    );
    setManagedUserEditorOpen(true);
  }

  function closeManagedUserEditor() {
    setManagedUserEditorOpen(false);
    setManagedUserForm(EMPTY_MANAGED_USER_FORM);
  }

  async function saveManagedUser() {
    try {
      setManagedUserSaving(true);
      setError("");
      const method = managedUserForm.id ? "PATCH" : "POST";
      const res = await fetch("/api/admin/users", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(managedUserForm),
      });
      const json = await readJson<any>(res);
      if (!res.ok || !json?.ok) throw new Error(json?.error || tx("保存用户失败", "Save user fail"));
      const nextUser = json.user;
      setManagedUsers((prev) =>
        managedUserForm.id ? prev.map((item) => (item.id === nextUser.id ? nextUser : item)) : [...prev, nextUser],
      );
      closeManagedUserEditor();
      showSaved(managedUserForm.id ? tx("用户资料已更新", "User updated") : tx("用户已新增", "User created"));
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("保存用户失败", "Save user fail"));
    } finally {
      setManagedUserSaving(false);
    }
  }

  async function deleteManagedUser(id: string) {
    try {
      const confirmed = window.confirm(tx("确定删除这个用户吗", "Confirm delete user?"));
      if (!confirmed) return;
      setError("");
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await readJson<any>(res);
      if (!res.ok || !json?.ok) throw new Error(json?.error || tx("删除用户失败", "Delete user fail"));
      setManagedUsers((prev) => prev.filter((item) => item.id !== id));
      showSaved(tx("用户已删除", "User deleted"));
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("删除用户失败", "Delete user fail"));
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
    return json;
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

  async function refreshCustomersSilently() {
    const res = await fetch("/api/settings/customers");
    const json = await readJsonSafe<any>(res);
    if (!res.ok || !json?.ok) {
      throw new Error(json?.error || tx("加载客户失败", "Load customers fail"));
    }
    const nextItems = json.items || [];
    setCustomers(nextItems);
    setCustomerSummary({
      totalOrderCount: Number(json.summary?.totalOrderCount || 0),
      totalOrderAmountText: String(json.summary?.totalOrderAmountText || "0.00"),
    });
    return nextItems as Customer[];
  }

  async function saveDetailCustomerInfo() {
    try {
      setError("");
      setSavingDetailCustomerInfo(true);
      const saveResult = await saveEntity(
        "/api/settings/customers",
        {
          id:
            detailCustomerInfoForm.sourceType === "profile" || detailCustomerInfoForm.sourceType === "manual"
              ? detailCustomerInfoForm.id
              : "",
          sourceType: detailCustomerInfoForm.sourceType,
          linkedYgName: detailCustomerInfoForm.linkedYgName,
          name: detailCustomerInfoForm.name,
          contact: detailCustomerInfoForm.contact,
          phone: detailCustomerInfoForm.phone,
          stores: detailCustomerInfoForm.stores,
          cityCountry: detailCustomerInfoForm.cityCountry,
          paymentTermText: detailCustomerInfoForm.paymentTermText,
        },
        "客户已保存",
        "Cli saved",
      );
      const nextItems = await refreshCustomersSilently();
      const nextMerged = mergeCustomerRows(nextItems);
      const savedProfileId = String(saveResult?.id || "").trim();
      const nextDetailCustomer =
        nextMerged.find((item) => savedProfileId && item.id === savedProfileId)
        || nextMerged.find((item) => detailCustomerInfoForm.id && item.id === detailCustomerInfoForm.id)
        || nextMerged.find((item) =>
          item.name === detailCustomerInfoForm.name
          && item.linkedYgName === detailCustomerInfoForm.linkedYgName
          && item.contact === detailCustomerInfoForm.contact
          && item.phone === detailCustomerInfoForm.phone,
        )
        || nextMerged.find((item) =>
          item.name === detailCustomerInfoForm.name
          && item.contact === detailCustomerInfoForm.contact
          && item.phone === detailCustomerInfoForm.phone,
        )
        || null;
      if (nextDetailCustomer?.id) {
        setCustomerDetailId(nextDetailCustomer.id);
        setDetailCustomerInfoForm((prev) => ({
          ...prev,
          id: savedProfileId || nextDetailCustomer.id,
          sourceType: "profile",
        }));
      }
      setDetailCustomerInfoEditOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("保存客户失败", "Save cli fail"));
    } finally {
      setSavingDetailCustomerInfo(false);
    }
  }

  async function exportDetailCustomerFile() {
    if (!detailCustomer) return;

    try {
      setError("");
      const res = await fetch("/api/settings/customers/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: detailCustomer.name || "-",
          linkedYgName: detailCustomerInfoForm.linkedYgName || "-",
          realName: detailCustomerInfoForm.name || "-",
          contact: detailCustomerInfoForm.contact || "-",
          phone: detailCustomerInfoForm.phone || "-",
          stores: detailCustomerInfoForm.stores || "-",
          address: detailCustomerInfoForm.cityCountry || "-",
          vipLevel: isVipCustomer(detailCustomer) ? "VIP" : "-",
          creditLevel: detailCustomerFinanceOverview?.creditLevel || detailCustomer.creditLevel || "-",
          totalOrderCount: Number(detailCustomer.totalOrderCount || 0) > 0 ? String(detailCustomer.totalOrderCount) : "-",
          totalOrderAmountText: detailCustomer.totalOrderAmountText ? `$ ${detailCustomer.totalOrderAmountText}` : "-",
          totalPackingAmountText: hasAnyPackingAmount ? `$ ${detailPackingAmountTotal.toFixed(2)}` : "-",
          orderRows: sortedDetailRows.map((item) => ({
            orderNo: item.orderNo || "-",
            channelText: item.channelText || "-",
            orderDateText: item.orderDateText || "-",
            orderAmountText: item.orderAmountText ? `$ ${item.orderAmountText}` : "-",
            packingAmountText: item.packingAmountText ? `$ ${item.packingAmountText}` : "-",
            shippedAtText: item.shippedAtText || "-",
            remarkText: item.isVoided ? tx("作废", "Void") : "-",
          })),
          paymentRows: sortedDetailRows.flatMap((item) =>
            (item.paymentRows || []).map((paymentRow) => ({
              orderNo: item.orderNo || "-",
              payableAmountText: paymentRow.payableAmountText ? `$ ${paymentRow.payableAmountText}` : "-",
              paidAmountText: paymentRow.paidAmountText ? `$ ${paymentRow.paidAmountText}` : "-",
              paymentTimeText: paymentRow.paymentTimeText || "-",
              paymentMethodText: paymentRow.paymentMethodText || "-",
              paymentTargetText: paymentRow.paymentTargetText || "-",
              unpaidAmountText: paymentRow.unpaidAmountText ? `$ ${paymentRow.unpaidAmountText}` : "-",
              remarkText: paymentRow.noteText || "-",
            })),
          ),
        }),
      });

      if (!res.ok) {
        const json = await readJsonSafe<{ error?: string }>(res);
        throw new Error(json?.error || tx("导出 PDF 失败", "Export PDF fail"));
      }

      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const safeCustomerName = String(detailCustomer.name || "customer-finance").replace(/[\\/:*?"<>|]+/g, "_");
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `${safeCustomerName}-客户财务.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("导出 PDF 失败", "Export PDF fail"));
    }
  }

  async function saveManualOrder() {
    try {
      setError("");
      await saveEntity("/api/settings/customers/manual-orders", manualOrderForm, "记录已保存", "Record saved");
      setManualOrderOpen(false);
      setManualOrderForm(EMPTY_MANUAL_ORDER_FORM);
      await refreshCustomersSilently();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("保存记录失败", "Save record fail"));
    }
  }

  function startInlineRowEdit(input: Partial<DetailRowEditForm> & { rowId: string }) {
    setDetailEditingRowId(input.rowId);
    setDetailRowEditForm({
      ...EMPTY_DETAIL_ROW_EDIT_FORM,
      ...input,
      id: input.id || "",
      sourceType: input.sourceType || "manual",
      customerProfileId: input.customerProfileId || "",
      customerName: input.customerName || "",
      ygOrderNo: input.ygOrderNo || "",
      externalOrderNo: input.externalOrderNo || "",
      orderChannel: input.orderChannel || "",
      billingAmountOverride: input.billingAmountOverride || "",
      packingAmount: input.packingAmount || "",
      ygShippedAt: input.ygShippedAt || input.shippedAt || "",
      shippedAt: input.shippedAt || "",
      paidAt: input.paidAt || "",
      paymentTermDays: input.paymentTermDays || "",
      displayOrderNo: input.displayOrderNo || "",
      displayOrderNoField: input.displayOrderNoField || "externalOrderNo",
    });
  }

  async function saveInlineDetailRow() {
    try {
      setError("");
      const nextPayload: ManualOrderForm = {
        ...detailRowEditForm,
        ygOrderNo: detailRowEditForm.displayOrderNoField === "ygOrderNo" ? detailRowEditForm.displayOrderNo : "",
        externalOrderNo: detailRowEditForm.displayOrderNoField === "externalOrderNo" ? detailRowEditForm.displayOrderNo : "",
        ygShippedAt:
          detailRowEditForm.displayOrderNoField === "ygOrderNo"
            ? (detailRowEditForm.ygShippedAt || detailRowEditForm.shippedAt)
            : "",
      };
      await saveEntity("/api/settings/customers/manual-orders", nextPayload, "记录已保存", "Record saved");
      setDetailEditingRowId("");
      setDetailRowEditForm(EMPTY_DETAIL_ROW_EDIT_FORM);
      await refreshCustomersSilently();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("保存记录失败", "Save record fail"));
    }
  }

  async function voidTimelineRow(row: CustomerTimelineRow) {
    try {
      setError("");
      const detailRow = row.sourceType === "yg"
        ? detailCustomer?.detailRows?.find((item) => item.orderNo === row.orderNo)
        : null;
      const manualRow = row.sourceType === "manual"
        ? detailCustomer?.manualOrderRecords?.find((item) => item.id === row.manualRecordId)
        : null;
      await saveEntity("/api/settings/customers/manual-orders", {
        id: row.sourceType === "yg" ? (detailRow?.overlayRecordId || row.manualRecordId || "") : (manualRow?.id || ""),
        sourceType: row.sourceType,
        customerProfileId:
          row.sourceType === "manual"
            ? (manualRow?.customerProfileId || (detailCustomer?.sourceType === "profile" ? detailCustomer.id : ""))
            : (detailCustomer?.sourceType === "profile" ? detailCustomer.id : ""),
        customerName: row.sourceType === "manual" ? (manualRow?.customerName || detailCustomer?.name || "") : (detailCustomer?.name || ""),
        ygOrderNo: row.sourceType === "yg" ? (row.orderNo || "") : (manualRow?.ygOrderNo || ""),
        externalOrderNo: row.sourceType === "manual" ? (manualRow?.externalOrderNo || "") : "",
        orderChannel: row.sourceType === "yg" ? "友购" : (manualRow?.orderChannel || row.channelText || ""),
        billingAmountOverride: "0.00",
        packingAmount: "0.00",
        ygShippedAt: row.sourceType === "yg" ? (detailRow?.shippedAtText || row.shippedAtText || "") : "",
        shippedAt: row.sourceType === "manual" ? (manualRow?.shippedAtText || row.shippedAtText || "") : (row.shippedAtText || ""),
        paidAt: "",
        paymentTermDays: row.sourceType === "manual" ? (manualRow?.paymentTermText || "") : (detailRow?.paymentTermText || ""),
        isVoided: true,
      }, "订单已作废", "Order voided");
      if (customerPaymentDetailId === row.id) {
        setCustomerPaymentDetailId("");
      }
      setDetailEditingRowId("");
      setDetailRowEditForm(EMPTY_DETAIL_ROW_EDIT_FORM);
      setPaymentEditingRowId("");
      setPaymentRowEditForm(EMPTY_PAYMENT_ROW_EDIT_FORM);
      await refreshCustomersSilently();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("作废失败", "Void failed"));
    }
  }

  function openNewPaymentRow() {
    if (!activePaymentDetail) return;
    setPaymentEditingRowId("new");
    setPaymentRowEditForm({
      id: "",
      payableAmount: activePaymentDetail.payableAmountText || "",
      currentPaymentAmount: "",
      paymentTime: "",
      paymentMethod: "",
      paymentTarget: "",
      note: "",
    });
  }

  function handlePaymentRowEdit(row: CustomerTimelineRow["paymentRows"][number]) {
    setPaymentEditingRowId(row.id || "");
    setPaymentRowEditForm({
      id: row.id || "",
      payableAmount: row.payableAmountText || "",
      currentPaymentAmount: row.currentPaymentAmountText || "",
      paymentTime: row.paymentTimeText || "",
      paymentMethod: row.paymentMethodText || "",
      paymentTarget: row.paymentTargetText || "",
      note: row.noteText || "",
    });
  }

  async function saveInlinePaymentRow() {
    try {
      setError("");
      if (!activePaymentDetail) return;
      if (activePaymentDetail.statusKey === "voided") {
        throw new Error(tx("作废订单不能新增或编辑付款记录。", "Voided orders cannot save payments."));
      }
      if (activePaymentDetail.sourceType === "yg") {
        const detailRow = detailCustomer?.detailRows?.find((item) => item.orderNo === activePaymentDetail.orderNo);
        await saveEntity("/api/settings/customers/manual-orders", {
          id: detailRow?.overlayRecordId || activePaymentDetail.manualRecordId || "",
          sourceType: "yg",
          customerProfileId: detailCustomer?.sourceType === "profile" ? detailCustomer.id : "",
          customerName: detailCustomer?.name || "",
          ygOrderNo: activePaymentDetail.orderNo || "",
          externalOrderNo: "",
          orderChannel: "友购",
          billingAmountOverride: paymentRowEditForm.payableAmount,
          packingAmount: detailRow?.packingAmountText || "",
          shippedAt: activePaymentDetail.shippedAtText || "",
          paidAt: detailRow?.paidAtText || "",
          paymentTermDays: detailRow?.paymentTermText || "",
        }, "记录已保存", "Record saved");
      }

      const manualRow = activePaymentDetail.sourceType === "manual"
        ? detailCustomer?.manualOrderRecords?.find((item) => item.id === activePaymentDetail.manualRecordId)
        : null;
      if (activePaymentDetail.sourceType === "manual" && !manualRow) {
        throw new Error(tx("未找到可编辑记录。", "Editable record not found."));
      }
      if (activePaymentDetail.sourceType === "manual") {
        await saveEntity("/api/settings/customers/manual-orders", {
          id: manualRow?.id || "",
          sourceType: "manual",
          customerProfileId: manualRow?.customerProfileId || (detailCustomer?.sourceType === "profile" ? detailCustomer.id : ""),
          customerName: manualRow?.customerName || detailCustomer?.name || "",
          ygOrderNo: manualRow?.ygOrderNo || "",
          externalOrderNo: manualRow?.externalOrderNo || "",
          orderChannel: manualRow?.orderChannel || "",
          billingAmountOverride: manualRow?.billingAmountOverrideText || "",
          packingAmount: paymentRowEditForm.payableAmount || manualRow?.packingAmountText || "",
          shippedAt: manualRow?.shippedAtText || "",
          paidAt: manualRow?.paidAtText || "",
          paymentTermDays: manualRow?.paymentTermText || "",
        }, "记录已保存", "Record saved");
      }

      await saveEntity("/api/settings/customers/payments", {
        id: paymentEditingRowId === "new" ? "" : paymentRowEditForm.id,
        sourceType: activePaymentDetail.sourceType,
        customerProfileId: detailCustomer?.sourceType === "profile" ? detailCustomer.id : "",
        manualOrderRecordId: activePaymentDetail.sourceType === "manual" ? activePaymentDetail.manualRecordId : "",
        customerName: detailCustomer?.name || "",
        orderNo: activePaymentDetail.orderNo || "",
        paymentAmount: paymentRowEditForm.currentPaymentAmount,
        paidAt: paymentRowEditForm.paymentTime,
        paymentMethod: paymentRowEditForm.paymentMethod,
        paymentTarget: paymentRowEditForm.paymentTarget,
        note: paymentRowEditForm.note,
      }, "付款记录已保存", "Payment saved");
      setPaymentEditingRowId("");
      setPaymentRowEditForm(EMPTY_PAYMENT_ROW_EDIT_FORM);
      await refreshCustomersSilently();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("保存记录失败", "Save record fail"));
    }
  }

  function handleTimelineRowEdit(row: CustomerTimelineRow) {
    setCustomerPaymentDetailId("");
    if (detailEditingRowId === row.id) {
      setDetailEditingRowId("");
      setDetailRowEditForm(EMPTY_DETAIL_ROW_EDIT_FORM);
      return;
    }
    if (row.sourceType === "yg") {
      const detailRow = detailCustomer?.detailRows?.find((item) => item.orderNo === row.orderNo);
      startInlineRowEdit({
        rowId: row.id,
        id: detailRow?.overlayRecordId || row.manualRecordId || "",
        sourceType: "yg",
        customerProfileId: detailCustomer?.sourceType === "profile" ? detailCustomer.id : "",
        customerName: detailCustomer?.name || "",
        ygOrderNo: row.orderNo || "",
        externalOrderNo: "",
        orderChannel: "友购",
        billingAmountOverride: detailRow?.payableAmountText || "",
        packingAmount: row.packingAmountText || "",
        shippedAt: row.shippedAtText || "",
        paidAt: detailRow?.paidAtText || "",
        paymentTermDays: detailRow?.paymentTermText || "",
        displayOrderNo: row.orderNo || "",
        displayOrderNoField: "ygOrderNo",
      });
      return;
    }
    const manualRow = detailCustomer?.manualOrderRecords?.find((item) => item.id === row.manualRecordId);
    if (!manualRow) {
      setError(tx("未找到可编辑记录。", "Editable record not found."));
      return;
    }
    startInlineRowEdit({
      rowId: row.id,
      id: manualRow.id,
      sourceType: "manual",
      customerProfileId: manualRow.customerProfileId || (detailCustomer?.sourceType === "profile" ? detailCustomer.id : ""),
      customerName: manualRow.customerName || detailCustomer?.name || "",
      ygOrderNo: manualRow.ygOrderNo || "",
      externalOrderNo: manualRow.externalOrderNo || "",
      orderChannel: manualRow.orderChannel || "",
      billingAmountOverride: manualRow.billingAmountOverrideText || "",
      packingAmount: manualRow.packingAmountText || "",
      shippedAt: manualRow.shippedAtText || "",
      paidAt: manualRow.paidAtText || "",
      paymentTermDays: manualRow.paymentTermText || "",
      displayOrderNo: manualRow.ygOrderNo || manualRow.externalOrderNo || "",
      displayOrderNoField: manualRow.ygOrderNo ? "ygOrderNo" : "externalOrderNo",
    });
  }

  function handlePaymentEvidenceUpload(paymentRowId: string, sourceType: "yg" | "manual") {
    paymentEvidenceInputRefs.current[paymentRowId]?.click();
  }

  async function loadPaymentEvidenceItems(rowId: string, sourceType: "yg" | "manual", orderNo: string, recordId: string) {
    const params = new URLSearchParams({
      sourceType,
      orderNo,
      recordId,
    });
    const res = await fetch(`/api/settings/customers/payment-evidences?${params.toString()}`);
    const json = await readJsonSafe<{ ok?: boolean; items?: PaymentEvidenceItem[]; error?: string }>(res);
    if (!res.ok || !json?.ok) {
      throw new Error(json?.error || tx("加载付款证据失败", "Load payment evidence fail"));
    }
    setPaymentEvidenceItems((prev) => ({ ...prev, [rowId]: Array.isArray(json.items) ? json.items : [] }));
  }

  async function handlePaymentEvidenceSelected(paymentRowId: string, files: FileList | null) {
    if (!activePaymentDetail) return;
    const uploadFiles = Array.from(files || []).filter((file) => file.size > 0);
    if (uploadFiles.length === 0) return;
    try {
      setError("");
      setUploadingPaymentEvidenceRowId(paymentRowId);
      const formData = new FormData();
      formData.set("sourceType", activePaymentDetail.sourceType);
      formData.set("orderNo", activePaymentDetail.orderNo || "");
      formData.set("recordId", paymentRowId.startsWith("legacy:") ? activePaymentDetail.manualRecordId || "" : paymentRowId);
      for (const file of uploadFiles) {
        formData.append("files", file);
      }
      const res = await fetch("/api/settings/customers/payment-evidences", {
        method: "POST",
        body: formData,
      });
      const json = await readJsonSafe<{ ok?: boolean; items?: PaymentEvidenceItem[]; error?: string }>(res);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || tx("上传付款证据失败", "Upload payment evidence fail"));
      }
      setPaymentEvidenceItems((prev) => ({ ...prev, [paymentRowId]: Array.isArray(json.items) ? json.items : [] }));
      showSaved(tx("付款证据已上传", "Payment evidence uploaded"));
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("上传付款证据失败", "Upload payment evidence fail"));
    } finally {
      setUploadingPaymentEvidenceRowId("");
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
    setSupplierRuleDraft({
      open: true,
      category: "",
      discount: "",
      saving: false,
    });
  }

  function updateSupplierDiscountRule(
    id: string,
    patch: Partial<Pick<SupplierDiscountRule, "category" | "discount">>,
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
    setQuickCategoryDraft({
      open: true,
      ruleId: "",
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
      setSupplierRuleDraft((prev) => (prev.open ? { ...prev, category: zh } : prev));
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

  function saveSupplierDiscountDraft() {
    const category = String(supplierRuleDraft.category || "").trim();
    const discount = formatSupplierDiscountInput(supplierRuleDraft.discount);
    if (!category || !discount) return;
    setSupplierForm((prev) => {
      const nextRules = prev.discountRules.filter((item) => item.category !== category);
      return {
        ...prev,
        discountRules: [
          ...nextRules,
          {
            id: `rule-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            category,
            discount,
          },
        ],
      };
    });
    setSupplierRuleDraft({
      open: false,
      category: "",
      discount: "",
      saving: false,
    });
    showSaved(tx("规则已保存", "Rule saved"));
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
  const supplierShortNameOptions = useMemo(
    () =>
      Array.from(
        new Set(
          suppliers
            .map((supplier) => String(supplier.shortName || "").trim())
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right, "zh-CN")),
    [suppliers],
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
    () => {
      const normalizedKeyword = customerKeyword.trim().toLowerCase();
      return mergedCustomers
        .filter((c) => {
          const timelineRows = buildCustomerTimelineRows(c, "desc", tx);
          const debtAmount = timelineRows.reduce((sum, row) => sum + parseAmountValue(row.unpaidAmountText), 0);
          const hasFinanceTracking = (c.detailRows || []).some(
            (row) => Boolean(String(row.payableAmountText || "").trim()) || (row.paymentRows || []).length > 0,
          ) || (c.manualOrderRecords || []).some(
            (row) => Boolean(String(row.packingAmountText || "").trim()) || (row.paymentRows || []).length > 0,
          );
          const isSettledCustomer = hasFinanceTracking && debtAmount <= 0;
          const isUnsettledCustomer = hasFinanceTracking && debtAmount > 0;
          const orderNos = [
            ...(c.detailRows || []).map((row) => row.orderNo || ""),
            ...(c.manualOrderRecords || []).flatMap((row) => [row.ygOrderNo || "", row.externalOrderNo || ""]),
          ];
          const searchableText = [
            c.name,
            c.contact,
            c.phone,
            c.whatsapp,
            c.tags,
            ...orderNos,
          ]
            .join(" ")
            .toLowerCase();

          return (
            Number(c.totalOrderAmountText || 0) > 0
            && (!String(c.name || "").includes("百盛供应链") || hasFinanceTracking)
            && searchableText.includes(normalizedKeyword)
            && (
              customerVipFilter === "all"
              || (customerVipFilter === "vip" && isVipCustomer(c))
              || (customerVipFilter === "normal" && !isVipCustomer(c))
            )
            && (
              customerSettlementFilter === "all"
              || (customerSettlementFilter === "settled" && isSettledCustomer)
              || (customerSettlementFilter === "unsettled" && isUnsettledCustomer)
            )
          );
        })
        .sort((left, right) => Number(right.totalOrderAmountText || 0) - Number(left.totalOrderAmountText || 0));
    },
    [mergedCustomers, customerKeyword, customerVipFilter, customerSettlementFilter, tx],
  );
  useEffect(() => {
    setCustomerPage(1);
  }, [customerKeyword, customerVipFilter, customerSettlementFilter, mergedCustomers.length]);

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
    return buildCustomerTimelineRows(detailCustomer, customerDetailDateSort, tx);
  }, [customerDetailDateSort, detailCustomer?.detailRows, detailCustomer?.manualOrderRecords, lang, tx]);
  const activePaymentDetail = useMemo(
    () => sortedDetailRows.find((row) => row.id === customerPaymentDetailId) || null,
    [customerPaymentDetailId, sortedDetailRows],
  );
  const activePaymentSummary = useMemo(() => {
    if (!activePaymentDetail) return null;
    return {
      orderNo: activePaymentDetail.orderNo || "-",
      orderAmountText: activePaymentDetail.orderAmountText ? `$ ${activePaymentDetail.orderAmountText}` : "-",
      paidAmountText: activePaymentDetail.paidAmountText ? `$ ${activePaymentDetail.paidAmountText}` : "-",
      unpaidAmountText: activePaymentDetail.unpaidAmountText ? `$ ${activePaymentDetail.unpaidAmountText}` : "-",
      dueDateText: activePaymentDetail.dueDateText || "-",
      statusKey: activePaymentDetail.statusKey,
    };
  }, [activePaymentDetail]);
  const customerFinanceOverviewMap = useMemo(() => {
    const map = new Map<string, {
      packingAmountText: string;
      debtAmountText: string;
      overdueCount: number;
      creditLevel: string;
    }>();

    for (const customer of mergedCustomers) {
      const allRows = buildCustomerTimelineRows(customer, "desc", tx).map((row) => ({
        packing: parseAmountValue(row.packingAmountText),
        unpaid: parseAmountValue(row.unpaidAmountText),
        statusKey: row.statusKey,
      }));
      const packingTotal = allRows.reduce((sum, item) => sum + item.packing, 0);
      const debtTotal = allRows.reduce((sum, item) => sum + item.unpaid, 0);
      const overdueCount = allRows.filter((item) => item.statusKey === "overdue").length;

      map.set(customer.id, {
        packingAmountText: packingTotal > 0 ? packingTotal.toFixed(2) : "",
        debtAmountText: debtTotal > 0 ? debtTotal.toFixed(2) : "",
        overdueCount,
        creditLevel: getCustomerCreditLevelDisplay(customer.creditLevel || "", debtTotal > 0 ? debtTotal.toFixed(2) : "", overdueCount),
      });
    }

    return map;
  }, [mergedCustomers]);
  const detailCustomerFinanceOverview = useMemo(
    () =>
      detailCustomer
        ? customerFinanceOverviewMap.get(detailCustomer.id) || { packingAmountText: "", debtAmountText: "", overdueCount: 0, creditLevel: getCustomerCreditLevelDisplay(detailCustomer.creditLevel || "", "", 0) }
        : null,
    [customerFinanceOverviewMap, detailCustomer],
  );
  const customerPaymentTotalPages = Math.max(
    1,
    Math.ceil((activePaymentDetail?.paymentRows.length || 0) / CUSTOMER_PAYMENT_PAGE_SIZE),
  );
  const safeCustomerPaymentPage = Math.min(customerPaymentPage, customerPaymentTotalPages);
  const pagedPaymentRows = useMemo(
    () =>
      (activePaymentDetail?.paymentRows || []).slice(
        (safeCustomerPaymentPage - 1) * CUSTOMER_PAYMENT_PAGE_SIZE,
        safeCustomerPaymentPage * CUSTOMER_PAYMENT_PAGE_SIZE,
      ),
    [activePaymentDetail?.paymentRows, safeCustomerPaymentPage, CUSTOMER_PAYMENT_PAGE_SIZE],
  );
  const customerDetailTotalPages = Math.max(1, Math.ceil(sortedDetailRows.length / CUSTOMER_DETAIL_PAGE_SIZE));
  const safeCustomerDetailPage = Math.min(customerDetailPage, customerDetailTotalPages);
  const pagedDetailRows = useMemo(
    () =>
      sortedDetailRows.slice(
        (safeCustomerDetailPage - 1) * CUSTOMER_DETAIL_PAGE_SIZE,
        safeCustomerDetailPage * CUSTOMER_DETAIL_PAGE_SIZE,
      ),
    [sortedDetailRows, safeCustomerDetailPage, CUSTOMER_DETAIL_PAGE_SIZE],
  );
  const detailPackingAmountTotal = useMemo(
    () =>
      sortedDetailRows.reduce((sum, row) => {
        const value = Number(row.packingAmountText || 0);
        return Number.isFinite(value) ? sum + value : sum;
      }, 0),
    [sortedDetailRows],
  );
  const hasPendingDetailCustomerInfoChanges = useMemo(() => {
    if (!detailCustomer) return false;
    return (
      (detailCustomerInfoForm.linkedYgName || "") !== (detailCustomer.linkedYgName || detailCustomer.name || "")
      || (detailCustomerInfoForm.name || "") !== (detailCustomer.name || "")
      || (detailCustomerInfoForm.contact || "") !== (detailCustomer.contact || "")
      || (detailCustomerInfoForm.phone || "") !== (detailCustomer.phone || "")
      || (detailCustomerInfoForm.stores || "") !== (detailCustomer.stores || "")
      || (detailCustomerInfoForm.cityCountry || "") !== (detailCustomer.cityCountry || "")
      || (detailCustomerInfoForm.paymentTermText || "") !== (detailCustomer.paymentTermText || "")
    );
  }, [detailCustomer, detailCustomerInfoForm]);
  const hasAnyPackingAmount = useMemo(
    () => sortedDetailRows.some((row) => Boolean(String(row.packingAmountText || "").trim())),
    [sortedDetailRows],
  );
  useEffect(() => {
    if (!detailCustomer) {
      setCustomerPaymentDetailId("");
      setCustomerDetailPage(1);
      setDetailEditingRowId("");
      setDetailRowEditForm(EMPTY_DETAIL_ROW_EDIT_FORM);
      setDetailCustomerInfoForm(EMPTY_DETAIL_CUSTOMER_INFO_FORM);
      setSavingDetailCustomerInfo(false);
      return;
    }
    setCustomerDetailPage(1);
    setDetailCustomerInfoForm({
      id: detailCustomer.id || "",
      sourceType: detailCustomer.sourceType || "manual",
      linkedYgName: detailCustomer.linkedYgName || detailCustomer.name || "",
      name: detailCustomer.name || "",
      contact: detailCustomer.contact || "",
      phone: detailCustomer.phone || "",
      stores: detailCustomer.stores || "",
      cityCountry: detailCustomer.cityCountry || "",
      paymentTermText: detailCustomer.paymentTermText || "",
    });
    setDetailCustomerInfoEditOpen(false);
  }, [detailCustomer]);
  useEffect(() => {
    setCustomerDetailPage(1);
  }, [customerDetailDateSort]);
  useEffect(() => {
    if (!activePaymentDetail) {
      setCustomerPaymentPage(1);
      setPaymentEditingRowId("");
      setPaymentRowEditForm(EMPTY_PAYMENT_ROW_EDIT_FORM);
    }
  }, [activePaymentDetail]);
  useEffect(() => {
    setCustomerPaymentPage(1);
  }, [customerPaymentDetailId]);
  useEffect(() => {
    if (!activePaymentDetail) {
      setPaymentEvidenceItems({});
    }
  }, [activePaymentDetail]);
  useEffect(() => {
    if (!activePaymentDetail) return;
    void Promise.all(
      (activePaymentDetail.paymentRows || []).map((paymentRow) =>
        loadPaymentEvidenceItems(
          paymentRow.id,
          activePaymentDetail.sourceType,
          activePaymentDetail.orderNo || "",
          paymentRow.id.startsWith("legacy:") ? activePaymentDetail.manualRecordId || "" : paymentRow.id,
        ),
      ),
    ).catch((error) => {
      setError(error instanceof Error ? error.message : tx("加载付款证据失败", "Load payment evidence fail"));
    });
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
      <div className={singleCustomerTabView ? "" : "rounded-2xl border border-slate-200 bg-white"}>
        {!singleCustomerTabView ? (
          <div className="flex flex-wrap gap-2 border-b border-slate-200 px-5 py-4">
            {allowedTabs.map((t) => (
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
        ) : saved ? (
          <div className="px-4 pb-1 text-sm text-emerald-600">{saved}</div>
        ) : null}

        {error ? <div className={`${singleCustomerTabView ? "mb-4" : "mx-5 mt-4"} rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600`}>{error}</div> : null}
        {loading ? <div className={`${singleCustomerTabView ? "px-4 py-3" : "p-5"} text-sm text-slate-500`}>{tx("加载中...", "Load...")}</div> : null}

        {!loading && tab === "perm" ? (
          <div className="space-y-4 p-5">
            <CustomerPermissionsClient
              lang={lang}
              autoload
              embedded
              preferredUserId={currentUserId}
              canManagePermissions={canManageAppPermissions}
              canViewInviteCodes={canViewInviteCodes}
              canManageInviteCodes={canManageInviteCodes}
            />
          </div>
        ) : null}

        {!loading && tab === "supplier" ? (
          <div className="space-y-4 p-5">
            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <h3 className="text-base font-semibold text-slate-900">{tx("供应商列表", "Lista prov")}</h3>
                <div className="flex min-w-0 items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={!canManageSuppliers}
                    onClick={() => {
                      setSupplierForm(EMPTY_SUPPLIER);
                      setSupplierEditorOpen(true);
                    }}
                    className="inline-flex h-8 shrink-0 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    {tx("新增供应商", "Nuevo prov")}
                  </button>
                  <input value={supplierKeyword} onChange={(e) => setSupplierKeyword(e.target.value)} placeholder={tx("搜索供应商", "Search prov")} className="h-10 w-full max-w-[280px] rounded-xl border border-slate-200 px-3 text-sm" />
                </div>
              </div>
              <div className="max-h-[540px] overflow-auto">
                <table className="w-full min-w-[1040px] text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="w-[76px] px-3 py-2 text-left whitespace-nowrap"></th>
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
                          <SupplierLogoThumb
                            src={s.logoUrl}
                            alt={`${s.shortName || "supplier"}-logo`}
                            emptyText={lang === "zh" ? "未上传" : "Sin logo"}
                            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                          />
                        </td>
                        <td className="px-3 py-1.5 font-semibold">{s.shortName || "-"}</td>
                        <td className="px-3 py-1.5">{s.fullName || "-"}</td>
                        <td className="px-3 py-1.5">{`${s.contact || "-"} / ${s.phone || "-"}`}</td>
                        <td className="px-3 py-1.5">
                          {s.discountRules.length ? (
                            <button
                              type="button"
                              onClick={() =>
                                setSupplierDiscountPreview({
                                  open: true,
                                  supplierName: s.shortName || s.fullName || "-",
                                  rules: s.discountRules.filter((rule) => String(rule.category || "").trim() && String(rule.discount || "").trim()),
                                })
                              }
                              className="inline-flex max-w-full items-center rounded-lg text-left text-primary hover:text-primary/80"
                            >
                              <span className="truncate">{formatSupplierDiscountSummary(s.discountRules)}</span>
                            </button>
                          ) : (
                            tx("未配置", "Sin configurar")
                          )}
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
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-900">{tx("新增品类", "Nueva categoria")}</h3>
                  {renderSwitch(tx("启用", "On"), quickCategoryDraft.active, (next) => setQuickCategoryDraft((prev) => ({ ...prev, active: next })))}
                </div>
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

        {!loading && supplierRuleDraft.open ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/30 px-4">
            <div className="w-full max-w-[520px] rounded-2xl border border-slate-200 bg-white shadow-soft">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">{tx("新增规则", "Agregar regla")}</h3>
              </div>
              <div className="grid gap-3 p-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{tx("选择品类", "Sel categoria")}</label>
                  <select
                    value={supplierRuleDraft.category}
                    onChange={(e) => setSupplierRuleDraft((prev) => ({ ...prev, category: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  >
                    <option value="">{tx("选择品类", "Sel categoria")}</option>
                    {supplierCategoryOptions.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{tx("供应商折扣", "Desc prov")}</label>
                  <input
                    value={supplierRuleDraft.discount}
                    onChange={(e) => setSupplierRuleDraft((prev) => ({ ...prev, discount: formatSupplierDiscountInput(e.target.value) }))}
                    onBlur={(e) => setSupplierRuleDraft((prev) => ({ ...prev, discount: formatSupplierDiscountInput(e.target.value) }))}
                    placeholder="25%"
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                <button
                  type="button"
                  onClick={() =>
                    setSupplierRuleDraft({
                      open: false,
                      category: "",
                      discount: "",
                      saving: false,
                    })
                  }
                  className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
                >
                  {tx("取消", "Cancelar")}
                </button>
                <button
                  type="button"
                  disabled={!supplierRuleDraft.category.trim() || !supplierRuleDraft.discount.trim()}
                  onClick={saveSupplierDiscountDraft}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-semibold text-white disabled:opacity-40"
                >
                  <Check className="h-4 w-4" />
                  <span>{tx("保存规则", "Guardar regla")}</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && supplierDiscountPreview.open ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/30 px-4">
            <div className="w-full max-w-[460px] rounded-2xl border border-slate-200 bg-white shadow-soft">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">{tx("折扣规则", "Reglas de descuento")}</h3>
                <p className="mt-1 text-xs text-slate-500">{supplierDiscountPreview.supplierName || "-"}</p>
              </div>
              <div className="space-y-2 p-4">
                {supplierDiscountPreview.rules.length ? (
                  supplierDiscountPreview.rules.map((rule) => (
                    <div key={`preview-${rule.id}`} className="grid grid-cols-[minmax(0,1fr)_72px] items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <span className="truncate">{rule.category || "-"}</span>
                      <span className="text-right font-medium text-slate-900">{formatSupplierDiscountInput(rule.discount) || "-"}</span>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">{tx("未配置", "Sin configurar")}</div>
                )}
              </div>
              <div className="flex items-center justify-end border-t border-slate-200 px-4 py-3">
                <button
                  type="button"
                  onClick={() =>
                    setSupplierDiscountPreview({
                      open: false,
                      supplierName: "",
                      rules: [],
                    })
                  }
                  className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
                >
                  {tx("关闭", "Cerrar")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && supplierEditorOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
            <div className="max-h-[86vh] w-full max-w-[620px] overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
              <div className="border-b border-slate-200 px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{tx("供应商信息", "Info prov")}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {tx("用于新增、编辑和维护供应商基础资料。", "Alta, edicion y mantenimiento de datos base del proveedor.")}
                    </p>
                  </div>
                  <div className="min-w-0 shrink-0">
                    <div className="flex justify-end">
                      {renderSwitch(tx("启用", "On"), supplierForm.enabled, (next) => setSupplierForm((p) => ({ ...p, enabled: next })))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-2 p-2.5">
                <div className="bg-white p-1">
                  <div className="grid gap-1.5 xl:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("全称", "Full")}</label>
                      <input value={supplierForm.fullName} onChange={(e) => setSupplierForm((p) => ({ ...p, fullName: e.target.value }))} className="h-9 w-full rounded-xl border border-slate-200 px-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("简称", "Short")}</label>
                      <input value={supplierForm.shortName} onChange={(e) => setSupplierForm((p) => ({ ...p, shortName: e.target.value }))} className="h-9 w-full rounded-xl border border-slate-200 px-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("账期天数", "Term days")}</label>
                      <input value={supplierForm.accountPeriodDays} onChange={(e) => setSupplierForm((p) => ({ ...p, accountPeriodDays: e.target.value }))} className="h-9 w-full rounded-xl border border-slate-200 px-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("联系人", "Cont")}</label>
                      <input value={supplierForm.contact} onChange={(e) => setSupplierForm((p) => ({ ...p, contact: e.target.value }))} className="h-9 w-full rounded-xl border border-slate-200 px-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("电话", "Tel")}</label>
                      <input value={supplierForm.phone} onChange={(e) => setSupplierForm((p) => ({ ...p, phone: e.target.value }))} className="h-9 w-full rounded-xl border border-slate-200 px-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("合作开始日期", "Inicio coop.")}</label>
                      <input type="date" value={supplierForm.startDate} onChange={(e) => setSupplierForm((p) => ({ ...p, startDate: e.target.value }))} className="h-9 w-full rounded-xl border border-slate-200 px-2.5 text-sm" />
                    </div>
                  </div>

                  <div className="mt-1.5 grid items-start gap-1.5 xl:grid-cols-[88px_94px_minmax(0,1fr)]">
                    <div className="min-w-0">
                        <label className="mb-1 block text-xs font-medium text-slate-600">{tx("供应商 LOGO", "Logo proveedor")}</label>
                        <div className="flex items-center gap-2">
                          <label className="relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-200 bg-white">
                          <SupplierLogoThumb
                            key={supplierForm.logoUrl || "empty-logo"}
                            src={supplierForm.logoUrl}
                            alt="supplier-logo"
                            emptyText=""
                            className="flex h-full w-full items-center justify-center overflow-hidden bg-white"
                          />
                          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-white/85 py-1 text-center text-[10px] font-medium text-slate-600">
                            {uploadingSupplierLogo
                              ? tx("上传中...", "Subiendo...")
                              : supplierForm.logoUrl
                                ? tx("更换", "Cambiar")
                                : tx("上传", "Subir")}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingSupplierLogo}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.currentTarget.value = "";
                              if (file) void uploadSupplierLogo(file);
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="mb-1 flex items-start justify-between gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600">{tx("添加折扣", "Agregar desc")}</label>
                        </div>
                      </div>

                      <div className="mt-1">
                        <div className="flex flex-col items-start gap-2">
                          <button type="button" onClick={addSupplierDiscountRule} className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
                            {tx("新增规则", "Agregar regla")}
                          </button>
                          <button
                            type="button"
                            onClick={openQuickCategoryForRules}
                            className="inline-flex h-8 shrink-0 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                          >
                            {tx("新增品类", "Nueva categoria")}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-600">{tx("目前折扣", "Desc actual")}</label>
                      </div>
                      <div className="space-y-1.5">
                        {supplierForm.discountRules
                          .filter((rule) => String(rule.category || "").trim() && String(rule.discount || "").trim())
                          .map((rule) => (
                            <div key={`summary-${rule.id}`} className="grid grid-cols-[minmax(0,1fr)_64px_28px] items-center gap-2 rounded-lg bg-primary/10 px-2.5 py-1.5 text-sm text-slate-700">
                              <span className="truncate">{rule.category}</span>
                              <span className="text-right font-medium text-slate-900">{formatSupplierDiscountInput(rule.discount)}</span>
                              <button
                                type="button"
                                onClick={() => removeSupplierDiscountRule(rule.id)}
                                className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded-md text-rose-500 transition hover:bg-white/70 hover:text-rose-600"
                                aria-label={tx("删除", "Del")}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
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

        {!loading && userManagerOpen ? (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4">
            <div className="max-h-[86vh] w-full max-w-[680px] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-soft">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <h3 className="text-base font-semibold text-slate-900">{tx("用户管理", "Users")}</h3>
                <div className="flex items-center gap-2">
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => openManagedUserEditor()}
                      className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-white"
                    >
                      {tx("新增用户", "New user")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setUserManagerOpen(false);
                      closeManagedUserEditor();
                    }}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    aria-label={tx("关闭", "Close")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full table-fixed border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-slate-50 text-left text-sm text-slate-500">
                        <th className="w-[78px] px-2 py-3 font-semibold">{tx("头像", "Avatar")}</th>
                        <th className="w-[84px] px-2 py-3 font-semibold">{tx("姓名", "Nombre")}</th>
                        <th className="w-[132px] px-2 py-3 font-semibold">{tx("手机号", "Telefono")}</th>
                        <th className="w-[178px] px-2 py-3 font-semibold">{tx("邮箱", "Correo")}</th>
                        <th className="w-[68px] px-2 py-3 font-semibold">{tx("角色", "Rol")}</th>
                        <th className="w-[54px] px-2 py-3 font-semibold">{tx("状态", "Estado")}</th>
                        <th className="w-[72px] px-2 py-3 text-right font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {managedUserLoading ? (
                        <tr>
                          <td colSpan={7} className="px-2 py-8 text-center text-sm text-slate-500">
                            {tx("加载中...", "Cargando...")}
                          </td>
                        </tr>
                      ) : managedUsers.length ? (
                        managedUsers.map((user) => (
                          <tr key={user.id} className="border-t border-slate-100">
                            <td className="px-2 py-4">
                              {user.avatar_url ? (
                                <img
                                  src={user.avatar_url}
                                  alt={user.name || "avatar"}
                                  className="h-9 w-9 rounded-full border border-slate-200 object-cover"
                                />
                              ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-600">
                                  {String(user.name || user.phone || "U").trim().slice(0, 1).toUpperCase()}
                                </div>
                              )}
                            </td>
                            <td className="truncate px-2 py-4 text-sm text-slate-700">{user.name}</td>
                            <td className="truncate px-2 py-4 text-sm text-slate-700">{user.phone}</td>
                            <td className="truncate px-2 py-4 text-sm text-slate-700">{user.email || "-"}</td>
                            <td className="truncate px-2 py-4 text-sm text-slate-700">{user.role === "admin" ? tx("管理员", "Admin") : tx("员工", "Staff")}</td>
                            <td className="truncate px-2 py-4 text-sm text-slate-700">{user.active ? tx("启用", "Active") : tx("停用", "Inactive")}</td>
                            <td className="px-2 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => openManagedUserEditor(user)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-primary hover:bg-slate-50"
                                  aria-label={tx("编辑", "Edit")}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                {user.role !== "admin" ? (
                                  <button
                                    type="button"
                                    onClick={() => void deleteManagedUser(user.id)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50"
                                    aria-label={tx("删除", "Delete")}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-2 py-8 text-center text-sm text-slate-500">
                            {tx("暂无用户", "No users")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && managedUserEditorOpen ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 px-4">
            <div className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white shadow-soft">
              <div className="border-b border-slate-200 px-4 py-4">
                <h3 className="text-[18px] font-bold tracking-tight text-slate-900">
                  {managedUserForm.id ? tx("编辑用户资料", "Edit user") : tx("新增用户", "New user")}
                </h3>
              </div>
              <div className="grid gap-3 p-4">
                <input
                  value={managedUserForm.name}
                  onChange={(e) => setManagedUserForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder={tx("姓名", "Nombre")}
                  className="h-10 w-[180px] rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-primary"
                />
                <input
                  value={managedUserForm.phone}
                  onChange={(e) => setManagedUserForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder={tx("手机号", "Telefono")}
                  className="h-10 w-[180px] rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-primary"
                />
                <input
                  value={managedUserForm.email}
                  onChange={(e) => setManagedUserForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder={tx("邮箱", "Correo")}
                  className="h-10 w-[180px] rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-primary"
                />
                <input
                  type="password"
                  value={managedUserForm.password}
                  onChange={(e) => setManagedUserForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder={managedUserForm.id ? tx("新密码 不修改可留空", "New password optional") : tx("登录密码", "Password")}
                  className="h-10 w-[180px] rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-primary"
                />
                <div className="w-[180px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                  <div className="flex items-center gap-5">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="managed-user-role" checked={managedUserForm.role === "admin"} onChange={() => setManagedUserForm((prev) => ({ ...prev, role: "admin" }))} />
                      <span>{tx("管理员", "Admin")}</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="managed-user-role" checked={managedUserForm.role === "worker"} onChange={() => setManagedUserForm((prev) => ({ ...prev, role: "worker" }))} />
                      <span>{tx("员工", "Staff")}</span>
                    </label>
                  </div>
                </div>
                <label className="flex h-10 w-[180px] items-center rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
                  <input type="checkbox" checked={managedUserForm.active} onChange={(e) => setManagedUserForm((prev) => ({ ...prev, active: e.target.checked }))} className="mr-2" />
                  {tx("账号启用", "Account active")}
                </label>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-4 py-4">
                <button
                  type="button"
                  onClick={closeManagedUserEditor}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {tx("取消", "Cancelar")}
                </button>
                <button
                  type="button"
                  onClick={() => void saveManagedUser()}
                  disabled={managedUserSaving}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
                >
                  {managedUserSaving ? tx("保存中...", "Saving...") : tx("保存", "Guardar")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && tab === "customer" ? (
          <div className={singleCustomerTabView ? "" : "space-y-4 p-5"}>
            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <div className="flex items-center gap-6">
                  <h3 className="text-base font-semibold text-slate-900">{tx("客户财务", "Finanzas cliente")}</h3>
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
                <div className="flex w-full max-w-[500px] items-center justify-end rounded-xl border border-slate-200 bg-white pl-3 pr-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <input
                    value={customerKeyword}
                    onChange={(e) => setCustomerKeyword(e.target.value)}
                    placeholder={tx("搜索客户", "Search cli")}
                    className="h-9 min-w-[148px] flex-[0_0_44%] border-0 bg-transparent px-0 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                  <div className="mx-2.5 h-5 w-px bg-slate-200" />
                  <select
                    value={customerSettlementFilter}
                    onChange={(e) => setCustomerSettlementFilter(e.target.value as "all" | "settled" | "unsettled")}
                    className="h-9 w-[110px] flex-none border-0 bg-transparent px-2 text-sm text-slate-700 outline-none"
                  >
                    <option value="all">{tx("全部状态", "All status")}</option>
                    <option value="settled">{tx("已结清", "Settled")}</option>
                    <option value="unsettled">{tx("未结清", "Unsettled")}</option>
                  </select>
                  <div className="mx-1.5 h-5 w-px bg-slate-200" />
                  <select
                    value={customerVipFilter}
                    onChange={(e) => setCustomerVipFilter(e.target.value as "all" | "vip" | "normal")}
                    className="h-9 w-[104px] flex-none border-0 bg-transparent px-2 text-sm text-slate-700 outline-none"
                  >
                    <option value="all">{tx("全部VIP", "VIP all")}</option>
                    <option value="vip">{tx("仅VIP", "Solo VIP")}</option>
                    <option value="normal">{tx("非VIP", "No VIP")}</option>
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1220px] text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left whitespace-nowrap">{tx("客户", "Client")}</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">{tx("下单渠道", "Canal")}</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">{tx("全渠道下单", "Total amount")}</th>
                      <th className="px-3 py-2 text-center whitespace-nowrap">{tx("全渠道次数", "Total count")}</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">{tx("配货金额", "Packing amount")}</th>
                      <th className="px-3 py-2 text-left whitespace-nowrap">{tx("欠款金额", "Saldo")}</th>
                      <th className="px-3 py-2 text-center whitespace-nowrap">{tx("账期", "Plazo")}</th>
                      <th className="px-3 py-2 text-center whitespace-nowrap">{tx("逾期", "Vencidas")}</th>
                      <th className="px-3 py-2 text-center whitespace-nowrap">{tx("是否结清", "Liquidado")}</th>
                      <th className="px-3 py-2 text-center whitespace-nowrap">{tx("VIP", "VIP")}</th>
                      <th className="px-3 py-2 text-center whitespace-nowrap">{tx("信用", "Crédito")}</th>
                      <th className="w-[66px] px-3 py-2 text-center whitespace-nowrap">{tx("详情", "Detail")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedCustomers.map((c) => {
                      const overview = customerFinanceOverviewMap.get(c.id) || { packingAmountText: "", debtAmountText: "", overdueCount: 0, creditLevel: getCustomerCreditLevelDisplay(c.creditLevel || "", "", 0) };
                      const hasSettlementTracking = Boolean(String(overview.packingAmountText || "").trim()) || Boolean(String(overview.debtAmountText || "").trim());
                      return (
                      <tr key={c.id} className="border-t border-slate-100">
                        <td className="px-3 py-1.5">{getCustomerDisplayName(c)}</td>
                        <td className="px-3 py-1.5">{c.channelText || getCustomerChannelLabel(c, tx)}</td>
                        <td className="px-3 py-1.5">$ {c.totalOrderAmountText || "0.00"}</td>
                        <td className="px-3 py-1.5 text-center">{(c.totalOrderCount ?? c.orderStats) || "-"}</td>
                        <td className="px-3 py-1.5">{overview.packingAmountText ? `$ ${overview.packingAmountText}` : "-"}</td>
                        <td className="px-3 py-1.5">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${overview.debtAmountText ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-500"}`}>
                            {overview.debtAmountText ? `$ ${overview.debtAmountText}` : "-"}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-center">{c.paymentTermText || "-"}</td>
                        <td className="px-3 py-1.5 text-center">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${overview.overdueCount > 0 ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-500"}`}>
                            {getOverdueLabel(overview.overdueCount, tx)}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {hasSettlementTracking ? (
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${overview.debtAmountText ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                              {overview.debtAmountText ? tx("未清", "Pendiente") : tx("已结清", "Liquidado")}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-center">{isVipCustomer(c) ? <span className="inline-flex justify-center"><VipBadgeIcon /></span> : ""}</td>
                        <td className="px-3 py-1.5 text-center">
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                            {overview.creditLevel || "-"}
                          </span>
                        </td>
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
                      </tr>
                    )})}
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
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 px-4">
            <div className="max-h-[90vh] w-full max-w-[720px] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-soft">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {manualOrderForm.id ? tx("编辑记录", "Editar registro") : tx("新增记录", "Nuevo registro")}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setManualOrderOpen(false);
                    setManualOrderForm(EMPTY_MANUAL_ORDER_FORM);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
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
                    <label className="mb-1 block text-xs font-medium text-slate-600">{tx("账期", "Term")}</label>
                    <input
                      value={manualOrderForm.paymentTermDays}
                      onChange={(e) => setManualOrderForm((prev) => ({ ...prev, paymentTermDays: e.target.value.replace(/[^\d]/g, "") }))}
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.92fr)]">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{tx("友购订单号", "Pedido YG")}</label>
                    <input
                      value={manualOrderForm.ygOrderNo}
                      onChange={(e) => setManualOrderForm((prev) => ({ ...prev, ygOrderNo: e.target.value }))}
                      disabled={manualOrderEditorMode === "yg"}
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">备货金额</label>
                    <input
                      value={manualOrderBillingAmountValue}
                      onChange={(e) => setManualOrderForm((prev) => ({ ...prev, billingAmountOverride: e.target.value }))}
                      placeholder="-"
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{tx("发货日期", "Fecha envio")}</label>
                    <input
                      type="date"
                      value={manualOrderForm.ygShippedAt}
                      onChange={(e) => setManualOrderForm((prev) => ({ ...prev, ygShippedAt: e.target.value }))}
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="border-t border-slate-200 pt-3">
                    <div className="text-xs font-medium tracking-[0.12em] text-slate-400">
                      {tx("其他订单号", "Pedidos externos")}
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)_minmax(0,0.82fr)_minmax(0,0.92fr)]">
                  {manualOrderEditorMode === "manual" ? (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("其他订单号", "Pedido externo")}</label>
                      <input
                        value={manualOrderForm.externalOrderNo}
                        onChange={(e) => setManualOrderForm((prev) => ({ ...prev, externalOrderNo: e.target.value }))}
                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                      />
                    </div>
                  ) : (
                    <div />
                  )}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{tx("下单渠道", "Canal")}</label>
                    <select
                      value={manualOrderEditorMode === "yg" ? tx("友购", "Yogo") : manualOrderForm.orderChannel}
                      onChange={(e) => setManualOrderForm((prev) => ({ ...prev, orderChannel: e.target.value }))}
                      disabled={manualOrderEditorMode === "yg"}
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      {manualOrderEditorMode === "yg" ? (
                        <option value={tx("友购", "Yogo")}>{tx("友购", "Yogo")}</option>
                      ) : (
                        <>
                          <option value="">请选择</option>
                          <option value="微信">微信</option>
                          <option value="WhatsApp">WhatsApp</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{tx("配货金额", "Packing amount")}</label>
                    <input
                      value={manualOrderForm.packingAmount}
                      onChange={(e) => setManualOrderForm((prev) => ({ ...prev, packingAmount: e.target.value }))}
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{tx("发货日期", "Fecha envio")}</label>
                    <input
                      type="date"
                      value={manualOrderForm.shippedAt}
                      onChange={(e) => setManualOrderForm((prev) => ({ ...prev, shippedAt: e.target.value }))}
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                    />
                  </div>
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
            <div className="max-h-[86vh] w-full max-w-[1040px] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-soft">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <h3 className="text-base font-semibold text-slate-900">
                  {tx("客户下单详情", "Detalle de pedidos")} · {detailCustomer.name || "-"}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={exportDetailCustomerFile}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {tx("导出文件", "Exportar")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerDetailId("")}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    aria-label={tx("关闭", "Close")}
                    title={tx("关闭", "Close")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="p-3 pt-2">
                <div className="mb-3 bg-white p-2">
                  <div className="mb-2.5 flex items-center gap-1.5">
                    <h4 className="text-sm font-semibold text-slate-900">{tx("客户信息", "Info cli")}</h4>
                    <button
                      type="button"
                      onClick={() => setDetailCustomerInfoEditOpen(true)}
                      disabled={!canManageCustomers}
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-md border transition disabled:opacity-40 ${
                        detailCustomerInfoEditOpen
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                      aria-label={tx("编辑客户信息", "Edit customer info")}
                      title={tx("编辑客户信息", "Edit customer info")}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveDetailCustomerInfo()}
                      disabled={!canManageCustomers || !detailCustomerInfoEditOpen || savingDetailCustomerInfo || !hasPendingDetailCustomerInfoChanges}
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-md border transition disabled:opacity-40 ${
                        hasPendingDetailCustomerInfoChanges
                          ? "border-primary bg-primary text-white"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                      aria-label={tx("保存客户信息", "Save customer info")}
                      title={tx("保存客户信息", "Save customer info")}
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    {hasPendingDetailCustomerInfoChanges ? (
                      <span className="text-[11px] font-medium text-red-500">{tx("请点击保存编辑", "Haz clic para guardar")}</span>
                    ) : null}
                  </div>
                  <div className="grid gap-x-3 gap-y-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.72fr)_minmax(0,0.72fr)]">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("友购客户名称", "Cliente Yogo")}</label>
                      <ReadonlyCustomerField value={detailCustomerInfoForm.linkedYgName} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("真实客户名称", "Cliente real")}</label>
                      <input
                        value={detailCustomerInfoForm.name}
                        onChange={(e) => setDetailCustomerInfoForm((prev) => ({ ...prev, name: e.target.value }))}
                        disabled={!canManageCustomers || !detailCustomerInfoEditOpen}
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-xs font-normal text-slate-700 outline-none transition focus:border-primary disabled:bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("联系人", "Cont")}</label>
                      <ReadonlyCustomerField value={detailCustomerInfoForm.contact} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("手机", "Mob")}</label>
                      <ReadonlyCustomerField value={detailCustomerInfoForm.phone} />
                    </div>
                  </div>
                  <div className="mt-3.5">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">{tx("客户地址", "Direccion")}</label>
                      <div className="relative">
                        <input
                          value={detailCustomerInfoForm.cityCountry}
                          onChange={(e) => setDetailCustomerInfoForm((prev) => ({ ...prev, cityCountry: e.target.value }))}
                          disabled={!canManageCustomers || !detailCustomerInfoEditOpen}
                          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-12 text-xs font-normal text-slate-700 outline-none transition focus:border-primary disabled:bg-slate-50"
                        />
                        <a
                          href={mapSearchUrl(detailCustomerInfoForm.cityCountry)}
                          target="_blank"
                          rel="noreferrer"
                          className={`absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 ${detailCustomerInfoForm.cityCountry.trim() ? "" : "pointer-events-none opacity-40"}`}
                          title="Google Maps"
                          aria-label="Google Maps"
                        >
                          <MapPin className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3.5 grid gap-3 xl:grid-cols-8">
                    <div className="min-w-0 text-center">
                      <label className="mb-1 block text-center text-sm font-semibold text-slate-700">{tx("VIP等级", "VIP lvl")}</label>
                      <PlainCustomerValue centered>
                        {isVipCustomer(detailCustomer) ? <span className="inline-flex"><VipBadgeIcon /></span> : "-"}
                      </PlainCustomerValue>
                    </div>
                    <div className="min-w-0 text-center">
                      <label className="mb-1 block text-center text-sm font-semibold text-slate-700">{tx("信用等级", "Crédito")}</label>
                      <PlainCustomerValue centered value={detailCustomerFinanceOverview?.creditLevel || "-"} />
                    </div>
                    <div className="min-w-0 text-center">
                      <label className="mb-1 block text-center text-sm font-semibold text-slate-700">{tx("下单次数", "Order count")}</label>
                      <PlainCustomerValue centered value={Number(detailCustomer.totalOrderCount || 0) > 0 ? String(detailCustomer.totalOrderCount) : "-"} />
                    </div>
                    <div className="min-w-0 text-center">
                      <label className="mb-1 block text-center text-sm font-semibold text-slate-700">{tx("下单金额", "Order amount")}</label>
                      <PlainCustomerValue centered value={detailCustomer.totalOrderAmountText ? `$ ${detailCustomer.totalOrderAmountText}` : "-"} />
                    </div>
                    <div className="min-w-0 text-center">
                      <label className="mb-1 block text-center text-sm font-semibold text-slate-700">{tx("配货金额", "Packing amount")}</label>
                      <PlainCustomerValue centered value={detailCustomerFinanceOverview?.packingAmountText ? `$ ${detailCustomerFinanceOverview.packingAmountText}` : "-"} />
                    </div>
                    <div className="min-w-0 text-center">
                      <label className="mb-1 block text-center text-sm font-semibold text-slate-700">{tx("欠款金额", "Saldo")}</label>
                      <PlainCustomerValue centered value={detailCustomerFinanceOverview?.debtAmountText ? `$ ${detailCustomerFinanceOverview.debtAmountText}` : "-"} />
                    </div>
                    <div className="min-w-0 text-center">
                      <label className="mb-1 block text-center text-sm font-semibold text-slate-700">{tx("账期", "Plazo")}</label>
                      {detailCustomer.paymentTermText && !detailCustomerInfoEditOpen ? (
                        <PlainCustomerValue centered value={detailCustomer.paymentTermText} />
                      ) : canManageCustomers ? (
                        <div className="flex justify-center">
                          <input
                            value={detailCustomerInfoForm.paymentTermText || ""}
                            onChange={(e) =>
                              setDetailCustomerInfoForm((prev) => ({
                                ...prev,
                                paymentTermText: e.target.value.replace(/[^\d]/g, ""),
                              }))}
                            placeholder={tx("填写账期", "Captura plazo")}
                            disabled={!detailCustomerInfoEditOpen}
                            className="h-9 w-24 rounded-xl border border-slate-200 bg-white px-3 text-center text-sm font-normal text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-slate-50"
                          />
                        </div>
                      ) : (
                        <PlainCustomerValue centered value="-" />
                      )}
                    </div>
                    <div className="min-w-0 text-center">
                      <label className="mb-1 block text-center text-sm font-semibold text-slate-700">{tx("逾期订单", "Vencidas")}</label>
                      <PlainCustomerValue centered value={getOverdueLabel(detailCustomerFinanceOverview?.overdueCount || 0, tx)} />
                    </div>
                  </div>
                </div>
                {sortedDetailRows.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    {tx("当前没有匹配到下单记录", "No hay pedidos vinculados")}
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200">
                    <table className="w-full table-auto text-xs">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="w-[240px] px-3 py-1.5 text-left whitespace-nowrap">{tx("订单号", "Order no")}</th>
                          <th className="w-[90px] px-3 py-1.5 text-left whitespace-nowrap">{tx("渠道", "Canal")}</th>
                          <th className="w-[120px] px-3 py-1.5 text-left whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setCustomerDetailDateSort((prev) => (prev === "desc" ? "asc" : "desc"))}
                              className="inline-flex items-center gap-1 font-medium text-slate-600 hover:text-slate-900"
                            >
                              <span>{tx("下单日期", "Order date")}</span>
                              {customerDetailDateSort === "desc" ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                            </button>
                          </th>
                          <th className="w-[120px] px-3 py-1.5 text-left whitespace-nowrap">{tx("下单金额", "Monto pedido")}</th>
                          <th className="w-[120px] px-3 py-1.5 text-left whitespace-nowrap">{tx("配货金额", "Packing amount")}</th>
                          <th className="w-[120px] px-3 py-1.5 text-left whitespace-nowrap">{tx("已付金额", "Pagado")}</th>
                          <th className="w-[120px] px-3 py-1.5 text-left whitespace-nowrap">{tx("未付金额", "Pendiente")}</th>
                          <th className="w-[110px] px-3 py-1.5 text-left whitespace-nowrap">{tx("应付款日", "Vence")}</th>
                          <th className="w-[104px] px-3 py-1.5 text-left whitespace-nowrap">{tx("状态", "Estado")}</th>
                          <th className="w-[128px] px-3 py-1.5 text-right whitespace-nowrap">{tx("操作", "Acciones")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedDetailRows.map((item) => (
                          <tr key={item.id} className="border-t border-slate-100">
                            <td className="w-[240px] px-3 py-1.5 whitespace-nowrap">
                              {detailEditingRowId === item.id && item.sourceType === "manual" ? (
                                <input
                                  value={detailRowEditForm.displayOrderNo}
                                  onChange={(e) => setDetailRowEditForm((prev) => ({ ...prev, displayOrderNo: e.target.value }))}
                                  className="h-9 w-[200px] rounded-xl border border-slate-200 px-3 text-xs font-normal"
                                />
                              ) : (
                                item.orderNo || "-"
                              )}
                            </td>
                            <td className="w-[90px] px-3 py-1.5 whitespace-nowrap">
                              {detailEditingRowId === item.id && item.sourceType === "manual" ? (
                                <input
                                  value={detailRowEditForm.orderChannel}
                                  onChange={(e) => setDetailRowEditForm((prev) => ({ ...prev, orderChannel: e.target.value }))}
                                  className="h-9 w-[96px] rounded-xl border border-slate-200 px-3 text-xs font-normal"
                                />
                              ) : (
                                item.channelText || "-"
                              )}
                            </td>
                            <td className="w-[120px] px-3 py-1.5 whitespace-nowrap">{item.orderDateText || "-"}</td>
                            <td className="w-[120px] px-3 py-1.5 whitespace-nowrap">
                              {item.orderAmountText ? `$ ${item.orderAmountText}` : "-"}
                            </td>
                            <td className="w-[120px] px-3 py-1.5 whitespace-nowrap">
                              {detailEditingRowId === item.id ? (
                                <input
                                  value={detailRowEditForm.packingAmount}
                                  onChange={(e) => setDetailRowEditForm((prev) => ({ ...prev, packingAmount: e.target.value }))}
                                  className="h-9 w-[120px] rounded-xl border border-slate-200 px-3 text-xs font-normal"
                                />
                              ) : (
                                item.packingAmountText ? `$ ${item.packingAmountText}` : "-"
                              )}
                            </td>
                            <td className="w-[120px] px-3 py-1.5 whitespace-nowrap">
                              {item.paidAmountText ? `$ ${item.paidAmountText}` : "-"}
                            </td>
                            <td className="w-[120px] px-3 py-1.5 whitespace-nowrap">
                              {item.unpaidAmountText ? `$ ${item.unpaidAmountText}` : "-"}
                            </td>
                            <td className="w-[110px] px-3 py-1.5 whitespace-nowrap">{item.dueDateText || "-"}</td>
                            <td className="w-[104px] px-3 py-1.5 whitespace-nowrap">
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${getStatusTone(item.statusKey)}`}>
                                {getPaymentStatusLabel(item.statusKey, tx)}
                              </span>
                            </td>
                            <td className="w-[128px] px-3 py-1.5 text-right">
                              <div className="flex flex-nowrap items-center justify-end gap-2 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleTimelineRowEdit(item)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-primary hover:bg-slate-50"
                                  aria-label={tx("编辑", "Edit")}
                                  title={tx("编辑", "Edit")}
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                {detailEditingRowId === item.id ? (
                                  <button
                                    type="button"
                                    onClick={() => void voidTimelineRow(item)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50"
                                    aria-label={tx("作废", "Void")}
                                    title={tx("作废", "Void")}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                ) : null}
                                {detailEditingRowId === item.id ? (
                                  <button
                                    type="button"
                                    onClick={() => void saveInlineDetailRow()}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-primary hover:bg-slate-50"
                                    aria-label={tx("保存", "Save")}
                                    title={tx("保存", "Save")}
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => setCustomerPaymentDetailId(item.id)}
                                  className="inline-flex h-7 items-center rounded-xl bg-primary px-2.5 text-xs font-normal text-white hover:opacity-95"
                                >
                                  {tx("付款详情", "Ver pago")}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {customerDetailTotalPages > 1 ? (
                      <div className="border-t border-slate-200 px-4 py-3">
                        <div className="flex flex-nowrap items-center justify-center gap-2 overflow-x-auto">
                          <button
                            type="button"
                            onClick={() => setCustomerDetailPage(1)}
                            disabled={safeCustomerDetailPage <= 1}
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {tx("回到首页", "Ini")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setCustomerDetailPage((prev) => Math.max(prev - 1, 1))}
                            disabled={safeCustomerDetailPage <= 1}
                            className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {tx("上一页", "Ant")}
                          </button>
                          <div className="inline-flex h-9 min-w-[72px] items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                            {safeCustomerDetailPage} / {customerDetailTotalPages}
                          </div>
                          <button
                            type="button"
                            onClick={() => setCustomerDetailPage((prev) => Math.min(prev + 1, customerDetailTotalPages))}
                            disabled={safeCustomerDetailPage >= customerDetailTotalPages}
                            className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {tx("下一页", "Sig")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setCustomerDetailPage(customerDetailTotalPages)}
                            disabled={safeCustomerDetailPage >= customerDetailTotalPages}
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {tx("去最后页", "Fin")}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {!loading && activePaymentDetail ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 px-4">
            <div className="max-h-[82vh] w-full max-w-[1180px] overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                <h4 className="text-sm font-semibold text-slate-900">
                  {tx("付款详情", "Detalle de pago")} · {activePaymentDetail.orderNo || "-"}
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openNewPaymentRow}
                    disabled={activePaymentDetail.statusKey === "voided"}
                    className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {tx("新增付款", "Agregar pago")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomerPaymentDetailId("")}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700"
                    aria-label={tx("关闭", "Cerrar")}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="p-4">
                {activePaymentSummary ? (
                  <div className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-6">
                    <div>
                      <div className="text-[11px] font-medium text-slate-500">{tx("订单号", "Order no")}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{activePaymentSummary.orderNo}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-slate-500">{tx("订单金额", "Monto pedido")}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{activePaymentSummary.orderAmountText}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-slate-500">{tx("已付合计", "Pagado")}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{activePaymentSummary.paidAmountText}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-slate-500">{tx("未付金额", "Pendiente")}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{activePaymentSummary.unpaidAmountText}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-slate-500">{tx("应付款日", "Vence")}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">{activePaymentSummary.dueDateText}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-slate-500">{tx("当前状态", "Estado")}</div>
                      <div className="mt-1">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getStatusTone(activePaymentSummary.statusKey)}`}>
                          {getPaymentStatusLabel(activePaymentSummary.statusKey, tx)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="rounded-xl border border-slate-200">
                  <table className="w-full table-fixed text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-600">
                      <tr>
                        <th className="w-[11%] px-2 py-2 text-left">{tx("需付金额", "Monto por pagar")}</th>
                        <th className="w-[11%] px-2 py-2 text-left">{tx("本次付款金额", "Pago")}</th>
                        <th className="w-[11%] px-2 py-2 text-left">{tx("已付金额", "Monto pagado")}</th>
                        <th className="w-[12%] px-2 py-2 text-left">{tx("付款时间", "Fecha pago")}</th>
                        <th className="w-[12%] px-2 py-2 text-left">{tx("付款方式", "Metodo pago")}</th>
                        <th className="w-[12%] px-2 py-2 text-left">{tx("付款对象", "Destinatario")}</th>
                        <th className="w-[10%] px-2 py-2 text-left">{tx("未付金额", "Monto pendiente")}</th>
                        <th className="w-[10%] px-2 py-2 text-left">{tx("付款凭据", "Comprobante")}</th>
                        <th className="w-[6%] px-2 py-2 text-left">{tx("备注", "Nota")}</th>
                        <th className="w-[5%] px-2 py-2 text-right">{tx("操作", "Acciones")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentEditingRowId === "new" ? (
                        <tr className="border-t border-slate-100 bg-slate-50/60">
                          <td className="break-words px-2 py-1.5 align-top">{paymentRowEditForm.payableAmount ? `$ ${paymentRowEditForm.payableAmount}` : "-"}</td>
                          <td className="px-2 py-1.5 align-top">
                            <input
                              value={paymentRowEditForm.currentPaymentAmount}
                              onChange={(e) => setPaymentRowEditForm((prev) => ({ ...prev, currentPaymentAmount: e.target.value }))}
                              className="h-8 w-full min-w-0 rounded-xl border border-slate-200 px-2 text-sm"
                            />
                          </td>
                          <td className="break-words px-2 py-1.5 align-top">
                            {paymentRowEditForm.currentPaymentAmount ? `$ ${parseAmountValue(paymentRowEditForm.currentPaymentAmount).toFixed(2)}` : "-"}
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            <input
                              type="date"
                              value={paymentRowEditForm.paymentTime}
                              onChange={(e) => setPaymentRowEditForm((prev) => ({ ...prev, paymentTime: e.target.value }))}
                              className="h-8 w-full min-w-0 rounded-xl border border-slate-200 px-2 text-sm"
                            />
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            <PaymentMethodSelect
                              value={paymentRowEditForm.paymentMethod}
                              onChange={(value) => setPaymentRowEditForm((prev) => ({ ...prev, paymentMethod: value }))}
                            />
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            <PaymentTargetSelect
                              value={paymentRowEditForm.paymentTarget}
                              options={supplierShortNameOptions}
                              onChange={(value) => setPaymentRowEditForm((prev) => ({ ...prev, paymentTarget: value }))}
                            />
                          </td>
                          <td className="break-words px-2 py-1.5 align-top">
                            {paymentRowEditForm.currentPaymentAmount
                              ? `$ ${Math.max(parseAmountValue(paymentRowEditForm.payableAmount) - parseAmountValue(paymentRowEditForm.currentPaymentAmount), 0).toFixed(2)}`
                              : (paymentRowEditForm.payableAmount ? `$ ${parseAmountValue(paymentRowEditForm.payableAmount).toFixed(2)}` : "-")}
                          </td>
                          <td className="px-2 py-1.5 align-top"><span className="text-sm text-slate-400">-</span></td>
                          <td className="px-2 py-1.5 align-top">
                            <input
                              value={paymentRowEditForm.note}
                              onChange={(e) => setPaymentRowEditForm((prev) => ({ ...prev, note: e.target.value }))}
                              className="h-8 w-full min-w-0 rounded-xl border border-slate-200 px-2 text-sm"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right align-top">
                            <div className="flex flex-nowrap items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setPaymentEditingRowId("");
                                  setPaymentRowEditForm(EMPTY_PAYMENT_ROW_EDIT_FORM);
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                              >
                                <X className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void saveInlinePaymentRow()}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-primary hover:bg-slate-50"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      {pagedPaymentRows.length === 0 && paymentEditingRowId !== "new" ? (
                        <tr>
                          <td colSpan={10} className="px-3 py-8 text-center text-sm text-slate-500">
                            {tx("暂无付款记录", "Sin pagos registrados")}
                          </td>
                        </tr>
                      ) : pagedPaymentRows.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100">
                          <td className="break-words px-2 py-1.5 align-top">
                            {paymentEditingRowId === row.id ? (
                              <input
                                value={paymentRowEditForm.payableAmount}
                                onChange={(e) => setPaymentRowEditForm((prev) => ({ ...prev, payableAmount: e.target.value }))}
                                className="h-8 w-full min-w-0 rounded-xl border border-slate-200 px-2 text-sm"
                              />
                            ) : (
                              row.payableAmountText ? `$ ${row.payableAmountText}` : "-"
                            )}
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            {paymentEditingRowId === row.id ? (
                              <input
                                value={paymentRowEditForm.currentPaymentAmount}
                                onChange={(e) => setPaymentRowEditForm((prev) => ({ ...prev, currentPaymentAmount: e.target.value }))}
                                className="h-8 w-full min-w-0 rounded-xl border border-slate-200 px-2 text-sm"
                              />
                            ) : row.currentPaymentAmountText ? `$ ${row.currentPaymentAmountText}` : "-"}
                          </td>
                          <td className="break-words px-2 py-1.5 align-top">
                            {paymentEditingRowId === row.id && paymentRowEditForm.currentPaymentAmount
                              ? `$ ${Math.max(parseAmountValue(row.paidAmountText) - parseAmountValue(row.currentPaymentAmountText) + parseAmountValue(paymentRowEditForm.currentPaymentAmount), 0).toFixed(2)}`
                              : (row.paidAmountText ? `$ ${row.paidAmountText}` : "-")}
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            {paymentEditingRowId === row.id ? (
                              <input
                                type="date"
                                value={paymentRowEditForm.paymentTime}
                                onChange={(e) => setPaymentRowEditForm((prev) => ({ ...prev, paymentTime: e.target.value }))}
                                className="h-8 w-full min-w-0 rounded-xl border border-slate-200 px-2 text-sm"
                              />
                            ) : (
                              row.paymentTimeText || "-"
                            )}
                          </td>
                          <td className="break-words px-2 py-1.5 align-top whitespace-normal">
                            {paymentEditingRowId === row.id ? (
                              <PaymentMethodSelect
                                value={paymentRowEditForm.paymentMethod}
                                onChange={(value) => setPaymentRowEditForm((prev) => ({ ...prev, paymentMethod: value }))}
                              />
                            ) : (row.paymentMethodText || "-")}
                          </td>
                          <td className="break-words px-2 py-1.5 align-top whitespace-normal">
                            {paymentEditingRowId === row.id ? (
                              <PaymentTargetSelect
                                value={paymentRowEditForm.paymentTarget}
                                options={supplierShortNameOptions}
                                onChange={(value) => setPaymentRowEditForm((prev) => ({ ...prev, paymentTarget: value }))}
                              />
                            ) : (row.paymentTargetText || "-")}
                          </td>
                          <td className="break-words px-2 py-1.5 align-top">
                            {paymentEditingRowId === row.id && paymentRowEditForm.currentPaymentAmount
                              ? `$ ${Math.max(parseAmountValue(row.unpaidAmountText) + parseAmountValue(row.currentPaymentAmountText) - parseAmountValue(paymentRowEditForm.currentPaymentAmount), 0).toFixed(2)}`
                              : (row.unpaidAmountText ? `$ ${row.unpaidAmountText}` : "-")}
                          </td>
                          <td className="px-2 py-1.5 align-top">
                            {(paymentEvidenceItems[row.id] || []).length ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {(paymentEvidenceItems[row.id] || []).map((item) =>
                                  paymentEvidenceLooksLikeImage(item) ? (
                                    <button
                                      key={item.url}
                                      type="button"
                                      onClick={() => setPaymentEvidencePreview({ src: item.url, title: item.name || tx("付款证据", "Evidencia pago") })}
                                      className="group relative h-10 w-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                                      title={item.name}
                                    >
                                      <img src={item.url} alt={item.name || "payment-evidence"} className="h-full w-full object-cover transition group-hover:scale-105" />
                                    </button>
                                  ) : (
                                    <a
                                      key={item.url}
                                      href={item.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex max-w-[180px] truncate rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:border-slate-300 hover:text-slate-900"
                                      title={item.name}
                                    >
                                      {item.name}
                                    </a>
                                  ),
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">-</span>
                            )}
                          </td>
                          <td className="break-words px-2 py-1.5 align-top whitespace-normal">
                            {paymentEditingRowId === row.id ? (
                              <input
                                value={paymentRowEditForm.note}
                                onChange={(e) => setPaymentRowEditForm((prev) => ({ ...prev, note: e.target.value }))}
                                className="h-8 w-full min-w-0 rounded-xl border border-slate-200 px-2 text-sm"
                              />
                            ) : (row.noteText || "-")}
                          </td>
                          <td className="px-2 py-1.5 text-right align-top">
                            <div className="flex flex-nowrap items-center justify-end gap-2 whitespace-nowrap">
                              <input
                                ref={(node) => {
                                  paymentEvidenceInputRefs.current[row.id] = node;
                                }}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={(event) => {
                                  void handlePaymentEvidenceSelected(row.id, event.target.files);
                                  event.currentTarget.value = "";
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handlePaymentEvidenceUpload(row.id, row.sourceType)}
                                className="inline-flex h-7 items-center rounded-xl border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                title={tx("上传付款证据", "Upload payment evidence")}
                                aria-label={tx("上传付款证据", "Upload payment evidence")}
                                disabled={uploadingPaymentEvidenceRowId === row.id}
                              >
                                <Paperclip className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePaymentRowEdit(row)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-primary hover:bg-slate-50"
                                title={tx("编辑", "Edit")}
                                aria-label={tx("编辑", "Edit")}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              {paymentEditingRowId === row.id ? (
                                <button
                                  type="button"
                                  onClick={() => void saveInlinePaymentRow()}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-primary hover:bg-slate-50"
                                  title={tx("保存", "Save")}
                                  aria-label={tx("保存", "Save")}
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                              ) : null}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {uploadingPaymentEvidenceRowId === row.id ? tx("上传中...", "Uploading...") : ""}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {customerPaymentTotalPages > 1 ? (
                  <div className="border-x border-b border-slate-200 px-4 py-3">
                    <div className="flex flex-nowrap items-center justify-center gap-2 overflow-x-auto">
                      <button
                        type="button"
                        onClick={() => setCustomerPaymentPage(1)}
                        disabled={safeCustomerPaymentPage <= 1}
                        className="inline-flex h-8 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-500 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {tx("回到首页", "Ini")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomerPaymentPage((prev) => Math.max(1, prev - 1))}
                        disabled={safeCustomerPaymentPage <= 1}
                        className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {tx("上一页", "Ant")}
                      </button>
                      <div className="inline-flex h-9 min-w-[72px] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                        {safeCustomerPaymentPage} / {customerPaymentTotalPages}
                      </div>
                      <button
                        type="button"
                        onClick={() => setCustomerPaymentPage((prev) => Math.min(customerPaymentTotalPages, prev + 1))}
                        disabled={safeCustomerPaymentPage >= customerPaymentTotalPages}
                        className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {tx("下一页", "Sig")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomerPaymentPage(customerPaymentTotalPages)}
                        disabled={safeCustomerPaymentPage >= customerPaymentTotalPages}
                        className="inline-flex h-8 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-500 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {tx("去最后页", "Fin")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <ImageLightbox
          open={Boolean(paymentEvidencePreview)}
          src={paymentEvidencePreview?.src || ""}
          title={paymentEvidencePreview?.title || ""}
          overlayClassName="z-[95]"
          onClose={() => setPaymentEvidencePreview(null)}
        />

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
                      {tx("点击分类可在右侧编辑；维护中文与西语映射。", "Haga clic en una categoria para editar a la derecha.")}
                    </p>
                  </div>
                  <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
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
                                  window.setTimeout(() => categoryZhInputRef.current?.focus(), 10);
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
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{tx("快捷操作", "Acciones rapidas")}</h3>
                    <button
                      type="button"
                      onClick={() => void loadCategoryMaps()}
                      className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                    >
                      {tx("刷新友购产品分类", "Refrescar categorias YG")}
                    </button>
                  </div>
                </div>
                <div className="space-y-3 p-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <div className="border-b border-slate-200 pb-3">
                      <h4 className="text-sm font-semibold text-slate-900">{tx("新增分类", "Nueva categoria")}</h4>
                    </div>
                    <div className="grid gap-3 pt-3">
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-600">{tx("中文分类", "Categoria ZH")}</label>
                        <input
                          ref={categoryZhInputRef}
                          value={categoryForm.categoryZh}
                          onChange={(e) => setCategoryForm((p) => ({ ...p, categoryZh: e.target.value }))}
                          placeholder={tx("请输入中文分类", "Ingrese categoria ZH")}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-slate-600">{tx("西语分类", "Categoria ES")}</label>
                        <input
                          value={categoryForm.categoryEs}
                          onChange={(e) => setCategoryForm((p) => ({ ...p, categoryEs: e.target.value.toLocaleUpperCase() }))}
                          placeholder={tx("请输入西语分类", "Ingrese categoria ES")}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
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
                          className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                        />
                        <p className="mt-1 text-[10px] text-slate-500">{tx("可输入多个序号（空格/换行都可），系统会自动识别并规范化", "Puede ingresar multiples codigos y el sistema los normaliza automaticamente")}</p>
                      </div>
                      <div>
                        {renderSwitch(tx("启用", "Habilitado"), categoryForm.active, (next) => setCategoryForm((p) => ({ ...p, active: next })))}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
                      <button
                        type="button"
                        onClick={() => {
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
                          if (ok) setCategoryForm(EMPTY_CATEGORY_MAP);
                        }}
                        className="inline-flex h-9 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft disabled:opacity-40"
                      >
                        {tx("保存分类", "Guardar categoria")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

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
