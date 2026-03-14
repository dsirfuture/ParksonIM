"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { ProductImage } from "@/components/product-image";
import { ImageLightbox } from "@/components/image-lightbox";
import { buildProductImageUrl } from "@/lib/product-image-url";

type Lang = "zh" | "es";

type ParsedRow = {
  receipt_no: string;
  supplier_name?: string;
  sku: string;
  barcode?: string;
  name_zh?: string;
  name_es?: string;
  case_pack?: number;
  expected_qty: number;
  sell_price?: number;
  discount?: number;
  normal_discount?: number;
  vip_discount?: number;
  line_total?: number;
};

type ValidateError = {
  row: number;
  field: string;
  message: string;
};

type ValidateResponse = {
  ok: boolean;
  errorCode?:
    | "HEADER_INVALID"
    | "RECEIPT_EXISTS"
    | "FILE_DUPLICATE"
    | "INVALID_PAYLOAD"
    | "SERVER_ERROR";
  summary?: {
    totalRows: number;
    receiptCount: number;
    skuCount: number;
    totalExpectedQty: number;
  };
  errors?: ValidateError[];
  normalizedRows?: ParsedRow[];
};

type ImportResponse = {
  ok: boolean;
  summary?: {
    receiptCount: number;
    supplierCount?: number;
    skuCount?: number;
    totalExpectedQty?: number;
    itemCount?: number;
    batchCount?: number;
  };
  error?: string;
};

type ModalState = {
  open: boolean;
  kind: "success" | "error";
  mode: "validate" | "import";
  title: string;
  lines: string[];
};

type RecentBatch = {
  id: string;
  status: string;
  created_at: string;
  receipt?: {
    id: string;
    receipt_no: string;
    supplier_name: string | null;
  } | null;
};

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : undefined;
}

function toStringValue(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s ? s : undefined;
}

function parseDiscount(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;

  const raw = String(value).trim().replace(/\s+/g, "");
  if (!raw) return undefined;

  if (raw.endsWith("%")) {
    const num = Number(raw.slice(0, -1));
    if (!Number.isFinite(num)) return undefined;
    return num / 100;
  }

  const num = Number(raw);
  if (!Number.isFinite(num)) return undefined;

  if (num > 1) return num / 100;
  if (num < 0) return undefined;
  return num;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function calcLineTotal(
  qty?: number,
  price?: number,
  normalDiscount?: number,
  vipDiscount?: number,
  rawLineTotal?: number,
): number | undefined {
  if (rawLineTotal !== undefined && Number.isFinite(rawLineTotal)) {
    return round2(rawLineTotal);
  }

  if (
    qty === undefined ||
    !Number.isFinite(qty) ||
    price === undefined ||
    !Number.isFinite(price)
  ) {
    return undefined;
  }

  let factor = 1;

  if (normalDiscount !== undefined && Number.isFinite(normalDiscount)) {
    factor *= 1 - normalDiscount;
  }

  if (vipDiscount !== undefined && Number.isFinite(vipDiscount)) {
    factor *= 1 - vipDiscount;
  }

  return round2(qty * price * factor);
}

function normalizeHeaderKey(key: string): string {
  return key.trim().toLowerCase();
}

function mapRow(raw: Record<string, unknown>): ParsedRow {
  const entries = Object.entries(raw).reduce<Record<string, unknown>>(
    (acc, [k, v]) => {
      acc[normalizeHeaderKey(k)] = v;
      return acc;
    },
    {},
  );

  const receipt_no =
    toStringValue(entries["receipt_no"]) ||
    toStringValue(entries["单号"]) ||
    toStringValue(entries["receipt no"]) ||
    "";

  const supplier_name =
    toStringValue(entries["supplier_name"]) ||
    toStringValue(entries["供应商"]) ||
    toStringValue(entries["supplier"]);

  const sku =
    toStringValue(entries["sku"]) ||
    toStringValue(entries["商品编码"]) ||
    toStringValue(entries["商品编号"]) ||
    toStringValue(entries["编码"]) ||
    "";

  const barcode =
    toStringValue(entries["barcode"]) || toStringValue(entries["条码"]);

  const name_zh =
    toStringValue(entries["name_zh"]) || toStringValue(entries["中文名"]);

  const name_es =
    toStringValue(entries["name_es"]) || toStringValue(entries["西文名"]);

  const case_pack =
    toNumber(entries["case_pack"]) ??
    toNumber(entries["包装数"]) ??
    toNumber(entries["箱规"]);

  const expected_qty =
    toNumber(entries["expected_qty"]) ??
    toNumber(entries["应收数量"]) ??
    toNumber(entries["数量"]) ??
    0;

  const sell_price =
    toNumber(entries["sell_price"]) ??
    toNumber(entries["单价"]) ??
    toNumber(entries["price"]);

  const normal_discount =
    parseDiscount(entries["normal_discount"]) ??
    parseDiscount(entries["普通折扣"]) ??
    parseDiscount(entries["discount"]) ??
    parseDiscount(entries["折扣"]);

  const vip_discount =
    parseDiscount(entries["vip_discount"]) ??
    parseDiscount(entries["vip折扣"]) ??
    parseDiscount(entries["vip 折扣"]) ??
    parseDiscount(entries["VIP折扣"]) ??
    parseDiscount(entries["VIP 折扣"]);

  const rawLineTotal =
    toNumber(entries["line_total"]) ??
    toNumber(entries["金额"]) ??
    toNumber(entries["行总额"]);

  const line_total = calcLineTotal(
    expected_qty,
    sell_price,
    normal_discount,
    vip_discount,
    rawLineTotal,
  );

  return {
    receipt_no,
    supplier_name,
    sku,
    barcode,
    name_zh,
    name_es,
    case_pack,
    expected_qty,
    sell_price,
    discount: normal_discount,
    normal_discount,
    vip_discount,
    line_total,
  };
}

function formatCurrency(value?: number) {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return "-";
  }
  return `$ ${value.toFixed(2)}`;
}

