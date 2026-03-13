"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TableCard } from "@/components/table-card";
import { ProductImage } from "@/components/product-image";
import { ImageLightbox } from "@/components/image-lightbox";
import * as XLSX from "xlsx";
import { getClientLang } from "@/lib/lang-client";
import { buildProductImageUrl, HAS_REMOTE_PRODUCT_IMAGE_BASE } from "@/lib/product-image-url";

type ProductRow = {
  id: string;
  sku: string;
  barcode: string;
  nameZh: string;
  nameEs: string;
  casePack: number | null;
  cartonPack: number | null;
  priceText: string;
  normalDiscountText: string;
  vipDiscountText: string;
  category: string;
  categoryName: string;
  subcategory: string;
  supplier: string;
  hasImage: boolean;
  available: number;
  statusText: string;
  isNewProduct: boolean | null;
};

type Props = {
  initialRows: ProductRow[];
  readOnlyMode?: boolean;
  yogoLastUpdatedText?: string;
  visibleCategoryOptions?: string[];
  visibleSupplierOptions?: string[];
};

type EditState = {
  id: string;
  sku: string;
  barcode: string;
  nameZh: string;
  nameEs: string;
  casePack: string;
  cartonPack: string;
  price: string;
  normalDiscount: string;
  vipDiscount: string;
  category: string;
  supplier: string;
  available: string;
  isNewProduct: boolean;
};

type BatchUpdateState = {
  supplier: string;
  category: string;
  available: "" | "0" | "1";
  normalDiscount: string;
  vipDiscount: string;
};

type ImportRecord = {
  id: string;
  fileName: string;
  totalRows: number;
  createdCount: number;
  changedCount: number;
  unchangedCount: number;
  onShelfCount: number;
  offShelfCount: number;
  hasFile: boolean;
  comparedFields: string;
  createdAt: string;
};

const PAGE_SIZE = 50;

const vipLast = (s: string) => {
  const m = s.match(/(\d+)\s*%/);
  if (!m) return s;
  return `${m[1].slice(-1)}%`;
};

const QUICK_LABELS: Record<string, { zh: string; es: string }> = {
  hasImage: { zh: "有图", es: "Con img" },
  noImage: { zh: "无图", es: "Sin img" },
  hasBarcode: { zh: "有条形码", es: "Con cod" },
  noBarcode: { zh: "无条形码", es: "Sin cod" },
  hasZh: { zh: "有中文名", es: "Con ZH" },
  noZh: { zh: "无中文名", es: "Sin ZH" },
  hasEs: { zh: "有西语名", es: "Con ES" },
  noEs: { zh: "无西语名", es: "Sin ES" },
  hasCategory: { zh: "有分类", es: "Con cat" },
  noCategory: { zh: "无分类", es: "Sin cat" },
  hasCasePack: { zh: "有包装数", es: "Con pack" },
  noCasePack: { zh: "无包装数", es: "Sin pack" },
  hasCartonPack: { zh: "有装箱数", es: "Con cart" },
  noCartonPack: { zh: "无装箱数", es: "Sin cart" },
  hasVipDiscount: { zh: "有VIP折扣", es: "Con VIP" },
  noVipDiscount: { zh: "无VIP折扣", es: "Sin VIP" },
  onShelf: { zh: "友购上架", es: "YG ON" },
  offShelf: { zh: "友购下架", es: "YG OFF" },
  isNew: { zh: "有新增", es: "Con nuevo" },
  isBlankChange: { zh: "无新增", es: "Sin nuevo" },
};

