import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { AppShell } from "@/components/app-shell";
import { getLang } from "@/lib/i18n-server";
import { ReceiptItemsClient } from "./ReceiptItemsClient";
import { EvidencePreviewButton } from "./EvidencePreviewButton";
import { ExportFilesButton } from "./ExportFilesButton";

type ReceiptDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type ItemStatus = "pending" | "in_progress" | "completed";

function formatTime(
  value: Date | string | null | undefined,
  lang: "zh" | "es",
) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

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

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "-";
  return `$${value.toFixed(2)}`;
}

function formatDiscountPercent(value: unknown) {
  const num = toNumber(value);
  if (num === null) return null;

  const percent = num <= 1 ? num * 100 : num;
  const rounded = Number.isInteger(percent)
    ? String(percent)
    : percent.toFixed(2).replace(/\.?0+$/, "");

  return `${rounded}%`;
}

function toEditPercent(value: unknown) {
  const num = toNumber(value);
  if (num === null) return null;
  return num <= 1 ? num * 100 : num;
}

function computeLineTotal(
  goodQty: number,
  unitPrice: number | null,
  normalDiscount: number | null,
  vipDiscount: number | null,
) {
  if (unitPrice === null || !Number.isFinite(unitPrice)) return null;

  let factor = 1;

  if (normalDiscount !== null && Number.isFinite(normalDiscount)) {
    factor *= 1 - (normalDiscount <= 1 ? normalDiscount : normalDiscount / 100);
  }

  if (vipDiscount !== null && Number.isFinite(vipDiscount)) {
    factor *= 1 - (vipDiscount <= 1 ? vipDiscount : vipDiscount / 100);
  }

  return round2(goodQty * unitPrice * factor);
}

