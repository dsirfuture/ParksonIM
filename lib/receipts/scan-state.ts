import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { getMobileReceiptI18n } from "@/lib/mobile-receipt-i18n";

export type ReceiptScanItemStatus = "pending" | "in_progress" | "completed";

export type ReceiptScanItemRow = {
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
  status: ReceiptScanItemStatus;
  updatedAtText: string;
  createdAt: string;
  unexpected?: boolean;
};

export type ReceiptScanSummaryState = {
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

export type ReceiptScanStatePayload = {
  receiptId: string;
  receiptNo: string;
  receiptStatus: ReceiptScanItemStatus;
  receiptLocked: boolean;
  supplierName: string;
  uploadedAtText: string;
  inspectedAtText: string;
  rows: ReceiptScanItemRow[];
  summary: ReceiptScanSummaryState;
  nextReceipt: {
    publicShareId: string;
    supplierName: string;
    receiptNo: string;
  } | null;
};

async function resolveNextReceipt(params: {
  receiptId: string;
  receiptNo: string;
  supplierName: string | null;
  tenantId: string;
  companyId: string;
  lang: "zh" | "es";
}) {
  const currentSupplier = String(params.supplierName || "").trim();
  const nextReceipt = await prisma.receipt.findFirst({
    where: {
      id: { not: params.receiptId },
      receipt_no: params.receiptNo,
      tenant_id: params.tenantId,
      company_id: params.companyId,
      supplier_name: currentSupplier
        ? {
            not: currentSupplier,
          }
        : undefined,
      OR: [{ status: "pending" }, { status: "in_progress" }, { locked: false }],
    },
    select: {
      id: true,
      receipt_no: true,
      supplier_name: true,
      public_share_id: true,
      created_at: true,
    },
    orderBy: [{ created_at: "asc" }],
  });

  if (!nextReceipt) return null;

  let publicShareId = nextReceipt.public_share_id;
  if (!publicShareId) {
    publicShareId = randomUUID();
    await prisma.receipt.update({
      where: { id: nextReceipt.id },
      data: { public_share_id: publicShareId },
    });
  }

  return {
    publicShareId,
    supplierName:
      nextReceipt.supplier_name || getMobileReceiptI18n(params.lang).supplierFallback,
    receiptNo: nextReceipt.receipt_no,
  };
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

export function formatReceiptScanTime(
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
    timeZone: "America/Mexico_City",
  }).format(date);
}

export function buildReceiptScanSummary(rows: ReceiptScanItemRow[]): ReceiptScanSummaryState {
  const importedRows = rows.filter((row) => !row.unexpected);
  const addedCount = rows.filter((row) => row.unexpected).length;

  const totalSku = importedRows.length;
  const expectedQtyTotal = importedRows.reduce((sum, item) => sum + (item.expectedQty ?? 0), 0);
  const goodQtyTotal = importedRows.reduce((sum, item) => sum + item.goodQty, 0);
  const damagedQtyTotal = importedRows.reduce((sum, item) => sum + item.damagedQty, 0);
  const excessQtyTotal = importedRows.reduce((sum, item) => sum + item.excessQty, 0);

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

async function resolveSupplierCasePackMap(
  tenantId: string,
  companyId: string,
  supplierName: string | null | undefined,
  skuList: string[],
) {
  const normalizedSupplierName = String(supplierName || "").trim();
  if (!normalizedSupplierName || skuList.length === 0) {
    return new Map<string, number | null>();
  }

  const supplierProfile = await prisma.supplierProfile.findFirst({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      OR: [
        { short_name: normalizedSupplierName },
        { full_name: normalizedSupplierName },
      ],
    },
    select: {
      id: true,
    },
  });

  if (!supplierProfile) {
    return new Map<string, number | null>();
  }

  const supplierProducts = await prisma.supplierProductSource.findMany({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      supplier_profile_id: supplierProfile.id,
      sku: { in: skuList },
    },
    select: {
      sku: true,
      case_pack: true,
    },
  });

  return new Map(
    supplierProducts.map((item) => [item.sku, toNumber(item.case_pack)]),
  );
}

