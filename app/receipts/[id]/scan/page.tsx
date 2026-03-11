import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { getLang } from "@/lib/i18n-server";
import { getSession } from "@/lib/tenant";
import { ScanClient } from "./ScanClient";

type ScanPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  ) {
    try {
      return (value as { toNumber: () => number }).toNumber();
    } catch {
      return null;
    }
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatTime(
  value: Date | string | null | undefined,
  lang: "zh" | "es",
) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

type ItemRow = {
  id: string;
  sku: string;
  barcode: string;
  nameZh: string;
  nameEs: string;
  casePack: number | null;
  expectedQty: number | null;
  goodQty: number;
  damagedQty: number;
  excessQty: number;
  diffQty: number;
  uncheckedQty: number;
  status: "pending" | "in_progress" | "completed";
  updatedAtText: string;
  createdAt: string;
  unexpected?: boolean;
};

function buildSummary(rows: ItemRow[]) {
  const importedRows = rows.filter((row) => !row.unexpected);
  const addedCount = rows.filter((row) => row.unexpected).length;

  const totalSku = importedRows.length;
  const expectedQtyTotal = importedRows.reduce(
    (sum, item) => sum + (item.expectedQty ?? 0),
    0,
  );
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

export default async function ReceiptScanPage({ params }: ScanPageProps) {
  const { id } = await params;
  const session = await getSession();
  const lang = await getLang();

  if (!session) {
    notFound();
  }

  const text =
    lang === "zh"
      ? {
          back: "返回详情页",
          uploadEvidence: "上传证据",
          supplier: "供应商",
          uploadedAt: "文件上传时间",
          inspectedAt: "验货时间",
          noSupplier: "未填写",
          notFound: "未找到对应验货单，或该单据不属于当前公司。",
          image: "图片",
          sku: "SKU",
          barcode: "条码",
          nameZh: "中文名",
          nameEs: "西文名",
          casePack: "包装数",
          expectedQty: "应验",
          goodQty: "良品",
          damagedQty: "破损",
          diffQty: "相差",
          uncheckedQty: "未验",
          excessQty: "超收",
          addedQty: "新增",
          status: "状态",
          pending: "待验货",
          inProgress: "验货中",
          completed: "已完成",
          imagePreviewTitle: "商品图片预览",
          scanPlaceholder: "请扫码或输入 SKU / 条码",
          searchPlaceholder: "搜索 SKU、条码、中文名、西文名",
          noItems: "当前验货单暂无商品明细",
          noMatch: "没有匹配到相关商品",
          save: "保存",
          saving: "保存中...",
          editItem: "编辑",
          saveFailed: "保存失败",
          listTitle: "商品列表",
          editQtyTitle: "编辑数量",
          editItemTitle: "编辑商品",
          addItemTitle: "新增商品",
          cancel: "取消",
          damagedQtyInput: "破损",
          excessQtyInput: "超收",
          addUnknownTitle: "未找到条码",
          addUnknownDesc: "该条码不在当前验货单中，是否新增商品？",
          confirmYes: "是",
          confirmNo: "否",
          evidenceTitle: "上传证据",
          chooseImages: "选择图片",
          noEvidence: "暂未选择图片",
          emptyImage: "空",
        }
      : {
          back: "Volver al detalle",
          uploadEvidence: "Subir evidencia",
          supplier: "Proveedor",
          uploadedAt: "Hora de carga del archivo",
          inspectedAt: "Hora de inspección",
          noSupplier: "Sin proveedor",
          notFound:
            "No se encontró la recepción o no pertenece a la compañía actual.",
          image: "Imagen",
          sku: "SKU",
          barcode: "Código",
          nameZh: "Nombre CN",
          nameEs: "Nombre ES",
          casePack: "Pack",
          expectedQty: "Esp.",
          goodQty: "Buenas",
          damagedQty: "Daño",
          diffQty: "Dif.",
          uncheckedQty: "Pend.",
          excessQty: "Extra",
          addedQty: "Agregados",
          status: "Estado",
          pending: "Pendiente",
          inProgress: "En proceso",
          completed: "Completado",
          imagePreviewTitle: "Vista de imagen",
          scanPlaceholder: "Escanea o escribe SKU / código",
          searchPlaceholder: "Buscar SKU, código, nombre CN, nombre ES",
          noItems: "Esta recepción no tiene artículos",
          noMatch: "No se encontraron artículos",
          save: "Guardar",
          saving: "Guardando...",
          editItem: "Editar",
          saveFailed: "Error al guardar",
          listTitle: "Lista de artículos",
          editQtyTitle: "Editar cantidades",
          editItemTitle: "Editar artículo",
          addItemTitle: "Agregar artículo",
          cancel: "Cancelar",
          damagedQtyInput: "Daño",
          excessQtyInput: "Extra",
          addUnknownTitle: "Código no encontrado",
          addUnknownDesc:
            "Este código no está en la recepción actual. ¿Deseas agregar el artículo?",
          confirmYes: "Sí",
          confirmNo: "No",
          evidenceTitle: "Subir evidencia",
          chooseImages: "Elegir imágenes",
          noEvidence: "No hay imágenes seleccionadas",
          emptyImage: "Vacío",
        };

  const receipt = await prisma.receipt.findFirst({
    where: {
      id,
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    include: {
      items: {
        select: {
          id: true,
          sku: true,
          barcode: true,
          name_zh: true,
          name_es: true,
          case_pack: true,
          expected_qty: true,
          good_qty: true,
          damaged_qty: true,
          excess_qty: true,
          updated_at: true,
          status: true,
          created_at: true,
          unexpected: true,
        },
        orderBy: {
          created_at: "asc",
        },
      },
    },
  });

  if (!receipt) {
    return (
      <AppShell>
        <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-soft">
          <p className="text-sm text-amber-700">{text.notFound}</p>
        </section>
      </AppShell>
    );
  }

  const itemRows: ItemRow[] = receipt.items.map((item) => {
    const expectedQty = item.expected_qty ?? 0;
    const goodQty = item.unexpected ? 0 : (item.good_qty ?? 0);
    const damagedQty = item.unexpected ? 0 : (item.damaged_qty ?? 0);
    const excessQty = item.unexpected ? 0 : (item.excess_qty ?? 0);

    const checkedQty = Math.min(goodQty + damagedQty, expectedQty);
    const diffQty = item.unexpected ? 0 : Math.max(expectedQty - checkedQty, 0);
    const uncheckedQty = item.unexpected ? 0 : diffQty;

    return {
      id: item.id,
      sku: item.sku || "",
      barcode: item.barcode || "",
      nameZh: item.name_zh || "",
      nameEs: item.name_es || "",
      casePack: toNumber(item.case_pack),
      expectedQty: toNumber(item.expected_qty),
      goodQty,
      damagedQty,
      excessQty,
      diffQty,
      uncheckedQty,
      status: item.status,
      updatedAtText: formatTime(item.updated_at, lang),
      createdAt: item.created_at.toISOString(),
      unexpected: item.unexpected,
    };
  });

  const summary = buildSummary(itemRows);

  return (
    <AppShell>
      <ScanClient
        receiptId={receipt.id}
        receiptNo={receipt.receipt_no}
        supplierName={receipt.supplier_name || text.noSupplier}
        uploadedAtText={formatTime(receipt.created_at, lang)}
        inspectedAtText={formatTime(receipt.last_activity_at, lang)}
        backHref={`/receipts/${receipt.id}`}
        rows={itemRows}
        initialSummary={summary}
        text={text}
      />
    </AppShell>
  );
}
