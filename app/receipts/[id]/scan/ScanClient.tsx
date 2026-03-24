"use client";

import Link from "next/link";
import {
  ChangeEvent,
  DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ProductImage } from "@/components/product-image";
import { ImageLightbox } from "@/components/image-lightbox";
import { buildProductImageUrl } from "@/lib/product-image-url";

type ItemStatus = "pending" | "in_progress" | "completed";

type ItemRow = {
  id: string;
  sku: string;
  barcode: string;
  nameZh: string;
  nameEs: string;
  casePack: number | null;
  supplierCasePack: number | null;
  expectedQty: number | null;
  goodQty: number;
  damagedQty: number;
  excessQty: number;
  diffQty: number;
  uncheckedQty: number;
  status: ItemStatus;
  updatedAtText: string;
  createdAt: string;
  unexpected?: boolean;
};

type SummaryState = {
  totalSku: number;
  addedCount: number;
  expectedQtyTotal: number;
  goodQtyTotal: number;
  diffQtyTotal: number;
  uncheckedQtyTotal: number;
  damagedQtyTotal: number;
  excessQtyTotal: number;
  progress: number;
};

type TextMap = {
  back: string;
  uploadEvidence: string;
  finishInspection: string;
  finishingInspection: string;
  finishInspectionFailed: string;
  supplier: string;
  uploadedAt: string;
  inspectedAt: string;
  image: string;
  sku: string;
  barcode: string;
  nameZh: string;
  nameEs: string;
  casePack: string;
  supplierCasePack: string;
  supplierCasePackColumn: string;
  expectedQty: string;
  goodQty: string;
  damagedQty: string;
  diffQty: string;
  uncheckedQty: string;
  excessQty: string;
  addedQty: string;
  status: string;
  pending: string;
  inProgress: string;
  completed: string;
  imagePreviewTitle: string;
  scanPlaceholder: string;
  searchPlaceholder: string;
  noItems: string;
  noMatch: string;
  save: string;
  saving: string;
  editItem: string;
  saveFailed: string;
  listTitle: string;
  editQtyTitle: string;
  editItemTitle: string;
  addItemTitle: string;
  cancel: string;
  damagedQtyInput: string;
  excessQtyInput: string;
  addUnknownTitle: string;
  addUnknownDesc: string;
  confirmYes: string;
  confirmNo: string;
  evidenceTitle: string;
  chooseImages: string;
  noEvidence: string;
  emptyImage: string;
};

type ScanClientProps = {
  receiptId: string;
  receiptNo: string;
  receiptStatus: ItemStatus;
  receiptLocked: boolean;
  supplierName: string;
  uploadedAtText: string;
  inspectedAtText: string;
  backHref: string;
  rows: ItemRow[];
  initialSummary: SummaryState;
  text: TextMap;
};

type LightboxState = {
  open: boolean;
  src: string;
  title: string;
};

type ItemFormState = {
  sku: string;
  barcode: string;
  casePack: string;
  expectedQty: string;
};

type QtyFormState = {
  damagedQty: string;
  excessQty: string;
};

type AddItemFormState = {
  sku: string;
  barcode: string;
  casePack: string;
  expectedQty: string;
};

type SummaryFilterKey = "all" | "diffQty" | "uncheckedQty";

type EvidenceItem = {
  id: string;
  name: string;
  url: string;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: string;
  local: boolean;
};

const MAX_EVIDENCE_COUNT = 20;
const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024;

function normalizeCode(value: string) {
  return value.trim().toLowerCase();
}

function getStatusLabel(status: ItemStatus, text: TextMap) {
  if (status === "completed") return text.completed;
  if (status === "in_progress") return text.inProgress;
  return text.pending;
}

function getStatusClassName(status: ItemStatus) {
  if (status === "completed") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200";
  }

  if (status === "in_progress") {
    return "bg-secondary-accent/70 text-secondary-deep ring-1 ring-inset ring-secondary-accent";
  }

  return "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200";
}

function buildSummary(items: ItemRow[]): SummaryState {
  const importedRows = items.filter((row) => !row.unexpected);
  const addedCount = items.filter((row) => row.unexpected).length;

  const totalSku = importedRows.length;
  const expectedQtyTotal = importedRows.reduce((sum, item) => sum + (item.expectedQty ?? 0), 0);
  const goodQtyTotal = importedRows.reduce(
    (sum, item) => sum + item.goodQty,
    0,
  );
  const damagedQtyTotal = importedRows.reduce(
    (sum, item) => sum + item.damagedQty,
    0,
  );
  const excessQtyTotal = importedRows.reduce(
    (sum, item) => sum + item.excessQty,
    0,
  );

  const checkedQtyTotal = goodQtyTotal + damagedQtyTotal;
  const uncheckedQtyTotal = Math.max(expectedQtyTotal - checkedQtyTotal, 0);
  const diffQtyTotal = uncheckedQtyTotal;

  const progress =
    expectedQtyTotal > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((checkedQtyTotal / expectedQtyTotal) * 100)),
        )
      : 0;

  return {
    totalSku,
    addedCount,
    expectedQtyTotal,
    goodQtyTotal,
    diffQtyTotal,
    uncheckedQtyTotal,
    damagedQtyTotal,
    excessQtyTotal,
    progress,
  };
}

function hasRowScanData(row: ItemRow): boolean {
  if (row.unexpected) return true;
  if (row.goodQty > 0) return true;
  if (row.damagedQty > 0) return true;
  if (row.excessQty > 0) return true;
  return row.status !== "pending";
}