function mapReceiptItemsToRows(params: {
  items: Array<{
    id: string;
    sku: string | null;
    barcode: string | null;
    name_zh: string | null;
    name_es: string | null;
    case_pack: number | null;
    expected_qty: number | null;
    good_qty: number | null;
    damaged_qty: number | null;
    excess_qty: number | null;
    updated_at: Date;
    status: ReceiptScanItemStatus;
    created_at: Date;
    unexpected: boolean;
  }>;
  supplierCasePackMap: Map<string, number | null>;
  lang: "zh" | "es";
}) {
  return params.items.map((item) => {
    const expectedQty = item.expected_qty ?? 0;
    const goodQty = item.unexpected ? 0 : (item.good_qty ?? 0);
    const damagedQty = item.unexpected ? 0 : (item.damaged_qty ?? 0);
    const excessQty = item.unexpected ? 0 : (item.excess_qty ?? 0);

    const checkedQty = Math.min(goodQty + damagedQty, expectedQty);
    const remainingQty = Math.max(expectedQty - checkedQty, 0);
    const diffQty = item.unexpected ? 0 : remainingQty;
    const uncheckedQty = item.unexpected ? 0 : remainingQty;

    return {
      id: item.id,
      sku: item.sku || "",
      barcode: item.barcode || "",
      nameZh: item.name_zh || "",
      nameEs: item.name_es || "",
      casePack: toNumber(item.case_pack),
      supplierCasePack: params.supplierCasePackMap.get(item.sku || "") ?? null,
      expectedQty: toNumber(item.expected_qty),
      goodQty,
      damagedQty,
      excessQty,
      diffQty,
      uncheckedQty,
      status: item.status,
      updatedAtText: formatReceiptScanTime(item.updated_at, params.lang),
      createdAt: item.created_at.toISOString(),
      unexpected: item.unexpected,
    };
  });
}

async function buildReceiptScanState(params: {
  receipt: {
    id: string;
    receipt_no: string;
    supplier_name: string | null;
    status: ReceiptScanItemStatus;
    locked: boolean;
    last_activity_at: Date | null;
    created_at: Date;
    updated_at: Date;
    items: Array<{
      id: string;
      sku: string | null;
      barcode: string | null;
      name_zh: string | null;
      name_es: string | null;
      case_pack: number | null;
      expected_qty: number | null;
      good_qty: number | null;
      damaged_qty: number | null;
      excess_qty: number | null;
      updated_at: Date;
      status: ReceiptScanItemStatus;
      created_at: Date;
      unexpected: boolean;
    }>;
  };
  tenantId: string;
  companyId: string;
  lang: "zh" | "es";
}): Promise<ReceiptScanStatePayload> {
  const receiptSkuList = Array.from(
    new Set(
      params.receipt.items
        .map((item) => String(item.sku || "").trim())
        .filter(Boolean),
    ),
  );

  const supplierCasePackMap = await resolveSupplierCasePackMap(
    params.tenantId,
    params.companyId,
    params.receipt.supplier_name,
    receiptSkuList,
  );

  const rows = mapReceiptItemsToRows({
    items: params.receipt.items,
    supplierCasePackMap,
    lang: params.lang,
  });
  const summary = buildReceiptScanSummary(rows);

  const inspectedAt = (() => {
    const left = params.receipt.last_activity_at ? new Date(params.receipt.last_activity_at).getTime() : 0;
    const right = params.receipt.updated_at ? new Date(params.receipt.updated_at).getTime() : 0;
    return left >= right ? params.receipt.last_activity_at : params.receipt.updated_at;
  })();
  const nextReceipt = await resolveNextReceipt({
    receiptId: params.receipt.id,
    receiptNo: params.receipt.receipt_no,
    supplierName: params.receipt.supplier_name,
    tenantId: params.tenantId,
    companyId: params.companyId,
    lang: params.lang,
  });

  return {
    receiptId: params.receipt.id,
    receiptNo: params.receipt.receipt_no,
    receiptStatus: params.receipt.status,
    receiptLocked: params.receipt.locked,
    supplierName: params.receipt.supplier_name || getMobileReceiptI18n(params.lang).supplierFallback,
    uploadedAtText: formatReceiptScanTime(params.receipt.created_at, params.lang),
    inspectedAtText: formatReceiptScanTime(inspectedAt, params.lang),
    rows,
    summary,
    nextReceipt,
  };
}

export async function getReceiptScanStateById(params: {
  receiptId: string;
  tenantId: string;
  companyId: string;
  lang: "zh" | "es";
}) {
  const receipt = await prisma.receipt.findFirst({
    where: {
      id: params.receiptId,
      tenant_id: params.tenantId,
      company_id: params.companyId,
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

  if (!receipt) return null;

  return buildReceiptScanState({
    receipt,
    tenantId: params.tenantId,
    companyId: params.companyId,
    lang: params.lang,
  });
}

export async function getReceiptScanStateByPublicShareId(params: {
  publicShareId: string;
  lang: "zh" | "es";
}) {
  const receipt = await prisma.receipt.findFirst({
    where: {
      public_share_id: params.publicShareId,
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

  if (!receipt) return null;

  return buildReceiptScanState({
    receipt,
    tenantId: receipt.tenant_id,
    companyId: receipt.company_id,
    lang: params.lang,
  });
}