export default async function ReceiptDetailPage({
  params,
}: ReceiptDetailPageProps) {
  const { id } = await params;
  const session = await getSession();
  const lang = await getLang();

  if (!session) {
    notFound();
  }

  const text =
    lang === "zh"
      ? {
          back: "返回验货单列表",
          scan: "去扫码",
          previewEvidence: "证据图片预览",
          evidenceTitle: "证据图片预览",
          noEvidence: "暂无证据图片",
          supplier: "供应商",
          uploadedAt: "文件上传时间",
          inspectedAt: "验货时间",
          totalSku: "SKU",
          addedQty: "新增",
          expectedQty: "应验",
          goodQty: "良品",
          diffQty: "相差",
          uncheckedQty: "未验",
          damagedQty: "破损",
          excessQty: "超收",
          itemListTitle: "商品明细",
          currencyHint: "货币单位是墨西哥比索",
          searchPlaceholder: "搜索 SKU、条码、中文名、西文名",
          noSupplier: "未填写",
          noValue: "-",
          image: "图片",
          sku: "SKU",
          barcode: "条码",
          nameZh: "中文名",
          nameEs: "西文名",
          casePack: "包装数",
          expectedQtyCol: "应验",
          goodQtyCol: "良品",
          diffQtyCol: "相差",
          uncheckedQtyCol: "未验",
          damagedQtyCol: "破损",
          excessQtyCol: "超收",
          status: "状态",
          pending: "待验货",
          inProgress: "验货中",
          completed: "已完成",
          unitPrice: "单价",
          normalDiscount: "普通折扣",
          vipDiscount: "VIP折扣",
          lineTotal: "金额",
          noItems: "当前验货单暂无明细",
          noMatch: "无匹配结果",
          previousPage: "上一页",
          nextPage: "下一页",
          edit: "编辑",
          editTitle: "编辑商品明细",
          cancel: "取消",
          save: "保存",
          saving: "保存中...",
          saveSuccess: "保存成功",
          saveFailed: "保存失败",
          notFound: "未找到对应验货单，或该单据不属于当前公司。",
          imagePreviewTitle: "商品图片预览",
          emptyImage: "空",
          newTag: "新",
        }
      : {
          back: "Volver a recepciones",
          scan: "Escanear",
          previewEvidence: "Ver evidencias",
          evidenceTitle: "Vista de evidencias",
          noEvidence: "No hay imágenes de evidencia",
          supplier: "Prov.",
          uploadedAt: "Carga",
          inspectedAt: "Inspección",
          totalSku: "SKU",
          addedQty: "Nuevos",
          expectedQty: "Cant. esp.",
          goodQty: "Buenas",
          diffQty: "Dif.",
          uncheckedQty: "Pend.",
          damagedQty: "Dañadas",
          excessQty: "Extra",
          itemListTitle: "Artículos",
          currencyHint: "Moneda: peso mexicano",
          searchPlaceholder: "Buscar SKU, código, nombre CN, nombre ES",
          noSupplier: "Sin proveedor",
          noValue: "-",
          image: "Img.",
          sku: "SKU",
          barcode: "Código",
          nameZh: "CN",
          nameEs: "ES",
          casePack: "Pack",
          expectedQtyCol: "Esp.",
          goodQtyCol: "Buenas",
          diffQtyCol: "Dif.",
          uncheckedQtyCol: "Pend.",
          damagedQtyCol: "Dañ.",
          excessQtyCol: "Extra",
          status: "Estado",
          pending: "Pendiente",
          inProgress: "En proceso",
          completed: "Completado",
          unitPrice: "Precio",
          normalDiscount: "Desc.",
          vipDiscount: "VIP",
          lineTotal: "Importe",
          noItems: "No hay artículos en esta recepción",
          noMatch: "Sin resultados",
          previousPage: "Anterior",
          nextPage: "Siguiente",
          edit: "Editar",
          editTitle: "Editar artículo",
          cancel: "Cerrar",
          save: "Guardar",
          saving: "Guardando...",
          saveSuccess: "Guardado correctamente",
          saveFailed: "Error al guardar",
          notFound:
            "No se encontró la recepción o no pertenece a la compañía actual.",
          imagePreviewTitle: "Vista de imagen",
          emptyImage: "Vacío",
          newTag: "Nuevo",
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
          status: true,
          unexpected: true,
          sell_price: true,
          normal_discount: true,
          vip_discount: true,
          created_at: true,
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
        <div className="rounded-xl border border-amber-200 bg-white p-5 shadow-soft">
          <p className="text-sm text-amber-700">{text.notFound}</p>
          <div className="mt-4">
            <Link
              href="/receipts"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {text.back}
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const importedItems = receipt.items.filter((item) => !item.unexpected);
  const addedCount = receipt.items.filter((item) => item.unexpected).length;

  const totalSku = importedItems.length;

  const expectedQtyTotal = importedItems.reduce(
    (sum, item) => sum + (item.expected_qty ?? 0),
    0,
  );

  const goodQtyTotal = importedItems.reduce(
    (sum, item) => sum + (item.good_qty ?? 0),
    0,
  );

  const damagedQtyTotal = importedItems.reduce(
    (sum, item) => sum + (item.damaged_qty ?? 0),
    0,
  );

  const excessQtyTotal = importedItems.reduce(
    (sum, item) => sum + (item.excess_qty ?? 0),
    0,
  );

  const checkedQtyTotal = goodQtyTotal + damagedQtyTotal;
  const hasRealScanData = importedItems.some(
    (item) =>
      (item.good_qty ?? 0) > 0 ||
      (item.damaged_qty ?? 0) > 0 ||
      (item.excess_qty ?? 0) > 0,
  );

  const uncheckedQtyTotal = hasRealScanData
    ? Math.max(expectedQtyTotal - checkedQtyTotal, 0)
    : 0;
  const diffQtyTotal = hasRealScanData ? uncheckedQtyTotal : 0;

  const progress =
    expectedQtyTotal > 0
      ? Math.max(
          0,
          Math.min(100, Math.round((checkedQtyTotal / expectedQtyTotal) * 100)),
        )
      : 0;

  const itemRows = receipt.items.map((item) => {
    const unitPriceValue = toNumber(item.sell_price);
    const normalDiscountValue = toEditPercent(item.normal_discount);
    const vipDiscountValue = toEditPercent(item.vip_discount);

    const expectedQty = toNumber(item.expected_qty);
    const goodQty = item.unexpected ? 0 : (item.good_qty ?? 0);
    const damagedQty = item.unexpected ? 0 : (item.damaged_qty ?? 0);
    const excessQty = item.unexpected ? 0 : (item.excess_qty ?? 0);

    const checkedQty = Math.min(
      goodQty + damagedQty,
      item.unexpected ? 0 : (item.expected_qty ?? 0),
    );
    const diffQty = item.unexpected
      ? 0
      : hasRealScanData
      ? Math.max((item.expected_qty ?? 0) - checkedQty, 0)
      : 0;
    const uncheckedQty = item.unexpected ? 0 : diffQty;

    const calculatedLineTotal = item.unexpected
      ? null
      : computeLineTotal(
          goodQty,
          unitPriceValue,
          toNumber(item.normal_discount),
          toNumber(item.vip_discount),
        );

    return {
      id: item.id,
      sku: item.sku || "",
      barcode: item.barcode || "",
      nameZh: item.name_zh || "",
      nameEs: item.name_es || "",
      casePack: toNumber(item.case_pack),
      expectedQty,
      goodQty,
      diffQty,
      uncheckedQty,
      damagedQty,
      excessQty,
      status: (item.status as ItemStatus) || "pending",
      unexpected: item.unexpected,
      unitPriceValue,
      normalDiscountValue,
      vipDiscountValue,
      unitPriceText: formatMoney(unitPriceValue),
      normalDiscountText: formatDiscountPercent(item.normal_discount),
      vipDiscountText: formatDiscountPercent(item.vip_discount),
      lineTotalText: item.unexpected
        ? text.noValue
        : formatMoney(calculatedLineTotal),
    };
  });

  const summaryCards = [
    { label: text.totalSku, value: totalSku, valueClassName: "text-slate-900" },
    {
      label: text.expectedQty,
      value: expectedQtyTotal,
      valueClassName: "text-slate-900",
    },
    {
      label: text.goodQty,
      value: goodQtyTotal,
      valueClassName: "text-slate-900",
    },
    {
      label: text.diffQty,
      value: diffQtyTotal,
      valueClassName: diffQtyTotal > 0 ? "text-rose-600" : "text-slate-900",
    },
    {
      label: text.uncheckedQty,
      value: uncheckedQtyTotal,
      valueClassName:
        uncheckedQtyTotal > 0 ? "text-rose-600" : "text-slate-900",
    },
    {
      label: text.damagedQty,
      value: damagedQtyTotal,
      valueClassName: damagedQtyTotal > 0 ? "text-rose-600" : "text-slate-900",
    },
    {
      label: text.excessQty,
      value: excessQtyTotal,
      valueClassName: excessQtyTotal > 0 ? "text-rose-600" : "text-slate-900",
    },
    {
      label: text.addedQty,
      value: addedCount,
      valueClassName: addedCount > 0 ? "text-rose-600" : "text-slate-900",
    },
  ];

  return (
    <AppShell>
      <section className="rounded-[20px] bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="min-w-0">
            <div className="text-[18px] font-bold tracking-tight text-slate-950 xl:text-[20px]">
              {receipt.receipt_no}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
              <span>
                {text.supplier}：{receipt.supplier_name || text.noSupplier}
              </span>
              <span>
                {text.uploadedAt}：{formatTime(receipt.created_at, lang)}
              </span>
              <span>
                {text.inspectedAt}：{formatTime(receipt.last_activity_at, lang)}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <ExportFilesButton
              receiptId={receipt.id}
              buttonText={lang === "zh" ? "导出文件" : "Exportar"}
              exportExcelText={lang === "zh" ? "导出表格" : "Exportar Excel"}
              exportPdfText={lang === "zh" ? "导出 PDF" : "Exportar PDF"}
              cancelText={lang === "zh" ? "关闭" : "Cerrar"}
            />

            <EvidencePreviewButton
              receiptId={receipt.id}
              buttonText={text.previewEvidence}
              titleText={text.evidenceTitle}
              emptyText={text.noEvidence}
              closeText={text.cancel}
            />

            <Link
              href="/receipts"
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {text.back}
            </Link>

            <Link
              href={`/receipts/${receipt.id}/scan`}
              className="inline-flex h-10 items-center justify-center rounded-2xl bg-primary px-5 text-sm font-semibold text-white shadow-soft transition hover:opacity-95"
            >
              {text.scan}
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-8">
          {summaryCards.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4"
            >
              <div className="text-sm text-slate-500">{item.label}</div>
              <div
                className={`mt-2 text-[18px] font-bold leading-none ${item.valueClassName}`}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-4">
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="w-12 text-right text-sm font-semibold text-slate-700">
            {progress}%
          </div>
        </div>
      </section>

      <div className="mt-3">
        {itemRows.length === 0 ? (
          <section className="overflow-hidden rounded-xl bg-white shadow-soft">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="text-[18px] font-bold tracking-tight text-slate-900">
                {text.itemListTitle}
              </div>
            </div>
            <div className="px-5 py-10 text-sm text-slate-500">
              {text.noItems}
            </div>
          </section>
        ) : (
          <ReceiptItemsClient
            title={text.itemListTitle}
            currencyHint={text.currencyHint}
            rows={itemRows}
            text={{
              image: text.image,
              sku: text.sku,
              barcode: text.barcode,
              nameZh: text.nameZh,
              nameEs: text.nameEs,
              casePack: text.casePack,
              expectedQty: text.expectedQtyCol,
              goodQty: text.goodQtyCol,
              diffQty: text.diffQtyCol,
              uncheckedQty: text.uncheckedQtyCol,
              damagedQty: text.damagedQtyCol,
              excessQty: text.excessQtyCol,
              status: text.status,
              pending: text.pending,
              inProgress: text.inProgress,
              completed: text.completed,
              unitPrice: text.unitPrice,
              normalDiscount: text.normalDiscount,
              vipDiscount: text.vipDiscount,
              lineTotal: text.lineTotal,
              noValue: text.noValue,
              imagePreviewTitle: text.imagePreviewTitle,
              searchPlaceholder: text.searchPlaceholder,
              noMatch: text.noMatch,
              previousPage: text.previousPage,
              nextPage: text.nextPage,
              edit: text.edit,
              editTitle: text.editTitle,
              cancel: text.cancel,
              save: text.save,
              saving: text.saving,
              saveSuccess: text.saveSuccess,
              saveFailed: text.saveFailed,
              emptyImage: text.emptyImage,
              newTag: text.newTag,
            }}
          />
        )}
      </div>
    </AppShell>
  );
}