export function ProductsManagementClient({
  initialRows,
  readOnlyMode = false,
  yogoLastUpdatedText = "最近一次友购产品更新时间是：暂无",
  visibleCategoryOptions = [],
  visibleSupplierOptions = [],
}: Props) {
  const [lang, setLang] = useState<"zh" | "es">("zh");
  const [rows, setRows] = useState(initialRows);
  const [keyword, setKeyword] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickSelected, setQuickSelected] = useState<string[]>([]);
  const [quickSnapshot, setQuickSnapshot] = useState<string[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [importMode, setImportMode] = useState<"initial" | "compare">("compare");
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [batchUpdate, setBatchUpdate] = useState<BatchUpdateState>({
    supplier: "",
    category: "",
    available: "",
    normalDiscount: "",
    vipDiscount: "",
  });
  const [dup, setDup] = useState<{ open: boolean; skus: Array<{ sku: string; count: number }>; msg: string }>({ open: false, skus: [], msg: "" });
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingMode, setPendingMode] = useState<"initial" | "compare">("compare");
  const [viewMode, setViewMode] = useState<"catalog" | "imports">("catalog");
  const [importRecords, setImportRecords] = useState<ImportRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [preview, setPreview] = useState<{ open: boolean; src: string; title: string }>({
    open: false,
    src: "",
    title: "",
  });
  const [catalogShareOpen, setCatalogShareOpen] = useState(false);
  const [catalogCategory, setCatalogCategory] = useState("all");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const repairFileRef = useRef<HTMLInputElement | null>(null);
  const zhFallbackMap: Record<string, string> = {
    "Con img": "有图",
    "Sin img": "无图",
    "Con cod": "有条形码",
    "Sin cod": "无条形码",
    "Con ZH": "有中文名",
    "Sin ZH": "无中文名",
    "Con ES": "有西文名",
    "Sin ES": "无西文名",
    "Con pack": "有包装数",
    "Sin pack": "无包装数",
    "Con cart": "有装箱数",
    "Sin cart": "无装箱数",
    "Con VIP": "有VIP折扣",
    "Sin VIP": "无VIP折扣",
    "YG ON": "友购上架",
    "YG OFF": "友购下架",
    "Con nuevo": "有新增",
    "Sin nuevo": "无新增",
    "Load fail": "读取失败",
    "Load hist fail": "读取导入记录失败",
    "SKU dup": "检测到重复SKU",
    "Import fail": "导入失败",
    "Save fail": "保存失败",
    "No rows to edit": "暂无可编辑数据",
    "Fill at least one field": "请至少填写一项",
    "Batch fail": "批量修改失败",
    "Delete fail": "删除失败",
    "Filtered list is empty": "当前筛选结果为空",
    "Type DELETE to confirm": "请输入 DELETE 以确认删除",
    "Batch delete fail": "批量删除失败",
    "No filtered rows to export": "当前筛选无数据",
    "No rows to export": "当前没有可导出的商品数据",
    "Fix fail": "修复商品数据失败",
    "Delete this import record?": "确认删除这条导入记录吗？",
    "Delete hist fail": "删除导入记录失败",
    "Prod cfg": "产品管理",
    "Imp + cmp SKU": "导入产品目录并按 SKU 自动对比",
    "Proc...": "处理中...",
    "Imp cmp": "对比数据导入",
    "Alta": "新增产品",
    "Buscar SKU/cod/nom/cat/prov": "搜索 SKU、条形码、品名、分类、供应商",
    "Cat prod": "产品目录",
    "Share catalog": "分享客户产品清单",
    "YG on:": "友购上架产品共：",
    "YG off:": "下架共：",
    "Exp all": "导出全部商品",
    "Fix...": "修复中...",
    "Fix": "修复商品数据",
    "Hist": "导入记录",
    "Back": "返回目录",
    "Img": "图片",
    "Cod": "编号",
    "ZH": "中文名",
    "ES": "西文名",
    "Pk": "包装数",
    "Ct": "装箱数",
    "PV": "卖价",
    "Dsc": "普通折扣",
    "On?": "是否上架",
    "New?": "是否新增",
    "Del": "删除",
    "Ini": "回到首页",
    "Ant": "上一页",
    "Sig": "下一页",
    "Fin": "去最后页",
    "Archivo": "文件名",
    "Fecha": "导入时间",
    "Items": "商品数量",
    "Nuevo": "新增",
    "Cambio": "变化",
    "Sin camb": "无变化",
    "ON/OFF": "上架/下架",
    "Campos": "对比字段",
    "Exp": "导出",
    "Carg...": "加载中...",
    "Sin hist": "暂无记录",
    "Del hist": "删除记录",
    "Edit": "编辑产品",
    "Nom ZH": "中文名",
    "Nom ES": "西文名",
    "Pack": "包装数",
    "Cart": "装箱数",
    "Sel cat": "请选择分类",
    "No cat, input": "暂无分类数据，可手动输入",
    "Sel prov": "请选择供应商",
    "Estado": "状态",
    "ON": "上架",
    "OFF": "下架",
    "Marca": "标记为“新”",
    "Canc": "取消",
    "Guard...": "保存中...",
    "Guardar": "保存",
    "Filt + edit": "批量筛选与修改",
    "Base cond": "基础条件",
    "No cat data": "暂无分类数据",
    "No prov data": "暂无供应商数据",
    "Cat": "分类",
    "Subcat": "子分类",
    "No chg": "不改",
    "Prov": "供应商",
    "VIP": "VIP折扣",
    "Empty keep": "未填写或未选择的字段将保持不变。",
    "Exp filt": "导出筛选结果",
    "Lim": "清空",
    "Apply filt": "应用筛选",
    "Guar": "保存修改",
    "Del filt": "删除筛选结果",
    "Filt cat": "筛选分类",
    "Keep 1st": "保留第一条",
    "Keep last": "保留最后一条",
    "Base import...": "基础数据导入...",
    "Compare...": "对比中...",
    "Prog": "进度",
    "Pick category, export PDF/XLSX and share": "选择品类导出 PDF / XLSX，可直接分享客户",
    "Category": "品类",
    "All": "全部",
    "Export PDF": "导出 PDF",
    "Export XLSX": "导出 XLSX",
    "Share WhatsApp": "分享到 WhatsApp",
    "Paste copied link in WeChat": "微信请粘贴已复制链接",
    "Share WeChat": "分享到微信",
    "Close": "关闭",
    "Read only source": "当前为 YOGO 同步源，只读预览模式",
  };
  const tx = (zh: string, es: string) => {
    if (lang !== "zh") return es;
    if (!zh || zh.includes("?") || zh.includes("涓") || zh.includes("鏈") || zh.includes("鏃")) {
      return zhFallbackMap[es] || es;
    }
    return zh;
  };
  const catalogExportUrl = (format: "pdf" | "xlsx") =>
    `/api/products/catalog-export?format=${format}&category=${encodeURIComponent(catalogCategory)}&lang=${lang}`;
  const catalogSharePdfUrl = () =>
    `${catalogExportUrl("pdf")}&share=1`;
  const catalogShareXlsxUrl = () =>
    `${catalogExportUrl("xlsx")}&share=1`;
  const quickBaseOptions = [
    { key: "hasImage", label: tx("有图", "Con img") },
    { key: "noImage", label: tx("无图", "Sin img") },
    { key: "hasBarcode", label: tx("有条形码", "Con cod") },
    { key: "noBarcode", label: tx("无条形码", "Sin cod") },
    { key: "hasZh", label: tx("有中文名", "Con ZH") },
    { key: "noZh", label: tx("无中文名", "Sin ZH") },
    { key: "hasEs", label: tx("有西文名", "Con ES") },
    { key: "noEs", label: tx("无西文名", "Sin ES") },
    { key: "hasCategory", label: tx("有分类", "Con cat") },
    { key: "noCategory", label: tx("无分类", "Sin cat") },
    { key: "hasCasePack", label: tx("有包装数", "Con pack") },
    { key: "noCasePack", label: tx("无包装数", "Sin pack") },
    { key: "hasCartonPack", label: tx("有装箱数", "Con cart") },
    { key: "noCartonPack", label: tx("无装箱数", "Sin cart") },
    { key: "hasVipDiscount", label: tx("有VIP折扣", "Con VIP") },
    { key: "noVipDiscount", label: tx("无VIP折扣", "Sin VIP") },
    { key: "onShelf", label: tx("友购上架", "YG ON") },
    { key: "offShelf", label: tx("友购下架", "YG OFF") },
    { key: "isNew", label: tx("有新增", "Con nuevo") },
    { key: "isBlankChange", label: tx("无新增", "Sin nuevo") },
  ];

  useEffect(() => {
    setLang(getClientLang());
  }, []);

  useEffect(() => {
    if (!uploading) return;
    const t = setInterval(() => setProgress((p) => (p >= 90 ? p : p + 8)), 250);
    return () => clearInterval(t);
  }, [uploading]);

  const supplierOptions = useMemo(
    () => {
      const allSuppliers = Array.from(
        new Set(rows.map((r) => (r.supplier || "").trim()).filter(Boolean)),
      );
      const visibleSet = new Set(visibleSupplierOptions.map((item) => item.trim()).filter(Boolean));
      const filtered = visibleSet.size
        ? allSuppliers.filter((item) => visibleSet.has(item))
        : allSuppliers;
      return ["all", ...filtered];
    },
    [rows, visibleSupplierOptions],
  );
  const shareCategoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((r) => (r.categoryName || "").trim())
            .filter((name) => name && name !== "-"),
        ),
      ),
    [rows],
  );
  const categoryOptions = useMemo(
    () => {
      const allCategories = Array.from(
        new Set(
          rows
            .map((r) => (r.categoryName && r.categoryName !== "-" ? r.categoryName : r.category).trim())
            .filter(Boolean),
        ),
      );
      const visibleSet = new Set(visibleCategoryOptions.map((item) => item.trim()).filter(Boolean));
      const filtered = visibleSet.size
        ? allCategories.filter((item) => visibleSet.has(item))
        : allCategories;
      return ["all", ...filtered];
    },
    [rows, visibleCategoryOptions],
  );
  const supplierChoices = supplierOptions.filter((s) => s !== "all");
  const categoryChoices = categoryOptions.filter((c) => c !== "all");
  const filteredCategoryChoices = categoryChoices;
  const filteredSupplierChoices = supplierChoices;
  const editCategoryOptions = useMemo(
    () => Array.from(new Set([...categoryChoices, ...(edit?.category ? [edit.category] : [])])),
    [categoryChoices, edit?.category],
  );
  const editSupplierOptions = useMemo(
    () => Array.from(new Set([...supplierChoices, ...(edit?.supplier ? [edit.supplier] : [])])),
    [supplierChoices, edit?.supplier],
  );
  const on = rows.filter((r) => r.statusText === "上架").length;
  const off = rows.length - on;

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const v = keyword.trim().toLowerCase();
        const kw =
          !v ||
          [r.sku, r.barcode, r.nameZh, r.nameEs, r.category, r.categoryName, r.supplier]
            .join(" ")
            .toLowerCase()
            .includes(v);

        const quickMatched = quickSelected.every((key) => {
          if (key.startsWith("cat:")) {
            const categoryText = (r.categoryName && r.categoryName !== "-" ? r.categoryName : r.category).trim();
            return categoryText === key.slice(4);
          }
          if (key.startsWith("supplier:")) return r.supplier === key.slice(9);
          if (key === "hasImage") return imageFlag(r);
          if (key === "noImage") return !imageFlag(r);
          if (key === "hasBarcode") return Boolean(r.barcode);
          if (key === "noBarcode") return !r.barcode;
          if (key === "hasZh") return Boolean(r.nameZh);
          if (key === "noZh") return !r.nameZh;
          if (key === "hasEs") return Boolean(r.nameEs);
          if (key === "noEs") return !r.nameEs;
          if (key === "hasCategory") return Boolean(r.category);
          if (key === "noCategory") return !r.category;
          if (key === "hasCasePack") return r.casePack !== null;
          if (key === "noCasePack") return r.casePack === null;
          if (key === "hasCartonPack") return r.cartonPack !== null;
          if (key === "noCartonPack") return r.cartonPack === null;
          if (key === "hasVipDiscount") return r.vipDiscountText !== "-" && vipLast(r.vipDiscountText) !== "0%";
          if (key === "noVipDiscount") return r.vipDiscountText === "-" || vipLast(r.vipDiscountText) === "0%";
          if (key === "onShelf") return r.statusText === "上架";
          if (key === "offShelf") return r.statusText !== "上架";
          if (key === "isNew") return r.isNewProduct === true;
          if (key === "isBlankChange") return r.isNewProduct !== true;
          return true;
        });

        return kw && quickMatched;
      }),
    [rows, keyword, quickSelected],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function toggleQuick(key: string, checked: boolean) {
    setQuickSelected((prev) => (checked ? [...prev, key] : prev.filter((v) => v !== key)));
    setPage(1);
  }

  function openQuickModal() {
    const baseKeys = new Set(quickBaseOptions.map((item) => item.key));
    const cleaned = quickSelected.filter((key) => baseKeys.has(key) || key.startsWith("cat:") || key.startsWith("supplier:"));
    setQuickSelected(cleaned);
    setQuickSnapshot([...cleaned]);
    setQuickOpen(true);
  }

  function cancelQuickModal() {
    if (quickSnapshot) setQuickSelected(quickSnapshot);
    setQuickOpen(false);
    setQuickSnapshot(null);
  }

  function applyQuickFilter() {
    setQuickOpen(false);
    setQuickSnapshot(null);
  }

  async function refreshRows(nextKeyword = keyword) {
    const q = nextKeyword.trim() ? `?keyword=${encodeURIComponent(nextKeyword.trim())}` : "";
    const res = await fetch(`/api/products${q}`);
    const json = await res.json();
    if (!res.ok || !json?.ok) throw new Error(json?.error || tx("读取失败", "Load fail"));
    setRows(json.items || []);
  }

  async function loadImportRecords() {
    try {
      setRecordsLoading(true);
      const res = await fetch("/api/products/import-records");
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || tx("读取导入记录失败", "Load hist fail"));
      setImportRecords(json.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("读取导入记录失败", "Load hist fail"));
    } finally {
      setRecordsLoading(false);
    }
  }

  async function uploadFile(file: File, duplicateStrategy?: "first" | "last") {
    if (readOnlyMode) {
      setError(tx("当前为 YOGO 同步源，只读预览模式", "Read only source"));
      return;
    }
    try {
      setUploading(true); setProgress(8); setError("");
      const form = new FormData();
      form.append("file", file);
      form.append("mode", importMode);
      if (duplicateStrategy) form.append("duplicateStrategy", duplicateStrategy);
      const res = await fetch("/api/products/import", { method: "POST", body: form });
      const json = await res.json();
      if (res.status === 409 && json?.needsResolution) {
        setPendingFile(file); setPendingMode(importMode);
        setDup({ open: true, skus: json.duplicateSkus || [], msg: json.error || tx("检测到重复SKU", "SKU dup") });
        return;
      }
      if (!res.ok || !json?.ok) throw new Error(json?.error || tx("导入失败", "Import fail"));
      setProgress(100);
      await refreshRows();
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("导入失败", "Import fail"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function saveEdit() {
    if (readOnlyMode) {
      setError(tx("当前为 YOGO 同步源，只读预览模式", "Read only source"));
      return;
    }
    if (!edit) return;
    try {
      setSaving(true);
      const isCreate = !edit.id;
      const res = await fetch(isCreate ? "/api/products" : `/api/products/${edit.id}`, {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...edit }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || tx("保存失败", "Save fail"));
      await refreshRows();
      setEdit(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("保存失败", "Save fail"));
    } finally {
      setSaving(false);
    }
  }

  async function applyBatchUpdate() {
    if (readOnlyMode) {
      setError(tx("当前为 YOGO 同步源，只读预览模式", "Read only source"));
      return;
    }
    if (filtered.length === 0) {
      setError(tx("暂无可编辑数据", "No rows to edit"));
      return;
    }

    const payload: Record<string, unknown> = {};
    if (batchUpdate.supplier.trim()) payload.supplier = batchUpdate.supplier.trim();
    if (batchUpdate.category.trim()) payload.category = batchUpdate.category.trim();
    if (batchUpdate.available !== "") payload.available = batchUpdate.available;
    if (batchUpdate.normalDiscount.trim()) payload.normalDiscount = batchUpdate.normalDiscount.trim();
    if (batchUpdate.vipDiscount.trim()) payload.vipDiscount = batchUpdate.vipDiscount.trim();

    if (Object.keys(payload).length === 0) {
      setError(tx("请至少填写一项", "Fill at least one field"));
      return;
    }

    try {
      setBatchUpdating(true);
      setError("");
      const ids = filtered.map((row) => row.id);
      const res = await fetch("/api/products/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, ...payload }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || tx("批量修改失败", "Batch fail"));

      await refreshRows();
      setQuickOpen(false);
      setBatchUpdate({
        supplier: "",
        category: "",
        available: "",
        normalDiscount: "",
        vipDiscount: "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("批量修改失败", "Batch fail"));
    } finally {
      setBatchUpdating(false);
    }
  }

  async function deleteProduct(id: string, sku: string) {
    if (readOnlyMode) {
      setError(tx("当前为 YOGO 同步源，只读预览模式", "Read only source"));
      return;
    }
    const confirmText = window.prompt(lang === "zh" ? `请输入完整 SKU 确认删除：${sku}` : `Type full SKU to delete: ${sku}`);
    if (confirmText !== sku) return;
    try {
      setError("");
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || tx("删除失败", "Delete fail"));
      setRows((prev) => prev.filter((row) => row.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("删除失败", "Delete fail"));
    }
  }

  async function deleteFilteredRows() {
    if (readOnlyMode) {
      setError(tx("当前为 YOGO 同步源，只读预览模式", "Read only source"));
      return;
    }
    if (filtered.length === 0) {
      setError(tx("当前筛选结果为空", "Filtered list is empty"));
      return;
    }
    if (!window.confirm(lang === "zh" ? `确认删除当前筛选的 ${filtered.length} 个商品吗？` : `Delete ${filtered.length} filtered items?`)) return;
    const confirmText = window.prompt(tx("请输入 DELETE 以确认删除", "Type DELETE to confirm"));
    if (confirmText !== "DELETE") return;
    try {
      setError("");
      const ids = filtered.map((item) => item.id);
      const res = await fetch("/api/products/batch-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || tx("批量删除失败", "Batch delete fail"));
      setRows((prev) => prev.filter((item) => !ids.includes(item.id)));
      setQuickOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("批量删除失败", "Batch delete fail"));
    }
  }

  function exportFilteredRows() {
    if (filtered.length === 0) {
      setError(tx("当前筛选无数据", "No filtered rows to export"));
      return;
    }
    const data = filtered.map((r) => ({
      图片: imageFlag(r) ? "有图" : "无图",
      编号: r.sku,
      条形码: r.barcode || "",
      中文名: r.nameZh || "",
      西文名: r.nameEs || "",
      包装数: r.casePack ?? "",
      装箱数: r.cartonPack ?? "",
      卖价: r.priceText,
      普通折扣: r.normalDiscountText,
      VIP折扣: vipLast(r.vipDiscountText),
      分类: r.category || "",
      子分类: r.subcategory || "",
      供应商: r.supplier || "",
      是否上架: r.statusText === "上架" ? "上架" : "下架",
      是否新增: r.isNewProduct === null ? "-" : r.isNewProduct ? "新" : "无",
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "产品筛选结果");
    const nameParts = quickSelected
      .map((k) =>
        k.startsWith("cat:")
          ? `${tx("分类", "Cat")}-${k.slice(4)}`
          : k.startsWith("supplier:")
            ? `${tx("供应商", "Prov")}-${k.slice(9)}`
            : (QUICK_LABELS[k] ? QUICK_LABELS[k][lang] : k),
      )
      .filter(Boolean);
    const fileName = `${(nameParts.length > 0 ? nameParts.join("_") : "全部商品").replace(/[\\/:*?"<>|]+/g, "_")}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  function exportAllRows() {
    if (rows.length === 0) {
      setError(tx("当前没有可导出的商品数据", "No rows to export"));
      return;
    }
    const data = rows.map((r) => ({
      图片: imageFlag(r) ? "有图" : "无图",
      编号: r.sku,
      条形码: r.barcode || "",
      中文名: r.nameZh || "",
      西文名: r.nameEs || "",
      包装数: r.casePack ?? "",
      装箱数: r.cartonPack ?? "",
      卖价: r.priceText,
      普通折扣: r.normalDiscountText,
      VIP折扣: vipLast(r.vipDiscountText),
      分类: r.category || "",
      子分类: r.subcategory || "",
      供应商: r.supplier || "",
      是否上架: r.statusText === "上架" ? "上架" : "下架",
      是否新增: r.isNewProduct === null ? "-" : r.isNewProduct ? "新" : "无",
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "全部商品");
    XLSX.writeFile(wb, "全部商品.xlsx");
  }

  async function repairProductsFromFile(file: File) {
    if (readOnlyMode) {
      setError(tx("当前为 YOGO 同步源，只读预览模式", "Read only source"));
      return;
    }
    try {
      setRepairing(true);
      setError("");
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/products/repair", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || tx("修复商品数据失败", "Fix fail"));
      await refreshRows();
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("修复商品数据失败", "Fix fail"));
    } finally {
      setRepairing(false);
      if (repairFileRef.current) repairFileRef.current.value = "";
    }
  }

  async function deleteImportRecord(id: string) {
    if (!window.confirm(tx("确认删除这条导入记录吗？", "Delete this import record?"))) return;
    try {
      setError("");
      const res = await fetch(`/api/products/import-records/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || tx("删除导入记录失败", "Delete hist fail"));
      setImportRecords((prev) => prev.filter((item) => item.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : tx("删除导入记录失败", "Delete hist fail"));
    }
  }

  function exportImportRecord(id: string) {
    window.open(`/api/products/import-records/${id}`, "_blank");
  }

  return (
    <section className="space-y-4">
      <TableCard title={tx("产品管理", "Prod cfg")} description={tx("导入、筛选、批量修改并维护商品数据。", "Importe, filtre, edite por lote y mantenga datos de productos.")}>
        <div className="space-y-3 p-4">
          <div className="overflow-x-auto">
	            <div className="grid min-w-[1280px] grid-cols-[auto_400px_auto] items-center gap-3">
	              <div className="flex items-center gap-2 whitespace-nowrap">
	              <button type="button" onClick={() => { setImportMode("compare"); fileRef.current?.click(); }} disabled={uploading || readOnlyMode} className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{uploading ? tx("处理中...", "Proc...") : tx("对比数据导入", "Imp cmp")}</button>
	              <input ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFile(f); }} />
	              <button type="button" onClick={openQuickModal} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">
	                {lang === "zh" ? `批量筛选（${filtered.length}）` : `Filt (${filtered.length})`}
	              </button>
	              </div>

              <input value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }} placeholder={tx("搜索 SKU、条形码、品名、分类、供应商", "Buscar SKU/cod/nom/cat/prov")} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm" />

              <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
              <div className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <span>{tx("上架", "ON")}</span>
                <span className="rounded-md border border-emerald-300 bg-white px-1.5 py-0.5">{on}</span>
              </div>
              <div className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                <span>{tx("下架", "OFF")}</span>
                <span className="rounded-md border border-rose-300 bg-white px-1.5 py-0.5">{off}</span>
              </div>
	              <button
	                type="button"
	                onClick={exportAllRows}
	                className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
	              >
	                {tx("导出全部商品", "Exp all")}
	              </button>
	              </div>
	            </div>
          </div>
          {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</div> : null}
        </div>
      </TableCard>

      <TableCard
        title={tx("产品目录", "Cat prod")}
        className="overflow-visible"
        titleRight={
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500">{yogoLastUpdatedText}</p>
            <button
              type="button"
              onClick={() => setCatalogShareOpen(true)}
              className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
            >
              {tx("分享客户产品清单", "Share catalog")}
            </button>
          </div>
        }
      >
        {viewMode === "catalog" ? (
        <>
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full min-w-[1400px] border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500">
                <th className="sticky top-[72px] z-20 whitespace-nowrap bg-slate-50 px-3 py-2.5 font-semibold text-slate-700">{tx("图片", "Img")}</th>
                <th className="sticky top-[72px] z-20 whitespace-nowrap bg-slate-50 px-3 py-2.5 font-semibold text-slate-700">{tx("编码", "SKU")}</th>
                <th className="sticky top-[72px] z-20 whitespace-nowrap bg-slate-50 px-3 py-2.5 font-semibold">{tx("条形码", "Barcode")}</th>
                <th className="sticky top-[72px] z-20 whitespace-nowrap bg-slate-50 px-3 py-2.5 font-semibold text-slate-700">{tx("中文名", "ZH")}</th>
                <th className="sticky top-[72px] z-20 whitespace-nowrap bg-slate-50 px-3 py-2.5 font-semibold text-slate-700">{tx("西文名", "ES")}</th>
                <th className="sticky top-[72px] z-20 whitespace-nowrap bg-slate-50 px-3 py-2.5 text-right font-semibold">{tx("包装数", "Pk")}</th>
                <th className="sticky top-[72px] z-20 whitespace-nowrap bg-slate-50 px-3 py-2.5 text-right font-semibold">{tx("装箱数", "Ct")}</th>
                <th className="sticky top-[72px] z-20 whitespace-nowrap bg-slate-50 px-3 py-2.5 text-right font-semibold">{tx("卖价", "PV")}</th>
                <th className="sticky top-[72px] z-20 whitespace-nowrap bg-slate-50 px-3 py-2.5 text-right font-semibold">{tx("普通折扣", "Dsc")}</th>
                <th className="sticky top-[72px] z-20 whitespace-nowrap bg-slate-50 px-3 py-2.5 text-right font-semibold">{tx("VIP折扣", "VIP Dsc")}</th>
                <th className="sticky top-[72px] z-20 whitespace-nowrap bg-slate-50 px-3 py-2.5 font-semibold">{tx("友购序号", "YG Code")}</th>
                <th className="sticky top-[72px] z-20 whitespace-nowrap bg-slate-50 px-3 py-2.5 font-semibold">{tx("分类", "Cat")}</th>
                <th className="sticky top-[72px] z-20 whitespace-nowrap bg-slate-50 px-3 py-2.5 font-semibold">{tx("子分类", "Subcat")}</th>
                <th className="sticky top-[72px] z-20 whitespace-nowrap bg-slate-50 px-3 py-2.5 font-semibold">{tx("供应商", "Prov")}</th>
                <th className="sticky top-[72px] z-20 whitespace-nowrap bg-slate-50 px-3 py-2.5 font-semibold">{tx("是否上架", "On?")}</th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {paged.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <ProductImage
                      sku={r.sku}
                      hasImage={r.hasImage}
                      size={40}
                      roundedClassName="rounded-md"
                      onClick={() =>
                        (r.hasImage || HAS_REMOTE_PRODUCT_IMAGE_BASE)
                          ? setPreview({
                              open: true,
                              src: buildProductImageUrl(r.sku, "jpg"),
                              title: r.sku,
                            })
                          : null
                      }
                    />
                  </td>
                  <td className="px-3 py-2 font-semibold text-slate-900">{r.sku}</td>
                  <td className="px-3 py-2 text-slate-600">{r.barcode || "-"}</td>
                  <td className="px-3 py-2 max-w-[220px] truncate text-slate-900">{r.nameZh || "-"}</td>
                  <td className="px-3 py-2 max-w-[220px] truncate text-slate-700">{r.nameEs || "-"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{r.casePack ?? "-"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{r.cartonPack ?? "-"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{r.priceText}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{r.normalDiscountText}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">{vipLast(r.vipDiscountText)}</td>
                  <td className="px-3 py-2 text-slate-600">{r.category || "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{r.categoryName || "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{r.subcategory || "-"}</td>
                  <td className="px-3 py-2 text-slate-600">{r.supplier || "-"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.statusText === "上架" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                      {r.statusText === "上架" ? tx("上架", "ON") : tx("下架", "OFF")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 ? (
          <div className="border-t border-slate-200 px-5 py-4">
            <div className="mb-2 text-center text-xs text-slate-500">
              {lang === "zh"
                ? `当前页 ${safePage} / ${totalPages}，总记录 ${filtered.length}`
                : `Page ${safePage}/${totalPages}, Total ${filtered.length}`}
            </div>
            <div className="flex flex-nowrap items-center justify-center gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setPage(1)}
                disabled={safePage <= 1}
                className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {tx("回到首页", "Ini")}
              </button>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={safePage <= 1}
                className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {tx("上一页", "Ant")}
              </button>
              <div className="inline-flex h-9 min-w-[72px] items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
                {safePage} / {totalPages}
              </div>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={safePage >= totalPages}
                className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {tx("下一页", "Sig")}
              </button>
              <button
                type="button"
                onClick={() => setPage(totalPages)}
                disabled={safePage >= totalPages}
                className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {tx("去最后页", "Fin")}
              </button>
            </div>
          </div>
        ) : null}
        </>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50 text-left text-sm text-slate-500">
                  <th className="px-3 py-3 font-semibold">{tx("文件名", "Archivo")}</th>
                  <th className="px-3 py-3 font-semibold">{tx("导入时间", "Fecha")}</th>
                  <th className="px-3 py-3 font-semibold">{tx("商品数量", "Items")}</th>
                  <th className="px-3 py-3 font-semibold">{tx("新增", "Nuevo")}</th>
                  <th className="px-3 py-3 font-semibold">{tx("变化", "Cambio")}</th>
                  <th className="px-3 py-3 font-semibold">{tx("无变化", "Sin camb")}</th>
                  <th className="px-3 py-3 font-semibold">{tx("上架/下架", "ON/OFF")}</th>
                  <th className="px-3 py-3 font-semibold">{tx("对比字段", "Campos")}</th>
                  <th className="px-3 py-3 font-semibold">{tx("导出", "Exp")}</th>
                  <th className="px-3 py-3 font-semibold">{tx("删除", "Del")}</th>
                </tr>
              </thead>
              <tbody>
                {recordsLoading ? (
                  <tr><td className="px-3 py-4 text-sm text-slate-500" colSpan={10}>{tx("加载中...", "Carg...")}</td></tr>
                ) : importRecords.length === 0 ? (
                  <tr><td className="px-3 py-4 text-sm text-slate-500" colSpan={10}>{tx("暂无记录", "Sin hist")}</td></tr>
                ) : (
                  importRecords.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 text-sm text-slate-700">
                      <td className="px-3 py-2">{r.fileName}</td>
                      <td className="px-3 py-2">{new Date(r.createdAt).toLocaleString(lang === "zh" ? "zh-CN" : "es-MX", { hour12: false })}</td>
                      <td className="px-3 py-2">{r.totalRows}</td>
                      <td className="px-3 py-2">{r.createdCount}</td>
                      <td className="px-3 py-2">{r.changedCount}</td>
                      <td className="px-3 py-2">{r.unchangedCount}</td>
                      <td className="px-3 py-2">{`${r.onShelfCount}/${r.offShelfCount}`}</td>
                      <td className="px-3 py-2">{r.comparedFields}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          disabled={!r.hasFile}
                          onClick={() => exportImportRecord(r.id)}
                          className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {tx("导出", "Exp")}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => void deleteImportRecord(r.id)}
                          className="inline-flex h-8 w-8 items-center justify-center text-rose-500 hover:text-rose-700"
                          title={tx("删除记录", "Del hist")}
                        >
                          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
                            <path d="M4.5 5.5h11" />
                            <path d="M7.5 5.5V4.25h5V5.5" />
                            <path d="M6.5 7.5v7.25h7V7.5" />
                            <path d="M8.75 9.25v4.5M11.25 9.25v4.5" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </TableCard>

      {edit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-[860px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold">{edit.id ? tx("编辑产品", "Edit") : tx("新增产品", "Alta")}</h3>
            </div>
            <div className="grid gap-3 px-5 py-5 lg:grid-cols-3">
              <div className="space-y-1"><p className="text-xs text-slate-500">{tx("SKU", "SKU")}</p><input value={edit.sku} onChange={(e) => setEdit((p) => p ? { ...p, sku: e.target.value } : p)} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" /></div>
              <div className="space-y-1"><p className="text-xs text-slate-500">{tx("编号", "Cod")}</p><input value={edit.barcode} onChange={(e) => setEdit((p) => p ? { ...p, barcode: e.target.value } : p)} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" /></div>
              <div className="space-y-1"><p className="text-xs text-slate-500">{tx("中文名", "Nom ZH")}</p><input value={edit.nameZh} onChange={(e) => setEdit((p) => p ? { ...p, nameZh: e.target.value } : p)} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" /></div>
              <div className="space-y-1"><p className="text-xs text-slate-500">{tx("西文名", "Nom ES")}</p><input value={edit.nameEs} onChange={(e) => setEdit((p) => p ? { ...p, nameEs: e.target.value } : p)} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" /></div>
              <div className="space-y-1"><p className="text-xs text-slate-500">{tx("包装数", "Pack")}</p><input value={edit.casePack} onChange={(e) => setEdit((p) => p ? { ...p, casePack: e.target.value } : p)} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" /></div>
              <div className="space-y-1"><p className="text-xs text-slate-500">{tx("装箱数", "Cart")}</p><input value={edit.cartonPack} onChange={(e) => setEdit((p) => p ? { ...p, cartonPack: e.target.value } : p)} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" /></div>
              <div className="space-y-1"><p className="text-xs text-slate-500">{tx("卖价", "PV")}</p><input value={edit.price} onChange={(e) => setEdit((p) => p ? { ...p, price: e.target.value } : p)} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" /></div>
              <div className="space-y-1"><p className="text-xs text-slate-500">{tx("普通折扣", "Dsc")}</p><input value={edit.normalDiscount} onChange={(e) => setEdit((p) => p ? { ...p, normalDiscount: e.target.value } : p)} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" /></div>
              <div className="space-y-1"><p className="text-xs text-slate-500">VIP</p><input value={edit.vipDiscount} onChange={(e) => setEdit((p) => p ? { ...p, vipDiscount: e.target.value } : p)} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm" /></div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">{tx("分类", "Cat")}</p>
                <select value={edit.category} onChange={(e) => setEdit((p) => p ? { ...p, category: e.target.value } : p)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                  <option value="">{tx("请选择分类", "Sel cat")}</option>
                  {editCategoryOptions.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
                {editCategoryOptions.length === 0 ? (
                  <input
                    value={edit.category}
                    onChange={(e) => setEdit((p) => p ? { ...p, category: e.target.value } : p)}
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"
                    placeholder={tx("暂无分类数据，可手动输入", "No cat, input")}
                  />
                ) : null}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-500">{tx("供应商", "Prov")}</p>
                <select value={edit.supplier} onChange={(e) => setEdit((p) => p ? { ...p, supplier: e.target.value } : p)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                  <option value="">{tx("请选择供应商", "Sel prov")}</option>
                  {editSupplierOptions.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div className="space-y-1"><p className="text-xs text-slate-500">{tx("状态", "Estado")}</p><select value={edit.available} onChange={(e) => setEdit((p) => p ? { ...p, available: e.target.value } : p)} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm"><option value="0">{tx("上架", "ON")}</option><option value="1">{tx("下架", "OFF")}</option></select></div>
              <div className="space-y-1"><p className="text-xs text-slate-500">{tx("标记为“新”", "Marca")}</p><label className="inline-flex h-10 items-center gap-2 text-sm"><input type="checkbox" checked={edit.isNewProduct} onChange={(e) => setEdit((p) => p ? { ...p, isNewProduct: e.target.checked } : p)} />{tx("标记为“新”", "Marcar \"Nuevo\"")}</label></div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button type="button" onClick={() => setEdit(null)} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold">{tx("取消", "Canc")}</button>
              <button type="button" onClick={() => void saveEdit()} disabled={saving} className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white">{saving ? tx("保存中...", "Guard...") : tx("保存", "Guardar")}</button>
            </div>
          </div>
        </div>
      ) : null}

      {quickOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="flex w-full max-w-[940px] flex-col rounded-2xl bg-white text-[13px] shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-[15px] font-semibold">{tx("批量筛选与修改", "Filt + edit")}</h3>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="grid gap-3 lg:grid-cols-[44fr_34fr_22fr]">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <p className="mb-2 text-[13px] font-bold text-slate-900">{tx("基础条件", "Base cond")}</p>
                  <div className="grid gap-2">
                    {[
                      ["hasImage", "noImage"],
                      ["hasBarcode", "noBarcode"],
                      ["hasZh", "noZh"],
                      ["hasEs", "noEs"],
                      ["hasCategory", "noCategory"],
                      ["hasCasePack", "noCasePack"],
                      ["hasCartonPack", "noCartonPack"],
                      ["hasVipDiscount", "noVipDiscount"],
                      ["onShelf", "offShelf"],
                      ["isNew", "isBlankChange"],
                    ].map(([leftKey, rightKey]) => (
                      <div key={leftKey} className="grid grid-cols-2 gap-2">
                        {[leftKey, rightKey].map((key) => {
                          const label = quickBaseOptions.find((x) => x.key === key)?.label || key;
                          const active = quickSelected.includes(key);
                          return (
                            <label
                              key={key}
                              className={`inline-flex cursor-pointer items-center justify-center rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                                active
                                  ? "border-primary bg-indigo-50 text-primary"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                              }`}
                            >
                              <input type="checkbox" className="hidden" checked={active} onChange={(e) => toggleQuick(key, e.target.checked)} />
                              {label}
                            </label>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-500">{tx("分类", "Cat")}</p>
                  </div>
                  <div className="p-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {filteredCategoryChoices.length === 0 ? (
                        <span className="text-xs text-slate-400">{tx("暂无分类数据", "No cat data")}</span>
                      ) : (
                        filteredCategoryChoices.map((cat) => {
                          const key = `cat:${cat}`;
                          const active = quickSelected.includes(key);
                          return (
                            <label
                              key={key}
                            className={`inline-flex cursor-pointer items-center rounded-xl border px-3 py-1.5 text-xs transition ${
                              active
                                ? "border-primary bg-indigo-50 text-primary"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            <input type="checkbox" className="hidden" checked={active} onChange={(e) => toggleQuick(key, e.target.checked)} />
                            <span className="whitespace-normal text-center leading-tight">{cat}</span>
                          </label>
                        );
                      })
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-500">{tx("供应商", "Prov")}</p>
                  </div>
                  <div className="p-2">
                    <div className="grid grid-cols-1 gap-2 text-xs">
                      {filteredSupplierChoices.length === 0 ? (
                        <span className="text-xs text-slate-400">{tx("暂无供应商数据", "No prov data")}</span>
                      ) : (
                        filteredSupplierChoices.map((sp) => {
                          const key = `supplier:${sp}`;
                          const active = quickSelected.includes(key);
                          return (
                            <label
                              key={key}
                              className={`inline-flex cursor-pointer items-center rounded-xl border px-3 py-1.5 text-xs transition ${
                                active
                                  ? "border-primary bg-indigo-50 text-primary"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                              }`}
                            >
                              <input type="checkbox" className="hidden" checked={active} onChange={(e) => toggleQuick(key, e.target.checked)} />
                              {sp}
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="text-[13px] font-bold text-slate-900">{lang === "zh" ? `批量修改（当前筛选 ${filtered.length} 条）` : `Batch edit (${filtered.length})`}</p>
                <p className="mb-3 mt-1 text-xs text-slate-500">{tx("未填写或未选择的字段将保持不变。", "Empty keep")}</p>
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_140px_120px_120px]">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">{tx("分类", "Cat")}</p>
                    {categoryChoices.length > 0 ? (
                      <select value={batchUpdate.category} onChange={(e) => setBatchUpdate((p) => ({ ...p, category: e.target.value }))} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                        <option value="">{tx("不改", "No chg")}</option>
                        {categoryChoices.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                    ) : (
                      <input
                        value={batchUpdate.category}
                        onChange={(e) => setBatchUpdate((p) => ({ ...p, category: e.target.value }))}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                        placeholder={tx("暂无分类数据，可手动输入", "No cat, input")}
                      />
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">{tx("供应商", "Prov")}</p>
                    <select value={batchUpdate.supplier} onChange={(e) => setBatchUpdate((p) => ({ ...p, supplier: e.target.value }))} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                      <option value="">{tx("不改", "No chg")}</option>
                      {supplierChoices.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">{tx("状态", "Estado")}</p>
                    <select value={batchUpdate.available} onChange={(e) => setBatchUpdate((p) => ({ ...p, available: e.target.value as BatchUpdateState["available"] }))} className="h-10 w-full max-w-[180px] rounded-xl border border-slate-200 bg-white px-3 text-sm">
                      <option value="">{tx("不改", "No chg")}</option>
                      <option value="0">{tx("上架", "ON")}</option>
                      <option value="1">{tx("下架", "OFF")}</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">{tx("普通折扣", "Dsc")}</p>
                    <input
                      value={batchUpdate.normalDiscount}
                      onChange={(e) =>
                        setBatchUpdate((p) => ({
                          ...p,
                          normalDiscount: e.target.value.replace(/[^\d]/g, ""),
                        }))
                      }
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="h-10 w-full max-w-[120px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-500">{tx("VIP折扣", "VIP")}</p>
                    <input
                      value={batchUpdate.vipDiscount}
                      onChange={(e) =>
                        setBatchUpdate((p) => ({
                          ...p,
                          vipDiscount: e.target.value.replace(/[^\d]/g, ""),
                        }))
                      }
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="h-10 w-full max-w-[120px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4">
              <button
                type="button"
                onClick={exportFilteredRows}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold"
              >
                {tx("导出筛选结果", "Exp filt")}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuickSelected([])}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold"
                >
                  {tx("清空", "Lim")}
                </button>
                <button
                  type="button"
                  onClick={cancelQuickModal}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold"
                >
                  {tx("取消", "Canc")}
                </button>
                <button
                  type="button"
                  onClick={applyQuickFilter}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold"
                >
                  {tx("应用筛选", "Apply filt")}
                </button>
                <button
                  type="button"
                  onClick={() => void applyBatchUpdate()}
                  disabled={readOnlyMode || batchUpdating || filtered.length === 0}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {tx("保存修改", "Guar")}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteFilteredRows()}
                  disabled={readOnlyMode || filtered.length === 0}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {tx("删除筛选结果", "Del filt")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {dup.open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"><div className="w-full max-w-[640px] rounded-xl bg-white shadow-2xl"><div className="border-b border-slate-200 px-5 py-4"><h3 className="text-base font-semibold">{tx("检测到重复SKU", "SKU dup")}</h3></div><div className="space-y-2 px-5 py-5 text-sm"><p>{dup.msg}</p><div className="max-h-40 overflow-auto rounded-lg border border-slate-200 p-2 text-xs">{dup.skus.slice(0, 30).map((d) => <div key={d.sku}>{lang === "zh" ? `${d.sku}（重复 ${d.count} 条）` : `${d.sku} (dup ${d.count})`}</div>)}</div></div><div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4"><button type="button" onClick={() => setDup({ open: false, skus: [], msg: "" })} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold">{tx("取消", "Canc")}</button><button type="button" onClick={() => { const f = pendingFile; setDup({ open: false, skus: [], msg: "" }); if (f) { setImportMode(pendingMode); void uploadFile(f, "first"); } }} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold">{tx("保留第一条", "Keep 1st")}</button><button type="button" onClick={() => { const f = pendingFile; setDup({ open: false, skus: [], msg: "" }); if (f) { setImportMode(pendingMode); void uploadFile(f, "last"); } }} className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white">{tx("保留最后一条", "Keep last")}</button></div></div></div> : null}

      {uploading ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"><div className="w-full max-w-[420px] rounded-xl bg-white p-5 shadow-2xl"><div className="mb-3 text-sm font-semibold">{importMode === "initial" ? tx("基础数据导入...", "Base import...") : tx("对比中...", "Compare...")}</div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div><div className="mt-2 text-xs text-slate-500">{tx("进度", "Prog")} {Math.min(progress, 100)}%</div></div></div> : null}
      {catalogShareOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-[560px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">{tx("分享客户产品清单", "Share catalog")}</h3>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xl font-bold tracking-wide text-slate-900">PARKSONMX</p>
                <p className="mt-1 text-xs text-slate-500">{tx("选择品类导出 PDF / XLSX，可直接分享客户", "Pick category, export PDF/XLSX and share")}</p>
              </div>

              <div className="space-y-1">
                <p className="text-xs text-slate-500">{tx("品类", "Category")}</p>
                <select
                  value={catalogCategory}
                  onChange={(e) => setCatalogCategory(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="all">{tx("全部", "All")}</option>
                  {shareCategoryOptions.map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <a
                    href={catalogExportUrl("pdf")}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {tx("导出 PDF", "Export PDF")}
                  </a>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      title={tx("PDF 分享到 WhatsApp", "PDF to WhatsApp")}
                      aria-label={tx("PDF 分享到 WhatsApp", "PDF to WhatsApp")}
                      onClick={() => {
                        const url = `${window.location.origin}${catalogSharePdfUrl()}`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer");
                      }}
                      className="inline-flex h-10 w-full items-center justify-center text-emerald-600 transition hover:text-emerald-700"
                    >
                      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
                        <circle cx="16" cy="16" r="15" fill="#25D366" />
                        <path
                          fill="#fff"
                          d="M23.1 9.2a10.1 10.1 0 0 0-16.2 11.7L5.5 26l5.3-1.4a10.1 10.1 0 0 0 4.8 1.2h.1c5.6 0 10.2-4.6 10.2-10.2 0-2.7-1-5.3-2.8-7.1Zm-7.4 14.9h-.1a8.5 8.5 0 0 1-4.3-1.2l-.3-.2-3.1.8.8-3-.2-.3a8.4 8.4 0 1 1 7.2 3.9Zm4.6-6.3c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.8c-.1.1-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.3.1-.5l.3-.3.2-.3.1-.2c.1-.1.1-.3 0-.4 0-.1-.5-1.3-.7-1.8-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.4.9 2.6c.1.2 1.6 2.5 3.9 3.5.5.2.9.4 1.2.5.5.1 1 .1 1.4.1.4-.1 1.4-.6 1.6-1.2.2-.6.2-1.1.1-1.2-.1-.1-.2-.2-.4-.3Z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      title={tx("PDF 分享到微信", "PDF to WeChat")}
                      aria-label={tx("PDF 分享到微信", "PDF to WeChat")}
                      onClick={async () => {
                        const url = `${window.location.origin}${catalogSharePdfUrl()}`;
                        await navigator.clipboard.writeText(url);
                        window.alert(tx("微信请粘贴已复制链接", "Paste copied link in WeChat"));
                      }}
                      className="inline-flex h-10 w-full items-center justify-center text-sky-600 transition hover:text-sky-700"
                    >
                      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
                        <circle cx="16" cy="16" r="15" fill="#07C160" />
                        <path
                          fill="#fff"
                          d="M12.5 10c-3.2 0-5.8 2.1-5.8 4.8 0 1.6.9 3 2.4 3.9l-.6 2.4 2.5-1.2c.5.1 1 .2 1.5.2 3.2 0 5.8-2.1 5.8-4.8S15.7 10 12.5 10Zm-2 5.3a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Zm4 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Zm7-4.3c-2.8 0-5.1 1.8-5.1 4.1s2.3 4.1 5.1 4.1c.5 0 1-.1 1.4-.2l2.2 1-.5-2c1.2-.8 1.9-1.9 1.9-3.1 0-2.3-2.3-3.9-5-3.9Zm-1.8 4.9a.7.7 0 1 1 0-1.4.7.7 0 0 1 0 1.4Zm3.5 0a.7.7 0 1 1 0-1.4.7.7 0 0 1 0 1.4Z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <a
                    href={catalogExportUrl("xlsx")}
                    className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {tx("导出 XLSX", "Export XLSX")}
                  </a>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      title={tx("XLSX 分享到 WhatsApp", "XLSX to WhatsApp")}
                      aria-label={tx("XLSX 分享到 WhatsApp", "XLSX to WhatsApp")}
                      onClick={() => {
                        const url = `${window.location.origin}${catalogShareXlsxUrl()}`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer");
                      }}
                      className="inline-flex h-10 w-full items-center justify-center text-emerald-600 transition hover:text-emerald-700"
                    >
                      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
                        <circle cx="16" cy="16" r="15" fill="#25D366" />
                        <path
                          fill="#fff"
                          d="M23.1 9.2a10.1 10.1 0 0 0-16.2 11.7L5.5 26l5.3-1.4a10.1 10.1 0 0 0 4.8 1.2h.1c5.6 0 10.2-4.6 10.2-10.2 0-2.7-1-5.3-2.8-7.1Zm-7.4 14.9h-.1a8.5 8.5 0 0 1-4.3-1.2l-.3-.2-3.1.8.8-3-.2-.3a8.4 8.4 0 1 1 7.2 3.9Zm4.6-6.3c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7.8c-.1.1-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.3.1-.5l.3-.3.2-.3.1-.2c.1-.1.1-.3 0-.4 0-.1-.5-1.3-.7-1.8-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2s.8 2.4.9 2.6c.1.2 1.6 2.5 3.9 3.5.5.2.9.4 1.2.5.5.1 1 .1 1.4.1.4-.1 1.4-.6 1.6-1.2.2-.6.2-1.1.1-1.2-.1-.1-.2-.2-.4-.3Z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      title={tx("XLSX 分享到微信", "XLSX to WeChat")}
                      aria-label={tx("XLSX 分享到微信", "XLSX to WeChat")}
                      onClick={async () => {
                        const url = `${window.location.origin}${catalogShareXlsxUrl()}`;
                        await navigator.clipboard.writeText(url);
                        window.alert(tx("微信请粘贴已复制链接", "Paste copied link in WeChat"));
                      }}
                      className="inline-flex h-10 w-full items-center justify-center text-sky-600 transition hover:text-sky-700"
                    >
                      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
                        <circle cx="16" cy="16" r="15" fill="#07C160" />
                        <path
                          fill="#fff"
                          d="M12.5 10c-3.2 0-5.8 2.1-5.8 4.8 0 1.6.9 3 2.4 3.9l-.6 2.4 2.5-1.2c.5.1 1 .2 1.5.2 3.2 0 5.8-2.1 5.8-4.8S15.7 10 12.5 10Zm-2 5.3a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Zm4 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6Zm7-4.3c-2.8 0-5.1 1.8-5.1 4.1s2.3 4.1 5.1 4.1c.5 0 1-.1 1.4-.2l2.2 1-.5-2c1.2-.8 1.9-1.9 1.9-3.1 0-2.3-2.3-3.9-5-3.9Zm-1.8 4.9a.7.7 0 1 1 0-1.4.7.7 0 0 1 0 1.4Zm3.5 0a.7.7 0 1 1 0-1.4.7.7 0 0 1 0 1.4Z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setCatalogShareOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                {tx("关闭", "Close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <ImageLightbox
        open={preview.open}
        src={preview.src}
        title={preview.title}
        onClose={() => setPreview({ open: false, src: "", title: "" })}
      />
    </section>
  );
}


  const imageFlag = (row: ProductRow) =>
    HAS_REMOTE_PRODUCT_IMAGE_BASE ? true : row.hasImage;