function SummaryCard({
  label,
  value,
  valueClassName = "text-slate-900",
  active = false,
  clickable = false,
  onClick,
}: {
  label: string;
  value: number;
  valueClassName?: string;
  active?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`w-full rounded-2xl border px-5 py-4 text-left transition ${
        active
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-slate-200 bg-slate-50"
      } ${clickable ? "cursor-pointer hover:border-primary/40 hover:bg-primary/5" : "cursor-default"}`}
    >
      <div className="text-sm text-slate-500">{label}</div>
      <div
        className={`mt-2 text-[18px] font-bold leading-none ${valueClassName}`}
      >
        {value}
      </div>
    </button>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M3.5 13.75V16.5h2.75L15 7.75 12.25 5 3.5 13.75Z" />
      <path d="M10.75 6.5 13.5 9.25" />
      <path d="M11.5 3.75 16.25 8.5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M4.5 6.25h11" />
      <path d="M7.25 6.25V4.75h5.5v1.5" />
      <path d="M6.5 6.25l.45 8.1a1 1 0 0 0 1 .9h4.1a1 1 0 0 0 1-.9l.45-8.1" />
      <path d="M8.25 9v3.5" />
      <path d="M11.75 9v3.5" />
    </svg>
  );
}

function EmptyImageText({ text }: { text: string }) {
  return (
    <div className="flex h-[132px] w-[132px] items-center justify-center text-base text-slate-400">
      {text}
    </div>
  );
}

function SkuPreviewImage({
  sku,
  emptyText,
}: {
  sku: string;
  emptyText: string;
}) {
  const [error, setError] = useState(false);
  const normalizedSku = sku.trim();
  const src = normalizedSku ? buildProductImageUrl(normalizedSku, "jpg") : "";

  useEffect(() => {
    setError(false);
  }, [normalizedSku]);

  if (!normalizedSku || error) {
    return <EmptyImageText text={emptyText} />;
  }

  return (
    <img
      src={src}
      alt={normalizedSku}
      className="h-[132px] w-[132px] object-contain"
      onError={() => setError(true)}
    />
  );
}

function getInitialAddForm(code = ""): AddItemFormState {
  const onlyDigits = /^\d+$/.test(code.trim());

  return {
    sku: onlyDigits ? "" : code.trim(),
    barcode: onlyDigits ? code.trim() : "",
    casePack: "",
    expectedQty: "",
  };
}

async function readJsonSafe(response: Response) {
  const raw = await response.text();

  try {
    return JSON.parse(raw);
  } catch {
    if (response.status === 404) {
      throw new Error(
        "\u626b\u7801\u63a5\u53e3\u672a\u627e\u5230\uff0c\u8bf7\u68c0\u67e5 app/api/receipts/scan/[itemId]/route.ts \u662f\u5426\u5b58\u5728",
      );
    }

    throw new Error(raw || "\u63a5\u53e3\u8fd4\u56de\u683c\u5f0f\u4e0d\u6b63\u786e");
  }
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        reject(new Error("图片读取失败"));
        return;
      }
      resolve(result);
    };

    reader.onerror = () => {
      reject(new Error("图片读取失败"));
    };

    reader.readAsDataURL(file);
  });
}

