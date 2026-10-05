// @ts-nocheck
import { randomUUID } from "crypto";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { getLang } from "@/lib/i18n-server";
import { getReceiptScanStateById } from "@/lib/receipts/scan-state";
import { getSession } from "@/lib/tenant";
import { ScanClient } from "./ScanClient";

type ScanPageProps = {
  params: Promise<{
    id: string;
  }>;
};

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
          finishInspection: "验货完毕",
          finishingInspection: "处理中...",
          revokeFinishInspection: "撤销完成验货",
          revokingFinishInspection: "撤销中...",
          finishInspectionFailed: "暂时无法完成验货",
          revokeFinishInspectionFailed: "暂时无法撤销完成验货",
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
          supplierCasePack: "启用供应商中包数",
          supplierCasePackColumn: "供应商中包数",
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
          mobileScan: "手机扫码",
          mobileScanTitle: "手机扫码链接",
          mobileScanDesc: "分享到微信或让手机扫码二维码后，即可在手机上直接扫码验货。",
          mobileScanCopy: "复制链接",
          mobileScanCopied: "已复制",
          mobileScanOpen: "打开链接",
        }
      : {
          back: "Volver al detalle",
          uploadEvidence: "Subir evidencia",
          finishInspection: "Finalizar inspección",
          finishingInspection: "Procesando...",
          revokeFinishInspection: "Revertir finalización",
          revokingFinishInspection: "Revirtiendo...",
          finishInspectionFailed: "No se pudo finalizar la inspección",
          revokeFinishInspectionFailed: "No se pudo revertir la finalización",
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
          supplierCasePack: "Usar pack proveedor",
          supplierCasePackColumn: "Pack prov.",
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
          mobileScan: "Escaneo móvil",
          mobileScanTitle: "Enlace de escaneo móvil",
          mobileScanDesc: "Comparte este enlace por WeChat o abre el código QR en el teléfono para escanear desde el móvil.",
          mobileScanCopy: "Copiar enlace",
          mobileScanCopied: "Copiado",
          mobileScanOpen: "Abrir enlace",
        };

  const receipt = await prisma.receipt.findFirst({
    where: {
      id,
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    select: {
      id: true,
      public_share_id: true,
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

  let publicShareId = receipt.public_share_id;
  if (!publicShareId) {
    publicShareId = randomUUID();
    await prisma.receipt.update({
      where: { id: receipt.id },
      data: { public_share_id: publicShareId },
    });
  }

  const scanState = await getReceiptScanStateById({
    receiptId: id,
    tenantId: session.tenantId,
    companyId: session.companyId,
    lang,
  });

  if (!scanState) {
    notFound();
  }

  return (
    <AppShell>
      <ScanClient
        receiptId={scanState.receiptId}
        receiptNo={scanState.receiptNo}
        receiptStatus={scanState.receiptStatus}
        receiptLocked={scanState.receiptLocked}
        supplierName={scanState.supplierName || text.noSupplier}
        uploadedAtText={scanState.uploadedAtText}
        inspectedAtText={scanState.inspectedAtText}
        backHref={`/receipts/${scanState.receiptId}`}
        rows={scanState.rows}
        initialSummary={scanState.summary}
        stateEndpoint={`/api/receipts/${scanState.receiptId}/scan-state`}
        mobileSharePath={`/public/receipts/${publicShareId}/scan`}
        text={text}
      />
    </AppShell>
  );
}