function formatDiscount(value?: number) {
  if (value === undefined || value === null || !Number.isFinite(value)) {
    return "-";
  }
  const percent = value <= 1 ? value * 100 : value;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}

function rowHasAnyValue(row: unknown[]) {
  return row.some((cell) => String(cell ?? "").trim() !== "");
}

function findHeaderRowIndex(matrix: unknown[][]) {
  for (let i = 0; i < matrix.length; i += 1) {
    if (rowHasAnyValue(matrix[i] || [])) {
      return i;
    }
  }
  return -1;
}

function buildObjectsFromMatrix(
  matrix: unknown[][],
  headerRowIndex: number,
): Record<string, unknown>[] {
  const headerRow = (matrix[headerRowIndex] || []).map((cell) =>
    String(cell ?? "").trim(),
  );

  const result: Record<string, unknown>[] = [];

  for (let i = headerRowIndex + 1; i < matrix.length; i += 1) {
    const row = matrix[i] || [];
    if (!rowHasAnyValue(row)) continue;

    const record: Record<string, unknown> = {};

    for (let j = 0; j < headerRow.length; j += 1) {
      const key = String(headerRow[j] ?? "").trim();
      if (!key) continue;
      record[key] = row[j] ?? "";
    }

    result.push(record);
  }

  return result;
}

function formatTime(value: string, lang: Lang) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function mapBatchStatus(status: string, lang: Lang) {
  if (lang === "zh") {
    if (status === "completed") return "已成功导入";
    if (status === "pending") return "待处理";
    if (status === "processing") return "处理中";
    if (status === "failed") return "导入失败";
    return "已更新";
  }

  if (status === "completed") return "Importación correcta";
  if (status === "pending") return "Pendiente";
  if (status === "processing") return "En proceso";
  if (status === "failed") return "Importación fallida";
  return "Actualizado";
}

function statusBadgeClass(status: string) {
  if (status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "failed") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (status === "processing") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
}