function extractDroppedImageFiles(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return [];
  const itemFiles = Array.from(dataTransfer.items || [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
  return itemFiles.length > 0 ? itemFiles : Array.from(dataTransfer.files || []);
}

function isSpanish(text: TextMap) {
  return text.cancel === "Cancelar";
}

function getDeleteText(text: TextMap) {
  return isSpanish(text) ? "Eliminar" : "删除";
}

function getSavedText(text: TextMap) {
  return isSpanish(text) ? "Imágenes guardadas" : "已保存图片";
}

function getPendingText(text: TextMap) {
  return isSpanish(text) ? "Imágenes pendientes" : "待保存图片";
}

function getUploadingRuleText(text: TextMap) {
  return isSpanish(text)
    ? "Máximo 20 imágenes, solo fotos, hasta 10MB cada una"
    : "最多 20 张，仅支持图片，单张不超过 10MB";
}

function getEvidenceLoadErrorText(text: TextMap) {
  return isSpanish(text) ? "无法读取证据图片" : "暂时无法读取证据图片";
}

function getEvidenceTooManyText(text: TextMap) {
  return isSpanish(text) ? "Solo puedes subir hasta 20 imágenes" : "最多只能上传 20 张图片";
}

function getEvidenceImageOnlyText(text: TextMap) {
  return isSpanish(text) ? "只能上传图片文件" : "只能上传图片文件";
}

function getEvidenceSizeText(text: TextMap) {
  return isSpanish(text) ? "单张图片不能超过 10MB" : "单张图片不能超过 10MB";
}

function getEvidenceSaveEmptyText(text: TextMap) {
  return isSpanish(text) ? "请先选择图片" : "请先选择图片";
}

export function ScanClient({
  receiptId,
  receiptNo,
  receiptStatus,
  receiptLocked,
  supplierName,
  uploadedAtText,
  inspectedAtText,
  backHref,
  rows,
  initialSummary,
  text,
}: ScanClientProps) {
  const [items, setItems] = useState<ItemRow[]>(rows);
  const [summary, setSummary] = useState<SummaryState>(initialSummary);
  const [scanInput, setScanInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [summaryFilter, setSummaryFilter] = useState<SummaryFilterKey>("all");
  const [useSupplierCasePack, setUseSupplierCasePack] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(
    rows[0]?.id || null,
  );
  const [pinnedItemId, setPinnedItemId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxState>({
    open: false,
    src: "",
    title: "",
  });

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormState>({
    sku: "",
    barcode: "",
    casePack: "",
    expectedQty: "",
  });

  const [editingQtyId, setEditingQtyId] = useState<string | null>(null);
  const [qtyForm, setQtyForm] = useState<QtyFormState>({
    damagedQty: "",
    excessQty: "",
  });

  const [confirmUnknownOpen, setConfirmUnknownOpen] = useState(false);
  const [pendingUnknownCode, setPendingUnknownCode] = useState("");
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemForm, setAddItemForm] =
    useState<AddItemFormState>(getInitialAddForm());

  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceSaving, setEvidenceSaving] = useState(false);
  const [evidenceError, setEvidenceError] = useState("");
  const [savedEvidenceImages, setSavedEvidenceImages] = useState<
    EvidenceItem[]
  >([]);
  const [pendingEvidenceImages, setPendingEvidenceImages] = useState<
    EvidenceItem[]
  >([]);
  const [evidenceDragActive, setEvidenceDragActive] = useState(false);

  const scanInputRef = useRef<HTMLInputElement | null>(null);
  const locateTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setItems(rows);
    setSummary(initialSummary);
    setActiveItemId(rows[0]?.id || null);
    setSummaryFilter("all");
  }, [rows, initialSummary]);

  useEffect(() => {
    return () => {
      pendingEvidenceImages.forEach((item) => {
        if (item.local) {
          URL.revokeObjectURL(item.url);
        }
      });
    };
  }, [pendingEvidenceImages]);

  const filteredRows = useMemo(() => {
    const value = keyword.trim().toLowerCase();

    let list = items.filter((row) => {
      if (!value) return true;

      const source = [row.sku, row.barcode, row.nameZh, row.nameEs]
        .join(" ")
        .toLowerCase();

      return source.includes(value);
    });

    if (summaryFilter === "diffQty") {
      list = list.filter((row) => hasRowScanData(row) && row.diffQty > 0);
    } else if (summaryFilter === "uncheckedQty") {
      list = list.filter((row) => hasRowScanData(row) && row.uncheckedQty > 0);
    }

    list = [...list].sort((a, b) => {
      if (pinnedItemId) {
        if (a.id === pinnedItemId && b.id !== pinnedItemId) return -1;
        if (a.id !== pinnedItemId && b.id === pinnedItemId) return 1;
      }

      return a.sku.localeCompare(b.sku, "zh-CN", {
        numeric: true,
        sensitivity: "base",
      });
    });

    return list;
  }, [items, keyword, pinnedItemId, summaryFilter]);

  const hasRealScanData = useMemo(
    () => items.some((row) => hasRowScanData(row)),
    [items],
  );

  const canFinishInspection = useMemo(() => {
    if (receiptLocked || receiptStatus === "completed") return false;
    if (!hasRealScanData) return false;
    return summary.diffQtyTotal > 0 || summary.uncheckedQtyTotal > 0;
  }, [
    hasRealScanData,
    receiptLocked,
    receiptStatus,
    summary.diffQtyTotal,
    summary.uncheckedQtyTotal,
  ]);

  useEffect(() => {
    const value = scanInput.trim();

    if (!value) return;

    if (locateTimerRef.current) {
      window.clearTimeout(locateTimerRef.current);
    }

    locateTimerRef.current = window.setTimeout(async () => {
      const code = normalizeCode(value);

      const exact = items.find((item) => {
        const sku = normalizeCode(item.sku);
        const barcode = normalizeCode(item.barcode || "");
        return sku === code || barcode === code;
      });

      if (exact) {
        setScanInput("");
        await handleScanMatched(exact.id, exact.sku);
        return;
      }

      const looksLikeBarcode = /^\d{6,}$/.test(value.trim());

      if (looksLikeBarcode) {
        setPendingUnknownCode(value.trim());
        setConfirmUnknownOpen(true);
      }
    }, 120);

    return () => {
      if (locateTimerRef.current) {
        window.clearTimeout(locateTimerRef.current);
      }
    };
  }, [scanInput, items]);

  function openImage(item: ItemRow) {
    const src = item.sku ? buildProductImageUrl(item.sku, "jpg") : "";
    if (!src) return;

    setLightbox({
      open: true,
      src,
      title: `${text.imagePreviewTitle} · ${item.sku}`,
    });
  }

  function closeImage() {
    setLightbox({
      open: false,
      src: "",
      title: "",
    });
  }

  async function loadEvidence() {
    try {
      setEvidenceLoading(true);
      setEvidenceError("");

      const response = await fetch(`/api/receipts/${receiptId}/evidence`, {
        method: "GET",
        cache: "no-store",
      });

      const result = await readJsonSafe(response);

      if (!response.ok || !result.ok) {
        throw new Error(result?.error || getEvidenceLoadErrorText(text));
      }

      const nextSaved = Array.isArray(result.items)
        ? result.items.map(
            (item: {
              id: string;
              fileName: string;
              mimeType: string | null;
              fileSize: number | null;
              dataUrl: string;
              createdAt: string;
            }) => ({
              id: item.id,
              name: item.fileName,
              url: item.dataUrl,
              fileSize: item.fileSize,
              mimeType: item.mimeType,
              createdAt: item.createdAt,
              local: false,
            }),
          )
        : [];

      setSavedEvidenceImages(nextSaved);
    } catch (error) {
      setEvidenceError(
        error instanceof Error ? error.message : getEvidenceLoadErrorText(text),
      );
    } finally {
      setEvidenceLoading(false);
    }
  }

  async function openEvidenceModal() {
    setEvidenceOpen(true);
    setEvidenceError("");
    await loadEvidence();
  }

  function closeEvidenceModal() {
    setEvidenceOpen(false);
    setEvidenceError("");
    setEvidenceDragActive(false);
  }

  async function queueEvidenceFiles(files: File[]) {
    if (!files.length) return;

    const totalCount =
      savedEvidenceImages.length + pendingEvidenceImages.length + files.length;

    if (totalCount > MAX_EVIDENCE_COUNT) {
      throw new Error(getEvidenceTooManyText(text));
    }

    const nextImages: EvidenceItem[] = [];

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        throw new Error(getEvidenceImageOnlyText(text));
      }

      if (file.size > MAX_EVIDENCE_SIZE) {
        throw new Error(getEvidenceSizeText(text));
      }

      const dataUrl = await readFileAsDataUrl(file);

      nextImages.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        name: file.name,
        url: dataUrl,
        fileSize: file.size,
        mimeType: file.type,
        createdAt: new Date().toISOString(),
        local: true,
      });
    }

    setEvidenceError("");
    setPendingEvidenceImages((prev) => [...prev, ...nextImages]);
  }

  async function handleEvidenceChoose(event: ChangeEvent<HTMLInputElement>) {
    try {
      const files = Array.from(event.target.files || []);
      await queueEvidenceFiles(files);
      event.target.value = "";
    } catch (error) {
      setEvidenceError("");
      setEvidenceError(
        error instanceof Error ? error.message : getEvidenceLoadErrorText(text),
      );
      event.target.value = "";
    }
  }

  function handleEvidenceDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setEvidenceDragActive(true);
  }

  function handleEvidenceDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setEvidenceDragActive(true);
  }

  function handleEvidenceDragLeave(event: DragEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    setEvidenceDragActive(false);
  }

  async function handleEvidenceDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setEvidenceDragActive(false);
    try {
      const files = extractDroppedImageFiles(event.dataTransfer);
      await queueEvidenceFiles(files);
    } catch (error) {
      setEvidenceError(
        error instanceof Error ? error.message : getEvidenceLoadErrorText(text),
      );
    }
  }

  function removePendingEvidence(imageId: string) {
    setPendingEvidenceImages((prev) => {
      const target = prev.find((item) => item.id === imageId);
      if (target?.local) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter((item) => item.id !== imageId);
    });
  }

  async function deleteSavedEvidence(imageId: string) {
    try {
      setEvidenceSaving(true);
      setEvidenceError("");

      const response = await fetch(
        `/api/receipts/${receiptId}/evidence/${imageId}`,
        {
          method: "DELETE",
        },
      );

      const result = await readJsonSafe(response);

      if (!response.ok || !result.ok) {
        throw new Error(result?.error || text.saveFailed);
      }

      setSavedEvidenceImages((prev) =>
        prev.filter((item) => item.id !== imageId),
      );
    } catch (error) {
      setEvidenceError(
        error instanceof Error ? error.message : text.saveFailed,
      );
    } finally {
      setEvidenceSaving(false);
    }
  }

  function openEvidenceImage(image: EvidenceItem) {
    setLightbox({
      open: true,
      src: image.url,
      title: image.name,
    });
  }

  async function saveEvidenceModal() {
    if (pendingEvidenceImages.length === 0) {
      setEvidenceError(getEvidenceSaveEmptyText(text));
      return;
    }

    try {
      setEvidenceSaving(true);
      setEvidenceError("");

      const response = await fetch(`/api/receipts/${receiptId}/evidence`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: pendingEvidenceImages.map((item) => ({
            fileName: item.name,
            mimeType: item.mimeType || "image/jpeg",
            fileSize: item.fileSize || 0,
            dataUrl: item.url,
          })),
        }),
      });

      const result = await readJsonSafe(response);

      if (!response.ok || !result.ok) {
        throw new Error(result?.error || text.saveFailed);
      }

      pendingEvidenceImages.forEach((item) => {
        if (item.local) {
          URL.revokeObjectURL(item.url);
        }
      });

      setPendingEvidenceImages([]);

      const nextSaved = Array.isArray(result.items)
        ? result.items.map(
            (item: {
              id: string;
              fileName: string;
              mimeType: string | null;
              fileSize: number | null;
              dataUrl: string;
              createdAt: string;
            }) => ({
              id: item.id,
              name: item.fileName,
              url: item.dataUrl,
              fileSize: item.fileSize,
              mimeType: item.mimeType,
              createdAt: item.createdAt,
              local: false,
            }),
          )
        : [];

      setSavedEvidenceImages(nextSaved);
      setEvidenceOpen(false);

      window.setTimeout(() => {
        scanInputRef.current?.focus();
      }, 0);
    } catch (error) {
      setEvidenceError(
        error instanceof Error ? error.message : text.saveFailed,
      );
    } finally {
      setEvidenceSaving(false);
    }
  }

  function closeItemEdit() {
    setEditingItemId(null);
    setItemForm({
      sku: "",
      barcode: "",
      casePack: "",
      expectedQty: "",
    });
  }

  function beginItemEdit(item: ItemRow) {
    setEditingItemId(item.id);
    setItemForm({
      sku: item.sku || "",
      barcode: item.barcode || "",
      casePack: item.casePack === null ? "" : String(item.casePack),
      expectedQty: item.expectedQty === null ? "" : String(item.expectedQty),
    });
  }

  function closeQtyEdit() {
    setEditingQtyId(null);
    setQtyForm({
      damagedQty: "",
      excessQty: "",
    });
  }

  function beginQtyEdit(item: ItemRow) {
    setEditingQtyId(item.id);
    setQtyForm({
      damagedQty: String(item.damagedQty ?? 0),
      excessQty: String(item.excessQty ?? 0),
    });
  }

  function openAddItemModal(code = "") {
    setAddItemForm(getInitialAddForm(code));
    setAddItemOpen(true);
  }

  function closeAddItemModal() {
    setAddItemOpen(false);
    setAddItemForm(getInitialAddForm());
  }

  function closeUnknownConfirm() {
    setConfirmUnknownOpen(false);
    setPendingUnknownCode("");
    setScanInput("");
    window.setTimeout(() => {
      scanInputRef.current?.focus();
    }, 0);
  }

  async function applyServerResult(
    result: {
      item: ItemRow;
      summary: SummaryState;
    },
    matchedSku?: string,
  ) {
    let pinnedId = result.item.id;

    setItems((prev) => {
      const exists = prev.some((item) => item.id === result.item.id);
      const next = exists
        ? prev.map((item) => (item.id === result.item.id ? result.item : item))
        : [result.item, ...prev];

      if (matchedSku) {
        const exactBySku = next.find(
          (item) => normalizeCode(item.sku) === normalizeCode(matchedSku),
        );
        if (exactBySku) {
          pinnedId = exactBySku.id;
        }
      }

      setSummary(buildSummary(next));
      return next;
    });

    setActiveItemId(pinnedId);
    setPinnedItemId(pinnedId);
  }

  async function handleScanMatched(itemId: string, matchedSku?: string) {
    try {
      setSaving(true);

      const response = await fetch(`/api/receipts/scan/${itemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receiptId,
          mode: "scan",
          useSupplierCasePack,
        }),
      });

      const result = await readJsonSafe(response);

      if (!response.ok || !result.ok) {
        throw new Error(result?.error || text.saveFailed);
      }

      await applyServerResult(result, matchedSku);

      window.setTimeout(() => {
        scanInputRef.current?.focus();
      }, 0);
    } finally {
      setSaving(false);
    }
  }

  async function saveItemEdit() {
    if (!editingItemId) return;

    try {
      setSaving(true);

      const response = await fetch(`/api/receipts/scan/${editingItemId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receiptId,
          mode: "edit_item",
          sku: itemForm.sku,
          barcode: itemForm.barcode,
          casePack: itemForm.casePack,
          expectedQty: itemForm.expectedQty,
        }),
      });

      const result = await readJsonSafe(response);

      if (!response.ok || !result.ok) {
        throw new Error(result?.error || text.saveFailed);
      }

      await applyServerResult(result, result.item.sku);
      closeItemEdit();

      window.setTimeout(() => {
        scanInputRef.current?.focus();
      }, 0);
    } finally {
      setSaving(false);
    }
  }

  async function saveQtyEdit() {
    if (!editingQtyId) return;

    try {
      setSaving(true);

      const response = await fetch(`/api/receipts/scan/${editingQtyId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receiptId,
          mode: "edit_qty",
          damagedQty: qtyForm.damagedQty,
          excessQty: qtyForm.excessQty,
        }),
      });

      const result = await readJsonSafe(response);

      if (!response.ok || !result.ok) {
        throw new Error(result?.error || text.saveFailed);
      }

      await applyServerResult(result);
      closeQtyEdit();

      window.setTimeout(() => {
        scanInputRef.current?.focus();
      }, 0);
    } finally {
      setSaving(false);
    }
  }

  async function createItem() {
    try {
      setSaving(true);

      const response = await fetch("/api/receipts/scan/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          receiptId,
          sku: addItemForm.sku,
          barcode: addItemForm.barcode,
          casePack: addItemForm.casePack,
          expectedQty: addItemForm.expectedQty,
        }),
      });

      const result = await readJsonSafe(response);

      if (!response.ok || !result.ok) {
        throw new Error(result?.error || text.saveFailed);
      }

      await applyServerResult(result, result.item.sku);
      closeAddItemModal();

      window.setTimeout(() => {
        scanInputRef.current?.focus();
      }, 0);
    } finally {
      setSaving(false);
    }
  }

  async function finishInspection() {
    try {
      setCompleting(true);

      const response = await fetch(`/api/receipts/${receiptId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await readJsonSafe(response);

      if (!response.ok || !result.ok) {
        throw new Error(result?.error || text.finishInspectionFailed);
      }

      window.location.assign(result?.billingHref || "/billing");
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : text.finishInspectionFailed,
      );
      setCompleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[20px] bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[18px] font-bold tracking-tight text-slate-950">
              {receiptNo}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
              <span>
                {text.supplier}：{supplierName}
              </span>
              <span>
                {text.uploadedAt}：{uploadedAtText}
              </span>
              <span>
                {text.inspectedAt}：{inspectedAtText}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {canFinishInspection ? (
              <button
                type="button"
                onClick={finishInspection}
                disabled={completing}
                className="inline-flex h-10 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-5 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {completing ? text.finishingInspection : text.finishInspection}
              </button>
            ) : null}
            <button
              type="button"
              onClick={openEvidenceModal}
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {text.uploadEvidence}
            </button>

            <Link
              href={backHref}
              className="inline-flex h-10 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-semibold text-white shadow-soft transition hover:opacity-95"
            >
              {text.back}
            </Link>
          </div>
        </div>

        <div className="mt-5 border-t border-slate-200 pt-5">
          <div className="grid gap-3 xl:grid-cols-8">
            <SummaryCard label={text.sku} value={summary.totalSku} />

            <SummaryCard
              label={text.expectedQty}
              value={summary.expectedQtyTotal}
            />

            <SummaryCard label={text.goodQty} value={summary.goodQtyTotal} />

            <SummaryCard
              label={text.diffQty}
              value={summary.diffQtyTotal}
              clickable={hasRealScanData && summary.diffQtyTotal > 0}
              active={summaryFilter === "diffQty"}
              onClick={() =>
                setSummaryFilter((prev) =>
                  prev === "diffQty" ? "all" : "diffQty",
                )
              }
              valueClassName={
                hasRealScanData && summary.diffQtyTotal > 0
                  ? "text-rose-600"
                  : "text-slate-900"
              }
            />

            <SummaryCard
              label={text.uncheckedQty}
              value={summary.uncheckedQtyTotal}
              clickable={hasRealScanData && summary.uncheckedQtyTotal > 0}
              active={summaryFilter === "uncheckedQty"}
              onClick={() =>
                setSummaryFilter((prev) =>
                  prev === "uncheckedQty" ? "all" : "uncheckedQty",
                )
              }
              valueClassName={
                hasRealScanData && summary.uncheckedQtyTotal > 0
                  ? "text-rose-600"
                  : "text-slate-900"
              }
            />

            <SummaryCard
              label={text.damagedQty}
              value={summary.damagedQtyTotal}
              valueClassName={
                summary.damagedQtyTotal > 0 ? "text-rose-600" : "text-slate-900"
              }
            />

            <SummaryCard
              label={text.excessQty}
              value={summary.excessQtyTotal}
              valueClassName={
                summary.excessQtyTotal > 0 ? "text-rose-600" : "text-slate-900"
              }
            />

            <SummaryCard
              label={text.addedQty}
              value={summary.addedCount}
              valueClassName={
                summary.addedCount > 0 ? "text-rose-600" : "text-slate-900"
              }
            />
          </div>

          <div className="mt-5 flex items-center gap-4">
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${summary.progress}%` }}
              />
            </div>
            <div className="w-12 text-right text-sm font-semibold text-slate-700">
              {summary.progress}%
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[20px] bg-white p-5 shadow-soft">
        <input
          ref={scanInputRef}
          value={scanInput}
          onChange={(e) => {
            setScanInput(e.target.value);
          }}
          placeholder={text.scanPlaceholder}
          autoComplete="off"
          spellCheck={false}
          className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-primary"
        />
      </section>

      <section className="overflow-hidden rounded-xl bg-white shadow-soft">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="whitespace-nowrap text-[18px] font-bold tracking-tight text-slate-900">
                {text.listTitle}
              </div>
              {summaryFilter !== "all" ? (
                <button
                  type="button"
                  onClick={() => setSummaryFilter("all")}
                  className="mt-2 inline-flex h-8 items-center rounded-full border border-primary/20 bg-primary/5 px-3 text-xs font-semibold text-primary"
                >
                  {summaryFilter === "diffQty" ? text.diffQty : text.uncheckedQty}
                </button>
              ) : null}
            </div>

            <div className="w-full max-w-[720px] xl:w-auto">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-end">
                <label className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={useSupplierCasePack}
                    onChange={(e) => setUseSupplierCasePack(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span>{text.supplierCasePack}</span>
                </label>
                <div className="flex h-11 w-full min-w-[320px] items-center rounded-xl border border-slate-200 bg-white px-4 xl:w-[420px]">
                  <svg
                    className="mr-3 h-4 w-4 shrink-0 text-slate-400"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M14.5 14.5L18 18" />
                    <circle cx="8.5" cy="8.5" r="5.75" />
                  </svg>
                  <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder={text.searchPlaceholder}
                    className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-separate border-spacing-0">
            <colgroup>
              <col className="w-[68px]" />
              <col className="w-[138px]" />
              <col className="w-[138px]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
              <col className="w-[72px]" />
              <col className="w-[92px]" />
              <col className="w-[72px]" />
              <col className="w-[56px]" />
              <col className="w-[56px]" />
              <col className="w-[56px]" />
              <col className="w-[56px]" />
              <col className="w-[96px]" />
              <col className="w-[48px]" />
            </colgroup>

            <thead>
              <tr className="bg-slate-50 text-left text-sm text-slate-500">
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.image}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.sku}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.barcode}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.nameZh}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.nameEs}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.casePack}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.supplierCasePackColumn}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.expectedQty}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.goodQty}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.diffQty}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.uncheckedQty}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.damagedQty}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.excessQty}
                </th>
                <th className="whitespace-nowrap px-2 py-3 font-semibold">
                  {text.status}
                </th>
                <th className="px-2 py-3 font-semibold" />
              </tr>
            </thead>

            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={15}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    {text.noItems}
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={15}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    {text.noMatch}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const imageAlt = row.nameZh || row.nameEs || row.sku || "-";
                  const rowHasScanData = hasRowScanData(row);
                  const damagedChanged = row.damagedQty > 0;
                  const diffChanged = rowHasScanData && row.diffQty > 0;
                  const excessChanged = row.excessQty > 0;

                  return (
                    <tr
                      key={row.id}
                      onClick={() => setActiveItemId(row.id)}
                      className="cursor-pointer border-t border-slate-100 transition hover:bg-secondary-accent/30"
                    >
                      <td className="px-2 py-3 align-middle">
                        {row.unexpected ? (
                          <div className="flex h-[44px] w-[44px] items-center justify-center text-xs text-slate-400">
                            {text.emptyImage}
                          </div>
                        ) : (
                          <ProductImage
                            sku={row.sku}
                            alt={imageAlt}
                            size={44}
                            roundedClassName="rounded-lg"
                            onClick={() => openImage(row)}
                          />
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-sm font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{row.sku || "-"}</span>
                          {row.unexpected ? (
                            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-semibold text-white">
                              \u65b0
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-sm text-slate-700">
                        {row.barcode || "-"}
                      </td>
                      <td className="truncate px-2 py-3 text-sm text-slate-700">
                        {row.nameZh || "-"}
                      </td>
                      <td className="truncate px-2 py-3 text-sm text-slate-700">
                        {row.nameEs || "-"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-sm text-slate-700">
                        {useSupplierCasePack ? "-" : (row.casePack ?? "-")}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-sm text-slate-700">
                        {useSupplierCasePack ? (row.supplierCasePack ?? "-") : "-"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-sm text-slate-700">
                        {row.expectedQty ?? 0}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-sm text-slate-700">
                        {row.goodQty}
                      </td>
                      <td
                        className={`whitespace-nowrap px-2 py-3 text-sm ${
                          diffChanged ? "text-rose-600" : "text-slate-700"
                        }`}
                      >
                        {row.diffQty}
                      </td>
                      <td
                        className={`whitespace-nowrap px-2 py-3 text-sm ${
                          rowHasScanData && row.uncheckedQty > 0
                            ? "text-rose-600"
                            : "text-slate-700"
                        }`}
                      >
                        {row.uncheckedQty}
                      </td>
                      <td
                        className={`whitespace-nowrap px-2 py-3 text-sm ${
                          damagedChanged ? "text-rose-600" : "text-slate-700"
                        }`}
                      >
                        {row.damagedQty}
                      </td>
                      <td
                        className={`whitespace-nowrap px-2 py-3 text-sm ${
                          excessChanged ? "text-rose-600" : "text-slate-700"
                        }`}
                      >
                        {row.excessQty}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-sm">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClassName(
                            row.status,
                          )}`}
                        >
                          {getStatusLabel(row.status, text)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-3 pl-2 pr-2 text-center text-sm">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (row.unexpected) {
                              beginItemEdit(row);
                            } else {
                              beginQtyEdit(row);
                            }
                          }}
                          title={text.editItem}
                          aria-label={text.editItem}
                          className="inline-flex items-center justify-center text-slate-500 transition hover:text-slate-900"
                        >
                          <PencilIcon />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editingItemId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-[720px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {text.addItemTitle}
              </h3>
            </div>

            <div className="px-5 py-5">
              <div className="grid gap-6 md:grid-cols-[152px_minmax(0,1fr)]">
                <div className="flex min-h-[132px] items-start justify-center">
                  <SkuPreviewImage
                    sku={itemForm.sku}
                    emptyText={text.emptyImage}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <div className="mb-2 text-sm font-medium text-slate-700">
                      {text.sku}
                    </div>
                    <input
                      value={itemForm.sku}
                      onChange={(e) =>
                        setItemForm((prev) => ({
                          ...prev,
                          sku: e.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-primary"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 text-sm font-medium text-slate-700">
                      {text.barcode}
                    </div>
                    <input
                      value={itemForm.barcode}
                      onChange={(e) =>
                        setItemForm((prev) => ({
                          ...prev,
                          barcode: e.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-primary"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 text-sm font-medium text-slate-700">
                      {text.casePack}
                    </div>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={itemForm.casePack}
                      onChange={(e) =>
                        setItemForm((prev) => ({
                          ...prev,
                          casePack: e.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-primary"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 text-sm font-medium text-slate-700">
                      {text.expectedQty}
                    </div>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={itemForm.expectedQty}
                      onChange={(e) =>
                        setItemForm((prev) => ({
                          ...prev,
                          expectedQty: e.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-primary"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={closeItemEdit}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {text.cancel}
              </button>

              <button
                type="button"
                onClick={saveItemEdit}
                disabled={saving}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? text.saving : text.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingQtyId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-[420px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {text.editQtyTitle}
              </h3>
            </div>

            <div className="space-y-4 px-5 py-5">
              <label className="block">
                <div className="mb-2 text-sm font-medium text-slate-700">
                  {text.damagedQtyInput}
                </div>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={qtyForm.damagedQty}
                  onChange={(e) =>
                    setQtyForm((prev) => ({
                      ...prev,
                      damagedQty: e.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-primary"
                />
              </label>

              <label className="block">
                <div className="mb-2 text-sm font-medium text-slate-700">
                  {text.excessQtyInput}
                </div>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={qtyForm.excessQty}
                  onChange={(e) =>
                    setQtyForm((prev) => ({
                      ...prev,
                      excessQty: e.target.value,
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-primary"
                />
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={closeQtyEdit}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {text.cancel}
              </button>

              <button
                type="button"
                onClick={saveQtyEdit}
                disabled={saving}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? text.saving : text.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmUnknownOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-[420px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {text.addUnknownTitle}
              </h3>
            </div>

            <div className="px-5 py-5 text-sm text-slate-700">
              <p>{text.addUnknownDesc}</p>
              <p className="mt-3 text-slate-500">{pendingUnknownCode}</p>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={closeUnknownConfirm}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {text.confirmNo}
              </button>

              <button
                type="button"
                onClick={() => {
                  const code = pendingUnknownCode;
                  closeUnknownConfirm();
                  openAddItemModal(code);
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft transition hover:opacity-95"
              >
                {text.confirmYes}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {addItemOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-[720px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {text.addItemTitle}
              </h3>
            </div>

            <div className="px-5 py-5">
              <div className="grid gap-6 md:grid-cols-[152px_minmax(0,1fr)]">
                <div className="flex min-h-[132px] items-start justify-center">
                  <SkuPreviewImage
                    sku={addItemForm.sku}
                    emptyText={text.emptyImage}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <div className="mb-2 text-sm font-medium text-slate-700">
                      {text.sku}
                    </div>
                    <input
                      value={addItemForm.sku}
                      onChange={(e) =>
                        setAddItemForm((prev) => ({
                          ...prev,
                          sku: e.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-primary"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 text-sm font-medium text-slate-700">
                      {text.barcode}
                    </div>
                    <input
                      value={addItemForm.barcode}
                      onChange={(e) =>
                        setAddItemForm((prev) => ({
                          ...prev,
                          barcode: e.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-primary"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 text-sm font-medium text-slate-700">
                      {text.casePack}
                    </div>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={addItemForm.casePack}
                      onChange={(e) =>
                        setAddItemForm((prev) => ({
                          ...prev,
                          casePack: e.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-primary"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 text-sm font-medium text-slate-700">
                      {text.expectedQty}
                    </div>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={addItemForm.expectedQty}
                      onChange={(e) =>
                        setAddItemForm((prev) => ({
                          ...prev,
                          expectedQty: e.target.value,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-primary"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={closeAddItemModal}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {text.cancel}
              </button>

              <button
                type="button"
                onClick={createItem}
                disabled={saving}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? text.saving : text.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {evidenceOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-[960px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {text.evidenceTitle}
              </h3>
            </div>

            <div className="space-y-5 px-5 py-5">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  {text.chooseImages}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleEvidenceChoose}
                  />
                </label>

                <div className="text-sm text-slate-500">
                  {getUploadingRuleText(text)}
                </div>
              </div>

              {evidenceError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                  {evidenceError}
                </div>
              ) : null}

              {evidenceLoading ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                  {text.saving}
                </div>
              ) : null}

              {!evidenceLoading &&
              savedEvidenceImages.length === 0 &&
              pendingEvidenceImages.length === 0 ? (
                <div
                  onDragOver={handleEvidenceDragOver}
                  onDragEnter={handleEvidenceDragEnter}
                  onDragLeave={handleEvidenceDragLeave}
                  onDrop={handleEvidenceDrop}
                  className={`rounded-xl border border-dashed px-4 py-10 text-center text-sm transition ${
                    evidenceDragActive
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-slate-200 text-slate-500"
                  }`}
                >
                  <div>{text.noEvidence}</div>
                  <div className="mt-2 text-xs">
                    {evidenceDragActive
                      ? "\u677e\u5f00\u9f20\u6807\u4e0a\u4f20\u56fe\u7247"
                      : "\u53ef\u4ee5\u62d6\u62fd\u56fe\u7247\u5230\u6b64"}
                  </div>
                </div>
              ) : null}

              {!evidenceLoading && savedEvidenceImages.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-slate-700">
                    {getSavedText(text)}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {savedEvidenceImages.map((image) => (
                      <div key={image.id} className="overflow-hidden bg-white">
                        <button
                          type="button"
                          onClick={() => openEvidenceImage(image)}
                          className="block w-full text-left"
                        >
                          <img
                            src={image.url}
                            alt={image.name}
                            className="h-44 w-full object-cover"
                          />
                        </button>
                        <div className="flex items-center justify-between gap-2 px-0 py-2">
                          <div className="min-w-0 truncate text-sm text-slate-600">
                            {image.name}
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteSavedEvidence(image.id)}
                            disabled={evidenceSaving}
                            aria-label={getDeleteText(text)}
                            title={getDeleteText(text)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {!evidenceLoading && pendingEvidenceImages.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-sm font-semibold text-slate-700">
                    {getPendingText(text)}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {pendingEvidenceImages.map((image) => (
                      <div key={image.id} className="overflow-hidden bg-white">
                        <button
                          type="button"
                          onClick={() => openEvidenceImage(image)}
                          className="block w-full text-left"
                        >
                          <img
                            src={image.url}
                            alt={image.name}
                            className="h-44 w-full object-cover"
                          />
                        </button>
                        <div className="flex items-center justify-between gap-2 px-0 py-2">
                          <div className="min-w-0 truncate text-sm text-slate-600">
                            {image.name}
                          </div>
                          <button
                            type="button"
                            onClick={() => removePendingEvidence(image.id)}
                            aria-label={getDeleteText(text)}
                            title={getDeleteText(text)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={closeEvidenceModal}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {text.cancel}
              </button>

              <button
                type="button"
                onClick={saveEvidenceModal}
                disabled={pendingEvidenceImages.length === 0 || evidenceSaving}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {evidenceSaving ? text.saving : text.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ImageLightbox
        open={lightbox.open}
        src={lightbox.src}
        title={lightbox.title}
        onClose={closeImage}
      />
    </div>
  );
}
