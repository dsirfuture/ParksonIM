"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
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

type TabKey = "perm" | "supplier" | "customer" | "catalog" | "category" | "doc";

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

type Customer = {
  id: string;
  name: string;
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
  name: "",
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

const EMPTY_CATEGORY_MAP: CategoryMapForm = {
  id: "",
  categoryZh: "",
  categoryEs: "",
  yogoCode: "",
  active: true,
};

const TAB_LIST: TabKey[] = ["perm", "supplier", "customer", "catalog", "category", "doc"];

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

export function SettingsClient({ isAdmin, currentPermissions }: SettingsClientProps) {
  const [lang, setLang] = useState<"zh" | "es">("zh");
  const [tab, setTab] = useState<TabKey>("perm");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const [permissionRows, setPermissionRows] = useState<UserPermissionRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierKeyword, setSupplierKeyword] = useState("");
  const [supplierForm, setSupplierForm] = useState<Supplier>(EMPTY_SUPPLIER);
  const [uploadingSupplierLogo, setUploadingSupplierLogo] = useState(false);
  const [supplierEditorOpen, setSupplierEditorOpen] = useState(false);
  const [quickCategoryDraft, setQuickCategoryDraft] = useState({
    open: false,
    ruleId: "",
    categoryZh: "",
    categoryEs: "",
    active: true,
    saving: false,
  });

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerKeyword, setCustomerKeyword] = useState("");
  const [customerForm, setCustomerForm] = useState<Customer>(EMPTY_CUSTOMER);

  const [catalogConfig, setCatalogConfig] = useState<CatalogConfig>(EMPTY_CATALOG);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [categoryMaps, setCategoryMaps] = useState<CategoryMap[]>([]);
  const [categoryKeyword, setCategoryKeyword] = useState("");
  const [categoryForm, setCategoryForm] = useState<CategoryMapForm>(EMPTY_CATEGORY_MAP);
  const [categoryDefaultActive, setCategoryDefaultActive] = useState(true);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const categoryZhInputRef = useRef<HTMLInputElement | null>(null);

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
      catalog: tx("目录配置", "CatCfg"),
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
      if (cRes.ok && cJson?.ok) setCustomers(cJson.items || []);
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
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/settings/suppliers/logo", {
        method: "POST",
        body: form,
      });
      const json = await readJson<any>(res);
      if (!res.ok || !json?.ok || !json?.url) {
        throw new Error(json?.error || tx("上传失败", "Upload fail"));
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

  async function saveCustomer() {
    try {
      setError("");
      await saveEntity("/api/settings/customers", customerForm, "客户已保存", "Cli saved");
      setCustomerForm(EMPTY_CUSTOMER);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("保存客户失败", "Save cli fail"));
    }
  }

  async function deleteCustomer(id: string) {
    try {
      setError("");
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
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/settings/catalog-config/logo", {
        method: "POST",
        body: form,
      });
      const json = await readJson<any>(res);
      if (!res.ok || !json?.ok || !json?.url) {
        throw new Error(json?.error || tx("上传失败", "Upload fail"));
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
      await saveEntity("/api/settings/category-maps", categoryForm, "分类已保存", "Category saved");
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

  const filteredCustomers = useMemo(
    () =>
      customers.filter((c) =>
        [c.name, c.contact, c.phone, c.whatsapp, c.tags]
          .join(" ")
          .toLowerCase()
          .includes(customerKeyword.trim().toLowerCase()),
      ),
    [customers, customerKeyword],
  );

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
              <div className="max-h-[360px] overflow-auto">
                <table className="w-full min-w-[1040px] text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="w-[76px] px-3 py-2 text-left">LOGO</th>
                      <th className="px-3 py-2 text-left">{tx("简称", "Short")}</th>
                      <th className="px-3 py-2 text-left">{tx("全称", "Full")}</th>
                      <th className="px-3 py-2 text-left">{tx("联系人 / 电话", "Cont / Tel")}</th>
                      <th className="px-3 py-2 text-left">{tx("折扣规则", "Disc rule")}</th>
                      <th className="px-3 py-2 text-left">{tx("账期", "Term")}</th>
                      <th className="px-3 py-2 text-left">{tx("状态", "Status")}</th>
                      <th className="w-[88px] px-3 py-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuppliers.map((s) => (
                      <tr key={s.id} className="border-t border-slate-100">
                        <td className="px-3 py-2.5">
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
                        <td className="px-3 py-2 font-semibold">{s.shortName || "-"}</td>
                        <td className="px-3 py-2">{s.fullName || "-"}</td>
                        <td className="px-3 py-2">{`${s.contact || "-"} / ${s.phone || "-"}`}</td>
                        <td className="px-3 py-2">
                          {s.discountRules.length
                            ? tx(`已配置 ${s.discountRules.length} 条`, `${s.discountRules.length} reglas`)
                            : tx("未配置", "Sin configurar")}
                        </td>
                        <td className="px-3 py-2">{s.accountPeriodDays ? `${s.accountPeriodDays} ${tx("天", "d")}` : "-"}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              s.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {s.enabled ? tx("启用", "Activo") : tx("停用", "Inactivo")}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
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
            <div className="max-h-[86vh] w-full max-w-[1080px] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-soft">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-base font-semibold text-slate-900">{tx("供应商信息", "Info prov")}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {tx("用于新增、编辑和维护供应商基础资料。", "Alta, edicion y mantenimiento de datos base del proveedor.")}
                </p>
              </div>
              <div className="space-y-3 p-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="grid gap-2.5 lg:grid-cols-2">
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
            <div className="grid gap-3 lg:grid-cols-4">
              <input value={customerForm.name} onChange={(e) => setCustomerForm((p) => ({ ...p, name: e.target.value }))} placeholder={tx("客户名称", "Client")} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
              <input value={customerForm.contact} onChange={(e) => setCustomerForm((p) => ({ ...p, contact: e.target.value }))} placeholder={tx("联系人", "Cont")} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
              <input value={customerForm.phone} onChange={(e) => setCustomerForm((p) => ({ ...p, phone: e.target.value }))} placeholder={tx("手机", "Mob")} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
              <input value={customerForm.whatsapp} onChange={(e) => setCustomerForm((p) => ({ ...p, whatsapp: e.target.value }))} placeholder="WhatsApp" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
              <input value={customerForm.email} onChange={(e) => setCustomerForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
              <input value={customerForm.stores} onChange={(e) => setCustomerForm((p) => ({ ...p, stores: e.target.value }))} placeholder={tx("门店地址", "Stores")}
                className="h-10 rounded-xl border border-slate-200 px-3 text-sm lg:col-span-2" />
              <input value={customerForm.cityCountry} onChange={(e) => setCustomerForm((p) => ({ ...p, cityCountry: e.target.value }))} placeholder={tx("城市/国家", "City/Ctry")} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
              <input value={customerForm.customerType} onChange={(e) => setCustomerForm((p) => ({ ...p, customerType: e.target.value }))} placeholder={tx("客户类型", "Type")} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
              <input value={customerForm.vipLevel} onChange={(e) => setCustomerForm((p) => ({ ...p, vipLevel: e.target.value }))} placeholder={tx("VIP等级", "VIP lvl")} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
              <input value={customerForm.creditLevel} onChange={(e) => setCustomerForm((p) => ({ ...p, creditLevel: e.target.value }))} placeholder={tx("信用等级", "Credit")} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
              <input value={customerForm.tags} onChange={(e) => setCustomerForm((p) => ({ ...p, tags: e.target.value }))} placeholder={tx("标签", "Tags")} className="h-10 rounded-xl border border-slate-200 px-3 text-sm lg:col-span-2" />
              <input value={customerForm.orderStats} onChange={(e) => setCustomerForm((p) => ({ ...p, orderStats: e.target.value }))} placeholder={tx("下单统计", "Order stats")} className="h-10 rounded-xl border border-slate-200 px-3 text-sm lg:col-span-2" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={!canManageCustomers} onClick={() => void saveCustomer()} className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40">{tx("保存客户", "Save cli")}</button>
              <button type="button" onClick={() => setCustomerForm(EMPTY_CUSTOMER)} className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">{tx("清空", "Clear")}</button>
              <input value={customerKeyword} onChange={(e) => setCustomerKeyword(e.target.value)} placeholder={tx("搜索客户", "Search cli")} className="h-10 min-w-[240px] rounded-xl border border-slate-200 px-3 text-sm" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">{tx("客户", "Client")}</th>
                    <th className="px-3 py-2 text-left">{tx("联系人", "Cont")}</th>
                    <th className="px-3 py-2 text-left">{tx("手机/WA", "Mob/WA")}</th>
                    <th className="px-3 py-2 text-left">{tx("类型", "Type")}</th>
                    <th className="px-3 py-2 text-left">{tx("标签", "Tags")}</th>
                    <th className="px-3 py-2 text-left">{tx("操作", "Act")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-semibold">{c.name}</td>
                      <td className="px-3 py-2">{c.contact || "-"}</td>
                      <td className="px-3 py-2">{`${c.phone || "-"} / ${c.whatsapp || "-"}`}</td>
                      <td className="px-3 py-2">{c.customerType || "-"}</td>
                      <td className="px-3 py-2">{c.tags || "-"}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setCustomerForm(c)} className="text-primary">{tx("编辑", "Edit")}</button>
                          <button type="button" disabled={!canManageCustomers} onClick={() => void deleteCustomer(c.id)} className="text-rose-600 disabled:opacity-40">{tx("删除", "Del")}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {!loading && tab === "catalog" ? (
          <div className="space-y-4 p-5">
            <div className="grid gap-3 lg:grid-cols-3">
              <input value={catalogConfig.customer} onChange={(e) => setCatalogConfig((p) => ({ ...p, customer: e.target.value }))} placeholder={tx("选择客户", "Sel cli")} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
              <input value={catalogConfig.category} onChange={(e) => setCatalogConfig((p) => ({ ...p, category: e.target.value }))} placeholder={tx("选择分类", "Sel cat")} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
              <input value={catalogConfig.discount} onChange={(e) => setCatalogConfig((p) => ({ ...p, discount: e.target.value }))} placeholder={tx("选择折扣", "Sel disc")} className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />

              <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm"><input type="checkbox" checked={catalogConfig.showStock} onChange={(e) => setCatalogConfig((p) => ({ ...p, showStock: e.target.checked }))} />{tx("显示库存", "Show stock")}</label>
              <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm"><input type="checkbox" checked={catalogConfig.showImage} onChange={(e) => setCatalogConfig((p) => ({ ...p, showImage: e.target.checked }))} />{tx("显示图片", "Show img")}</label>
              <select value={catalogConfig.language} onChange={(e) => setCatalogConfig((p) => ({ ...p, language: e.target.value as CatalogConfig["language"] }))} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
                <option value="zh">中文</option>
                <option value="es">ES</option>
              </select>

              <input value={catalogConfig.cover} onChange={(e) => setCatalogConfig((p) => ({ ...p, cover: e.target.value }))} placeholder={tx("封面地址", "Cover URL")} className="h-10 rounded-xl border border-slate-200 px-3 text-sm lg:col-span-3" />
              <textarea value={catalogConfig.note} onChange={(e) => setCatalogConfig((p) => ({ ...p, note: e.target.value }))} placeholder={tx("说明", "Note")} className="min-h-[96px] rounded-xl border border-slate-200 px-3 py-2 text-sm lg:col-span-3" />
            </div>

            <button type="button" disabled={!canManageProducts} onClick={() => void saveCatalog()} className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40">{tx("保存目录配置", "Save cfg")}</button>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 text-sm font-semibold">{tx("清单展示方式", "Output")}</div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                <li>PDF</li>
                <li>Excel</li>
                <li>{tx("分享链接（WhatsApp/微信）", "Share (WA/WX)")}</li>
              </ul>
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
                            yogoCode: normalizeYogoCodeInput(e.target.value),
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const normalized = normalizeYogoCodeInput((e.currentTarget as HTMLInputElement).value);
                            setCategoryForm((p) => ({ ...p, yogoCode: normalized }));
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