function EyeIcon() {
  return (
    <svg
      className="h-[18px] w-[18px]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const HISTORY_PAGE_SIZE = 8;

function translateServerLine(line: string, lang: Lang) {
  if (lang === "zh") return line;

  if (line === "请调整表格规范") {
    return "Ajusta el formato del archivo";
  }

  if (line === "未读取到表头 请确认首行是否为标题行") {
    return "No se detectó el encabezado Confirma que la primera fila sea la fila de títulos";
  }

  if (line.startsWith("检测到多余表头：")) {
    const value = line.replace("检测到多余表头：", "");
    return `Se detectaron encabezados no permitidos: ${value}`;
  }

  if (line.startsWith("请删除以下表头后再导入：")) {
    const value = line.replace("请删除以下表头后再导入：", "");
    return `Elimina estos encabezados antes de importar: ${value}`;
  }

  if (line.startsWith("缺少必填表头：")) {
    const value = line.replace("缺少必填表头：", "");
    return `Faltan encabezados obligatorios: ${value}`;
  }

  if (line.startsWith("第 ") && line.includes("列表头为空 请补齐后再导入")) {
    return line
      .replace("第 ", "La columna ")
      .replace(
        " 列表头为空 请补齐后再导入",
        " no tiene encabezado Complétala antes de importar",
      );
  }

  if (line.startsWith("此验货单已存在：")) {
    const value = line.replace("此验货单已存在：", "");
    return `La recepción ya existe: ${value}`;
  }

  if (line.startsWith("表格中重复：单号 ")) {
    const value = line.replace("表格中重复：单号 ", "");
    return `Datos duplicados en el archivo: número ${value}`;
  }

  if (line.startsWith("第 ") && line.includes(" 行字段错误：")) {
    return line
      .replace("第 ", "Fila ")
      .replace(" 行字段错误：", " con campo inválido: ");
  }

  if (line === "文件内容无法识别") {
    return "No fue posible reconocer el contenido del archivo";
  }

  if (line === "当前未能完成处理 请稍后再试") {
    return "Por ahora no fue posible completar la operación Inténtalo más tarde";
  }

  if (line === "当前开发会话未配置租户和公司") {
    return "La sesión actual no tiene tenant ni compañía configurados";
  }

  if (
    line ===
    "当前开发会话对应的租户或公司不存在 请检查登录状态或重新初始化测试数据"
  ) {
    return "El tenant o la compañía de la sesión actual no existen Revisa el inicio de sesión o vuelve a inicializar los datos de prueba";
  }

  if (line === "导入内容格式不正确") {
    return "El contenido de importación no tiene el formato correcto";
  }

  if (line === "当前未能完成导入 请稍后再试") {
    return "Por ahora no fue posible completar la importación Inténtalo más tarde";
  }

  return line;
}

function translateLines(lines: string[], lang: Lang) {
  return [
    ...new Set(
      lines.filter(Boolean).map((line) => translateServerLine(line, lang)),
    ),
  ];
}

export function ImportClient({
  lang,
  recentBatches,
}: {
  lang: Lang;
  recentBatches: RecentBatch[];
}) {
  const [fileName, setFileName] = useState("");
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [validateResult, setValidateResult] = useState<ValidateResponse | null>(
    null,
  );
  const [loadingValidate, setLoadingValidate] = useState(false);
  const [loadingImport, setLoadingImport] = useState(false);
  const [clientError, setClientError] = useState("");
  const [modal, setModal] = useState<ModalState>({
    open: false,
    kind: "success",
    mode: "validate",
    title: "",
    lines: [],
  });
  const [previewImage, setPreviewImage] = useState<{
    open: boolean;
    src: string;
    title: string;
  }>({
    open: false,
    src: "",
    title: "",
  });
  const [importSummary, setImportSummary] = useState<
    ImportResponse["summary"] | null
  >(null);
  const [activeView, setActiveView] = useState<"preview" | "history">(
    "preview",
  );
  const [historyKeyword, setHistoryKeyword] = useState("");
  const [historyPage, setHistoryPage] = useState(1);

  const formatBatchStatus = (status: string) => mapBatchStatus(status, lang);

  const filteredHistoryBatches = useMemo(() => {
    const value = historyKeyword.trim().toLowerCase();

    if (!value) return recentBatches;

    return recentBatches.filter((batch) => {
      const source = [
        batch.receipt?.receipt_no || "",
        batch.receipt?.supplier_name || "",
        formatTime(batch.created_at, lang),
      ]
        .join(" ")
        .toLowerCase();

      return source.includes(value);
    });
  }, [historyKeyword, recentBatches, lang]);

  const historyTotalPages = Math.max(
    1,
    Math.ceil(filteredHistoryBatches.length / HISTORY_PAGE_SIZE),
  );

  const currentHistoryPage = Math.min(historyPage, historyTotalPages);

  const pagedHistoryBatches = useMemo(() => {
    const start = (currentHistoryPage - 1) * HISTORY_PAGE_SIZE;
    return filteredHistoryBatches.slice(start, start + HISTORY_PAGE_SIZE);
  }, [filteredHistoryBatches, currentHistoryPage]);

  function handleHistoryKeywordChange(value: string) {
    setHistoryKeyword(value);
    setHistoryPage(1);
  }

  function goToHistoryPage(nextPage: number) {
    if (nextPage < 1 || nextPage > historyTotalPages) return;
    setHistoryPage(nextPage);
  }

  const text = useMemo(
    () =>
      lang === "zh"
        ? {
            choose: "上传文件",
            downloadTemplate: "下载文件模板",
            selected: "已选择文件",
            previewTitle: "导入预览",
            previewDesc:
              "仅显示前 5 行 便于当前页面完整查看图片 单号 供应商 折扣和金额信息",
            noData: "当前还没有读取到文件内容",
            validate: "检查文件",
            importBtn: "正式导入",
            validating: "检查中",
            importing: "导入中",
            importTitle: "导入结果",
            receiptCount: "验货单数",
            supplierCount: "供应商数",
            skuCount: "SKU总数",
            totalExpectedQty: "应验总数量",
            parseError: "文件暂时无法识别 请重新选择",
            serverError: "当前未能完成处理 请稍后再试",
            importDone: "导入已完成 现在可以前往验货单列表查看",
            goReceipts: "去验货单列表",
            colImage: "图片",
            colReceipt: "单号",
            colSupplier: "供应商",
            colSku: "SKU",
            colQty: "数量",
            colPrice: "单价 MXN",
            colNormalDiscount: "普通折扣",
            colVipDiscount: "VIP折扣",
            colAmount: "金额 MXN",
            close: "关闭",
            modalTitleHeader: "请调整表格规范",
            modalTitleExists: "此验货单已存在",
            modalTitleDuplicate: "表格中存在重复数据",
            modalTitleSuccess: "检查已通过",
            modalTitleImportSuccess: "导入结果",
            statTotalRows: "总行数",
            statReceiptCount: "验货单数",
            statSkuCount: "总单SKU",
            statTotalExpectedQty: "应验总数量",
            previewTab: "导入预览",
            historyTab: "最近导入批次",
            previewRight: "预览前 5 行",
            historyRight: "最近导入批次",
            noRecent: "当前还没有导入记录",
            historySearchPlaceholder: "搜索单号、供应商、时间",
            historyCount: (count: number) => `共 ${count} 单`,
            previousPage: "上一页",
            nextPage: "下一页",
            colStatus: "状态",
            colTime: "导入时间",
            colAction: "",
            view: "查看详情",
            noSupplier: "未填写",
          }
        : {
            choose: "Subir archivo",
            downloadTemplate: "Descargar plantilla",
            selected: "Archivo seleccionado",
            previewTitle: "Vista previa",
            previewDesc:
              "Se muestran solo 5 filas para revisar imagen, número, proveedor, descuentos e importe",
            noData: "Todavía no se ha leído contenido del archivo",
            validate: "Revisar archivo",
            importBtn: "Importar",
            validating: "Revisando",
            importing: "Importando",
            importTitle: "Resultado de importación",
            receiptCount: "Recepciones",
            supplierCount: "Proveedores",
            skuCount: "SKU totales",
            totalExpectedQty: "Cantidad total",
            parseError:
              "No fue posible reconocer el archivo Vuelve a seleccionarlo",
            serverError:
              "Por ahora no fue posible completar la operación Inténtalo más tarde",
            importDone:
              "La importación terminó Ya puedes revisar la lista de recepciones",
            goReceipts: "Ir a recepciones",
            colImage: "Imagen",
            colReceipt: "Número",
            colSupplier: "Proveedor",
            colSku: "SKU",
            colQty: "Cantidad",
            colPrice: "Precio MXN",
            colNormalDiscount: "Descuento normal",
            colVipDiscount: "Descuento VIP",
            colAmount: "Importe MXN",
            close: "Cerrar",
            modalTitleHeader: "Ajusta el formato del archivo",
            modalTitleExists: "La recepción ya existe",
            modalTitleDuplicate: "Hay datos duplicados en el archivo",
            modalTitleSuccess: "Revisión correcta",
            modalTitleImportSuccess: "Resultado de importación",
            statTotalRows: "Filas totales",
            statReceiptCount: "Recepciones",
            statSkuCount: "SKU totales",
            statTotalExpectedQty: "Cantidad total",
            previewTab: "Vista previa",
            historyTab: "Lotes recientes",
            previewRight: "Primeras 5 filas",
            historyRight: "Últimos 8 lotes",
            noRecent: "Todavía no hay registros de importación",
            historySearchPlaceholder: "Buscar número, proveedor, fecha",
            historyCount: (count: number) => `${count} lotes`,
            previousPage: "Anterior",
            nextPage: "Siguiente",
            colStatus: "Estado",
            colTime: "Fecha",
            colAction: "",
            view: "Ver detalle",
            noSupplier: "Sin proveedor",
          },
    [lang],
  );

  async function onFileChange(file: File | null) {
    setClientError("");
    setValidateResult(null);
    setRows([]);
    setRawHeaders([]);
    setFileName("");
    setImportSummary(null);
    setActiveView("preview");
    setModal({
      open: false,
      kind: "success",
      mode: "validate",
      title: "",
      lines: [],
    });

    if (!file) return;

    try {
      setFileName(file.name);

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, {
        type: "array",
        cellDates: false,
      });

      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];

      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: false,
        defval: "",
        blankrows: false,
      });

      const headerRowIndex = findHeaderRowIndex(matrix);

      if (headerRowIndex === -1) {
        setRawHeaders([]);
        setRows([]);
        return;
      }

      const headers = (matrix[headerRowIndex] || []).map((cell) =>
        String(cell ?? "").trim(),
      );

      const objects = buildObjectsFromMatrix(matrix, headerRowIndex);
      const mapped = objects.map(mapRow);

      setRawHeaders(headers);
      setRows(mapped);
    } catch {
      setClientError(text.parseError);
    }
  }

  async function handleValidate() {
    try {
      setLoadingValidate(true);
      setClientError("");
      setImportSummary(null);
      setModal({
        open: false,
        kind: "success",
        mode: "validate",
        title: "",
        lines: [],
      });

      const res = await fetch("/api/receipts/import/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers: rawHeaders, rows }),
      });

      const data: ValidateResponse = await res.json();
      setValidateResult(data);

      if (data.ok) {
        const lines = data.summary
          ? [
              `${text.statTotalRows}：${data.summary.totalRows}`,
              `${text.statReceiptCount}：${data.summary.receiptCount}`,
              `${text.statSkuCount}：${data.summary.skuCount}`,
              `${text.statTotalExpectedQty}：${data.summary.totalExpectedQty}`,
            ]
          : [];

        setModal({
          open: true,
          kind: "success",
          mode: "validate",
          title: text.modalTitleSuccess,
          lines,
        });
        return;
      }

      const lines = translateLines(
        (data.errors || []).map((item) => item.message),
        lang,
      );

      if (
        data.errorCode === "HEADER_INVALID" ||
        data.errorCode === "RECEIPT_EXISTS" ||
        data.errorCode === "FILE_DUPLICATE"
      ) {
        setModal({
          open: true,
          kind: "error",
          mode: "validate",
          title:
            data.errorCode === "HEADER_INVALID"
              ? text.modalTitleHeader
              : data.errorCode === "RECEIPT_EXISTS"
                ? text.modalTitleExists
                : text.modalTitleDuplicate,
          lines,
        });
        return;
      }

      if (lines.length > 0) {
        setModal({
          open: true,
          kind: "error",
          mode: "validate",
          title: text.modalTitleHeader,
          lines,
        });
        return;
      }

      setClientError(text.serverError);
    } catch {
      setClientError(text.serverError);
    } finally {
      setLoadingValidate(false);
    }
  }

  async function handleImport() {
    try {
      setLoadingImport(true);
      setClientError("");

      const rowsToImport = validateResult?.normalizedRows || rows;
      const res = await fetch("/api/receipts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rowsToImport }),
      });

      const data: ImportResponse = await res.json();

      if (!res.ok || !data.ok) {
        const message = data.error || text.serverError;
        const lines = translateLines(message.split("\n").filter(Boolean), lang);

        if (
          lines.some(
            (line) =>
              line.includes("此验货单已存在") ||
              line.includes("La recepción ya existe"),
          )
        ) {
          setModal({
            open: true,
            kind: "error",
            mode: "import",
            title: text.modalTitleExists,
            lines,
          });
          return;
        }

        setClientError(lines.join(" "));
        return;
      }

      setImportSummary(data.summary || null);
      setActiveView("history");
      setModal({
        open: true,
        kind: "success",
        mode: "import",
        title: text.modalTitleImportSuccess,
        lines: [],
      });
    } catch {
      setClientError(text.serverError);
    } finally {
      setLoadingImport(false);
    }
  }

  return (
    <div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
        <div className="p-5 pb-4">
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 py-6">
            <div className="mx-auto flex max-w-[860px] flex-col items-center">
              <div className="flex flex-wrap items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/api/receipts/import/template";
                  }}
                  className="inline-flex h-10 min-w-[120px] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {text.downloadTemplate}
                </button>

                <label className="inline-flex h-10 min-w-[120px] cursor-pointer items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-soft transition hover:opacity-95">
                  {text.choose}
                  <input
                    type="file"
                    accept=".xls,.xlsx"
                    className="hidden"
                    onChange={(e) => onFileChange(e.target.files?.[0] || null)}
                  />
                </label>

                <button
                  type="button"
                  disabled={!rows.length || loadingValidate}
                  onClick={handleValidate}
                  className="inline-flex h-10 min-w-[120px] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingValidate ? text.validating : text.validate}
                </button>

                <button
                  type="button"
                  disabled={
                    !rows.length || !validateResult?.ok || loadingImport
                  }
                  onClick={handleImport}
                  className="inline-flex h-10 min-w-[120px] items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-soft transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingImport ? text.importing : text.importBtn}
                </button>
              </div>

              <div className="mt-5 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-center text-sm text-slate-500">
                {fileName ? `${text.selected}：${fileName}` : text.noData}
              </div>

              {clientError ? (
                <div className="mt-4 w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {clientError}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-white">
          <div className="px-5 py-3">
            {activeView === "preview" ? (
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0 flex-1 pr-0 xl:pr-6">
                  <div className="flex flex-col gap-1 xl:flex-row xl:items-center xl:gap-4">
                    <h2 className="shrink-0 text-[18px] font-semibold tracking-tight text-slate-900">
                      {text.previewTab}
                    </h2>
                    <p className="min-w-0 text-sm leading-6 text-slate-500">
                      {text.previewDesc}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveView("preview")}
                    className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-soft transition"
                  >
                    {text.previewTab}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveView("history")}
                    className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    {text.historyTab}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <h2 className="shrink-0 text-[18px] font-semibold tracking-tight text-slate-900">
                    {text.historyTab}
                  </h2>

                  <div className="w-full max-w-[420px] xl:flex-1">
                    <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-4">
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
                        value={historyKeyword}
                        onChange={(e) =>
                          handleHistoryKeywordChange(e.target.value)
                        }
                        placeholder={text.historySearchPlaceholder}
                        className="w-full border-0 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                      />
                    </div>
                  </div>

                  <div className="shrink-0 whitespace-nowrap text-sm text-slate-400">
                    {text.historyCount(filteredHistoryBatches.length)}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Link
                    href="/receipts"
                    className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    {text.goReceipts}
                  </Link>

                  <button
                    type="button"
                    onClick={() => setActiveView("preview")}
                    className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    {text.previewTab}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveView("history")}
                    className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-soft transition"
                  >
                    {text.historyTab}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200">
            {activeView === "preview" ? (
              rows.length === 0 ? (
                <div className="p-5 text-sm text-slate-500">{text.noData}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-slate-50 text-left text-sm text-slate-500">
                        <th className="px-4 py-3 font-semibold">
                          {text.colImage}
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          {text.colReceipt}
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          {text.colSupplier}
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          {text.colSku}
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          {text.colQty}
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          {text.colPrice}
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          {text.colNormalDiscount}
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          {text.colVipDiscount}
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          {text.colAmount}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 5).map((row, index) => {
                        const imageSrc = row.sku
                          ? buildProductImageUrl(row.sku, "jpg")
                          : "";

                        return (
                          <tr
                            key={`${row.receipt_no}-${row.sku}-${index}`}
                            className="border-t border-slate-100 transition hover:bg-rose-50/60"
                          >
                            <td className="px-4 py-3 text-sm text-slate-700">
                              <ProductImage
                                sku={row.sku}
                                alt={row.name_zh || row.name_es || row.sku}
                                size={52}
                                onClick={() => {
                                  if (!imageSrc) return;
                                  setPreviewImage({
                                    open: true,
                                    src: imageSrc,
                                    title: row.sku,
                                  });
                                }}
                              />
                            </td>

                            <td className="px-4 py-3 text-sm text-slate-700">
                              {row.receipt_no || "-"}
                            </td>

                            <td className="px-4 py-3 text-sm text-slate-700">
                              {row.supplier_name || text.noSupplier}
                            </td>

                            <td className="px-4 py-3 text-sm font-medium text-slate-900">
                              {row.sku || "-"}
                            </td>

                            <td className="px-4 py-3 text-sm text-slate-700">
                              {row.expected_qty ?? "-"}
                            </td>

                            <td className="px-4 py-3 text-sm text-slate-700">
                              {formatCurrency(row.sell_price)}
                            </td>

                            <td className="px-4 py-3 text-sm text-slate-700">
                              {formatDiscount(row.normal_discount)}
                            </td>

                            <td className="px-4 py-3 text-sm text-slate-700">
                              {formatDiscount(row.vip_discount)}
                            </td>

                            <td className="px-4 py-3 text-sm font-medium text-slate-900">
                              {formatCurrency(row.line_total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : recentBatches.length === 0 ? (
              <div className="p-5 text-sm text-slate-500">{text.noRecent}</div>
            ) : (
              <>
                {pagedHistoryBatches.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-slate-500">
                    {text.noRecent}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-0">
                      <thead>
                        <tr className="bg-slate-50 text-left text-sm text-slate-500">
                          <th className="px-4 py-3 font-semibold">
                            {text.colReceipt}
                          </th>
                          <th className="px-4 py-3 font-semibold">
                            {text.colSupplier}
                          </th>
                          <th className="px-4 py-3 font-semibold">
                            {text.colStatus}
                          </th>
                          <th className="px-4 py-3 font-semibold">
                            {text.colTime}
                          </th>
                          <th className="px-4 py-3 text-right font-semibold">
                            {text.colAction}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedHistoryBatches.map((batch) => (
                          <tr
                            key={batch.id}
                            className="border-t border-slate-100 transition hover:bg-rose-50/60"
                          >
                            <td className="px-4 py-3 align-middle text-sm font-medium text-slate-900">
                              {batch.receipt?.receipt_no || "-"}
                            </td>
                            <td className="px-4 py-3 align-middle text-sm text-slate-700">
                              {batch.receipt?.supplier_name || text.noSupplier}
                            </td>
                            <td className="px-4 py-3 align-middle text-sm text-slate-700">
                              {formatBatchStatus(batch.status)}
                            </td>
                            <td className="px-4 py-3 align-middle whitespace-nowrap text-sm text-slate-700">
                              {formatTime(batch.created_at, lang)}
                            </td>
                            <td className="px-4 py-3 align-middle">
                              <div className="flex items-center justify-end">
                                {batch.receipt?.id ? (
                                  <Link
                                    href={`/receipts/${batch.receipt.id}`}
                                    className="inline-flex h-8 w-8 items-center justify-center text-slate-500 transition hover:text-slate-800"
                                    title={text.view}
                                    aria-label={text.view}
                                  >
                                    <EyeIcon />
                                  </Link>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {filteredHistoryBatches.length > 0 ? (
                  <div className="border-t border-slate-200 px-5 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => goToHistoryPage(currentHistoryPage - 1)}
                        disabled={currentHistoryPage === 1}
                        className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {text.previousPage}
                      </button>

                      {Array.from(
                        { length: historyTotalPages },
                        (_, index) => index + 1,
                      ).map((pageNumber) => {
                        const active = pageNumber === currentHistoryPage;

                        return (
                          <button
                            key={pageNumber}
                            type="button"
                            onClick={() => goToHistoryPage(pageNumber)}
                            className={`inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border px-3 text-sm transition ${
                              active
                                ? "border-slate-300 bg-slate-100 text-slate-900"
                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            {pageNumber}
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => goToHistoryPage(currentHistoryPage + 1)}
                        disabled={currentHistoryPage === historyTotalPages}
                        className="inline-flex h-9 min-w-[40px] items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {text.nextPage}
                      </button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </section>
      {modal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-[760px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex justify-center">
                <h3 className="text-center text-base font-semibold text-slate-900">
                  {modal.title}
                </h3>
              </div>
            </div>

            <div className="px-5 py-5">
              {modal.kind === "success" && modal.mode === "validate" ? (
                <div className="grid gap-3 md:grid-cols-4">
                  {modal.lines.map((line, index) => {
                    const [label, value] = line.split("：");
                    return (
                      <div
                        key={`${line}-${index}`}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4"
                      >
                        <div className="text-sm text-emerald-700">{label}</div>
                        <div className="mt-2 text-2xl font-semibold text-emerald-800">
                          {value || "-"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {modal.kind === "success" && modal.mode === "import" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="text-sm text-slate-500">
                        {text.receiptCount}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">
                        {importSummary?.receiptCount ?? "-"}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="text-sm text-slate-500">
                        {text.supplierCount}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">
                        {importSummary?.supplierCount ?? "-"}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="text-sm text-slate-500">
                        {text.skuCount}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">
                        {importSummary?.skuCount ?? "-"}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="text-sm text-slate-500">
                        {text.totalExpectedQty}
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">
                        {importSummary?.totalExpectedQty ?? "-"}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 lg:flex-row lg:items-center lg:justify-between">
                    <div>{text.importDone}</div>
                    <Link
                      href="/receipts"
                      className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-95"
                    >
                      {text.goReceipts}
                    </Link>
                  </div>
                </div>
              ) : null}

              {modal.kind === "error" ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  <div className="space-y-2">
                    {modal.lines.map((line, index) => (
                      <div key={`${line}-${index}`}>{line}</div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-slate-200 px-5 py-4">
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() =>
                    setModal({
                      open: false,
                      kind: "success",
                      mode: "validate",
                      title: "",
                      lines: [],
                    })
                  }
                  className="inline-flex h-10 min-w-[120px] items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-95"
                >
                  {text.close}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ImageLightbox
        open={previewImage.open}
        src={previewImage.src}
        title={previewImage.title}
        onClose={() =>
          setPreviewImage({
            open: false,
            src: "",
            title: "",
          })
        }
      />
    </div>
  );
}
