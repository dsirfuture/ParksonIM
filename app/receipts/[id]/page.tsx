// @ts-nocheck
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { AppShell } from "@/components/app-shell";
import { getLang } from "@/lib/i18n-server";
import { ReceiptItemsClient } from "./ReceiptItemsClient";
import { ReceiptSummaryCardsClient } from "./ReceiptSummaryCardsClient";
import { EvidencePreviewButton } from "./EvidencePreviewButton";
import { ExportFilesButton } from "./ExportFilesButton";
import { SpecialSettingsButton } from "./SpecialSettingsButton";

type ReceiptDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
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

function toEditPercent(value: unknown) {
  const num = toNumber(value);
  if (num === null) return null;
  return num <= 1 ? num * 100 : num;
}

export default async function ReceiptDetailPage({
  params,
  searchParams,
}: ReceiptDetailPageProps) {
  const { id } = await params;
  const query = (await searchParams) || {};
  const filterParamRaw = Array.isArray(query.filter) ? query.filter[0] : query.filter;
  const activeFilter: "all" | "diffQty" | "uncheckedQty" =
    filterParamRaw === "diffQty" || filterParamRaw === "uncheckedQty" ? filterParamRaw : "all";
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
          delete: "删除",
          deleteTitle: "删除商品明细",
          deleteConfirm: "确认删除这条商品明细吗？",
          deleteHint: "删除后，该商品将不会再计入验货汇总、导出文件和相关财务账单。",
          deleteAction: "确认删除",
          deleting: "删除中...",
          deleteFailed: "删除失败",
          editTitle: "编辑商品明细",
          cancel: "取消",
          save: "保存",
          saving: "保存中...",
          saveSuccess: "保存成功",
          saveFailed: "保存失败",
          specialSettings: "特殊设置",
          specialSettingsTitle: "特殊设置（已完成验货单）",
          specialSettingsSave: "保存修改",
          specialSettingsSaving: "保存中...",
          specialSettingsDisabled: "仅已完成验货单可使用特殊设置",
          specialSettingsSuccess: "特殊设置已保存，账单统计将自动使用新数据",
          specialSettingsFailed: "特殊设置保存失败",
          addGoodQty: "良品新调整",
          checkedGoodQty: "已验良品",
          loginNameLabel: "登录名",
          receiptNoLabel: "完整验货单号",
          remarkLabel: "备注",
          loginNamePlaceholder: "请输入登录名",
          receiptNoPlaceholder: "请输入完整验货单号",
          remarkPlaceholder: "请输入备注",
          requiredValidationText: "请完整填写：登录名、完整验货单号、备注",
          receiptNoMismatchText: "完整验货单号不匹配",
          loginNameMismatchText: "登录名不匹配",
          notFound: "未找到对应验货单，或该单据不属于当前公司。",
          imagePreviewTitle: "商品图片预览",
          emptyImage: "空",
          newTag: "新",
          specialNoRows: "当前无可调整商品",
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
          delete: "Eliminar",
          deleteTitle: "Eliminar artículo",
          deleteConfirm: "¿Confirmas eliminar este artículo?",
          deleteHint:
            "Después de eliminarlo, ya no contará en los resúmenes, exportaciones ni facturación relacionada.",
          deleteAction: "Eliminar",
          deleting: "Eliminando...",
          deleteFailed: "No se pudo eliminar",
          editTitle: "Editar artículo",
          cancel: "Cerrar",
          save: "Guardar",
          saving: "Guardando...",
          saveSuccess: "Guardado correctamente",
          saveFailed: "Error al guardar",
          specialSettings: "Ajuste especial",
          specialSettingsTitle: "Ajuste especial (recepción completada)",
          specialSettingsSave: "Guardar",
          specialSettingsSaving: "Guardando...",
          specialSettingsDisabled:
            "Solo disponible para recepciones completadas",
          specialSettingsSuccess:
            "Se guardó. La facturación usará los nuevos datos automáticamente.",
          specialSettingsFailed: "No se pudo guardar",
          addGoodQty: "Ajuste buenas",
          checkedGoodQty: "Buenas verificadas",
          loginNameLabel: "Usuario",
          receiptNoLabel: "No. recepción completo",
          remarkLabel: "Nota",
          loginNamePlaceholder: "Ingresa usuario",
          receiptNoPlaceholder: "Ingresa no. completo",
          remarkPlaceholder: "Ingresa nota",
          requiredValidationText:
            "Completa usuario, no. de recepción y nota.",
          receiptNoMismatchText: "El no. de recepción no coincide",
          loginNameMismatchText: "El usuario no coincide",
          notFound:
            "No se encontró la recepción o no pertenece a la compañía actual.",
          imagePreviewTitle: "Vista de imagen",
          emptyImage: "Vacío",
          newTag: "Nuevo",
          specialNoRows: "No hay artículos ajustables",
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

  const skuSet = new Set(
    receipt.items.map((item) => String(item.sku || "").trim()).filter(Boolean),
  );
  const yogoPriceRows =
    skuSet.size > 0
      ? await prisma.yogoProductSource.findMany({
          where: {
            tenant_id: session.tenantId,
            company_id: session.companyId,
            product_code: { in: Array.from(skuSet) },
          },
        select: {
          product_code: true,
          product_no: true,
          name_cn: true,
          name_es: true,
          case_pack: true,
          source_price: true,
          updated_at: true,
        },
          orderBy: [{ updated_at: "desc" }],
        })
      : [];
  const yogoPriceBySku = new Map<string, number | null>();
  const yogoInfoBySku = new Map<
    string,
    { productNo: string | null; nameCn: string | null; nameEs: string | null; casePack: number | null }
  >();
  for (const row of yogoPriceRows) {
    const key = String(row.product_code || "").trim().toUpperCase();
    if (!key || yogoPriceBySku.has(key)) continue;
    yogoPriceBySku.set(key, toNumber(row.source_price));
    yogoInfoBySku.set(key, {
      productNo: row.product_no ? String(row.product_no).trim() : null,
      nameCn: row.name_cn ? String(row.name_cn).trim() : null,
      nameEs: row.name_es ? String(row.name_es).trim() : null,
      casePack: toNumber(row.case_pack),
    });
  }

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

    const yogoPriceValue =
      yogoPriceBySku.get(String(item.sku || "").trim().toUpperCase()) ?? null;
    const yogoInfo =
      yogoInfoBySku.get(String(item.sku || "").trim().toUpperCase()) ?? null;
    const hasComparablePrice =
      unitPriceValue !== null && yogoPriceValue !== null;
    const priceCompareStatus: "unknown" | "same" | "different" = !hasComparablePrice
      ? "unknown"
      : Math.abs(unitPriceValue - yogoPriceValue) < 0.0001
        ? "same"
        : "different";
    const priceCompareText =
      priceCompareStatus === "same"
        ? lang === "zh"
          ? "一致"
          : "Igual"
        : priceCompareStatus === "different"
          ? lang === "zh"
            ? "不同"
            : "Distinto"
          : text.noValue;

    return {
      id: item.id,
      sku: item.sku || "",
      barcode: item.barcode || yogoInfo?.productNo || "",
      nameZh: item.name_zh || yogoInfo?.nameCn || "",
      nameEs: item.name_es || yogoInfo?.nameEs || "",
      casePack: toNumber(item.case_pack) ?? yogoInfo?.casePack ?? null,
      expectedQty,
      goodQty,
      diffQty,
      uncheckedQty,
      damagedQty,
      excessQty,
      status: (item.status as ItemStatus) || "pending",
      unexpected: item.unexpected,
      unitPriceValue,
      yogoPriceValue,
      normalDiscountValue,
      vipDiscountValue,
      unitPriceText: formatMoney(unitPriceValue),
      yogoPriceText: formatMoney(yogoPriceValue),
      priceCompareStatus,
      priceCompareText,
    };
  });

  const filteredItemRows =
    activeFilter === "diffQty"
      ? itemRows.filter((item) => item.diffQty > 0)
      : activeFilter === "uncheckedQty"
        ? itemRows.filter((item) => item.uncheckedQty > 0)
        : itemRows;

  const summaryCards = [
    { key: "all", label: text.totalSku, value: totalSku, valueClassName: "text-slate-900", clickable: false },
    {
      key: "all",
      label: text.expectedQty,
      value: expectedQtyTotal,
      valueClassName: "text-slate-900",
      clickable: false,
    },
    {
      key: "all",
      label: text.goodQty,
      value: goodQtyTotal,
      valueClassName: "text-slate-900",
      clickable: false,
    },
    {
      key: "diffQty",
      label: text.diffQty,
      value: diffQtyTotal,
      valueClassName: diffQtyTotal > 0 ? "text-rose-600" : "text-slate-900",
      clickable: diffQtyTotal > 0,
    },
    {
      key: "uncheckedQty",
      label: text.uncheckedQty,
      value: uncheckedQtyTotal,
      valueClassName:
        uncheckedQtyTotal > 0 ? "text-rose-600" : "text-slate-900",
      clickable: uncheckedQtyTotal > 0,
    },
    {
      key: "all",
      label: text.damagedQty,
      value: damagedQtyTotal,
      valueClassName: damagedQtyTotal > 0 ? "text-rose-600" : "text-slate-900",
      clickable: false,
    },
    {
      key: "all",
      label: text.excessQty,
      value: excessQtyTotal,
      valueClassName: excessQtyTotal > 0 ? "text-rose-600" : "text-slate-900",
      clickable: false,
    },
    {
      key: "all",
      label: text.addedQty,
      value: addedCount,
      valueClassName: addedCount > 0 ? "text-rose-600" : "text-slate-900",
      clickable: false,
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
            <SpecialSettingsButton
              receiptId={receipt.id}
              receiptNo={receipt.receipt_no || ""}
              currentLoginName={session.name || ""}
              rows={itemRows.map((item) => ({
                id: item.id,
                sku: item.sku,
                nameZh: item.nameZh,
                nameEs: item.nameEs,
                expectedQty: item.expectedQty,
                goodQty: item.goodQty,
                unexpected: item.unexpected,
              }))}
              disabled={receipt.status !== "completed"}
              buttonText={text.specialSettings}
              titleText={text.specialSettingsTitle}
              saveText={text.specialSettingsSave}
              cancelText={text.cancel}
              savingText={text.specialSettingsSaving}
              disabledHintText={text.specialSettingsDisabled}
              successText={text.specialSettingsSuccess}
              failText={text.specialSettingsFailed}
              expectedQtyText={text.expectedQtyCol}
              goodQtyText={text.checkedGoodQty}
              addGoodQtyText={text.addGoodQty}
              skuText={text.sku}
              nameText={text.nameZh}
              noRowsText={text.specialNoRows}
              loginNameLabel={text.loginNameLabel}
              receiptNoLabel={text.receiptNoLabel}
              remarkLabel={text.remarkLabel}
              loginNamePlaceholder={text.loginNamePlaceholder}
              receiptNoPlaceholder={text.receiptNoPlaceholder}
              remarkPlaceholder={text.remarkPlaceholder}
              requiredValidationText={text.requiredValidationText}
              receiptNoMismatchText={text.receiptNoMismatchText}
              loginNameMismatchText={text.loginNameMismatchText}
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

        <ReceiptSummaryCardsClient
          activeFilter={activeFilter}
          items={summaryCards}
        />

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
        {filteredItemRows.length === 0 ? (
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
            rows={filteredItemRows}
            activeFilterLabel={
              activeFilter === "diffQty"
                ? text.diffQty
                : activeFilter === "uncheckedQty"
                  ? text.uncheckedQty
                  : null
            }
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
              unitPrice: lang === "zh" ? "供应价" : "Precio proveedor",
              yogoPrice: lang === "zh" ? "友购价" : "Precio YOGO",
              priceCompare: lang === "zh" ? "价格对比" : "Comparación",
              same: lang === "zh" ? "一致" : "Igual",
              different: lang === "zh" ? "不同" : "Distinto",
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
              delete: text.delete,
              deleteTitle: text.deleteTitle,
              deleteConfirm: text.deleteConfirm,
              deleteHint: text.deleteHint,
              deleteAction: text.deleteAction,
              deleting: text.deleting,
              deleteFailed: text.deleteFailed,
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
