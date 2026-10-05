import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getMobileReceiptI18n, resolveLang } from "@/lib/mobile-receipt-i18n";

const BodySchema = z.object({
  code: z.string().trim().min(1),
  useSupplierCasePack: z.boolean().optional(),
});

function normalizeCode(value: string) {
  return value.trim().toLowerCase();
}

async function resolveSupplierCasePack(
  tenantId: string,
  companyId: string,
  supplierName: string | null | undefined,
  sku: string | null | undefined,
) {
  const normalizedSupplierName = String(supplierName || "").trim();
  const normalizedSku = String(sku || "").trim();

  if (!normalizedSupplierName || !normalizedSku) {
    return null;
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
    return null;
  }

  const supplierProduct = await prisma.supplierProductSource.findFirst({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      supplier_profile_id: supplierProfile.id,
      sku: normalizedSku,
    },
    select: {
      case_pack: true,
    },
  });

  return supplierProduct?.case_pack ?? null;
}

function computeItemNumbers(
  expectedQty: number,
  goodQty: number,
  damagedQty: number,
  excessQty: number,
  unexpected: boolean,
) {
  if (unexpected) {
    return {
      diffQty: 0,
      uncheckedQty: 0,
      excessQty: 0,
      status: "pending" as const,
    };
  }

  const checkedQty = Math.min(goodQty + damagedQty, expectedQty);
  const diffQtyRaw = Math.max(expectedQty - checkedQty, 0);
  const uncheckedQtyRaw = diffQtyRaw;

  let status: "pending" | "in_progress" | "completed" = "pending";

  if (checkedQty <= 0 && excessQty <= 0) {
    status = "pending";
  } else if (checkedQty >= expectedQty) {
    status = "completed";
  } else {
    status = "in_progress";
  }

  return {
    diffQty: status === "pending" ? 0 : diffQtyRaw,
    uncheckedQty: status === "pending" ? 0 : uncheckedQtyRaw,
    excessQty,
    status,
  };
}

function buildSummary(
  items: Array<{
    expected_qty: number;
    good_qty: number;
    damaged_qty: number;
    excess_qty: number;
    unexpected: boolean;
  }>,
) {
  const imported = items.filter((item) => !item.unexpected);

  const totalSku = imported.length;
  const addedCount = items.filter((item) => item.unexpected).length;
  const expectedQtyTotal = imported.reduce((sum, item) => sum + item.expected_qty, 0);
  const goodQtyTotal = imported.reduce((sum, item) => sum + item.good_qty, 0);
  const damagedQtyTotal = imported.reduce((sum, item) => sum + item.damaged_qty, 0);
  const excessQtyTotal = imported.reduce((sum, item) => sum + item.excess_qty, 0);

  const checkedQtyTotal = goodQtyTotal + damagedQtyTotal;
  const uncheckedQtyTotal = Math.max(expectedQtyTotal - checkedQtyTotal, 0);
  const diffQtyTotal = uncheckedQtyTotal;
  const progress =
    expectedQtyTotal > 0
      ? Math.max(0, Math.min(100, Math.round((checkedQtyTotal / expectedQtyTotal) * 100)))
      : 0;

  const completedItems = imported.filter((item) => {
    const checked = Math.min(item.good_qty + item.damaged_qty, item.expected_qty);
    return checked >= item.expected_qty && item.expected_qty > 0;
  }).length;

  let receiptStatus: "pending" | "in_progress" | "completed" = "pending";

  if (imported.length > 0 && completedItems === imported.length) {
    receiptStatus = "completed";
  } else if (checkedQtyTotal > 0 || excessQtyTotal > 0) {
    receiptStatus = "in_progress";
  }

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
    completedItems,
    receiptStatus,
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ publicShareId: string }> },
) {
  const lang = resolveLang(new URL(request.url).searchParams.get("lang"));
  const i18n = getMobileReceiptI18n(lang);
  try {
    const { publicShareId } = await context.params;
    const body = await request.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: i18n.server.invalidBody }, { status: 400 });
    }

    const receipt = await prisma.receipt.findFirst({
      where: {
        public_share_id: publicShareId,
      },
      select: {
        id: true,
        tenant_id: true,
        company_id: true,
        supplier_name: true,
        locked: true,
        status: true,
      },
    });

    if (!receipt) {
      return NextResponse.json({ ok: false, error: i18n.server.receiptNotFound }, { status: 404 });
    }

    if (receipt.locked || receipt.status === "completed") {
      return NextResponse.json({ ok: false, error: i18n.server.receiptLocked }, { status: 409 });
    }

    const normalized = normalizeCode(parsed.data.code);
    const item = await prisma.receiptItem.findFirst({
      where: {
        receipt_id: receipt.id,
        tenant_id: receipt.tenant_id,
        company_id: receipt.company_id,
        OR: [
          { sku: { equals: parsed.data.code.trim(), mode: "insensitive" } },
          { barcode: { equals: parsed.data.code.trim(), mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        sku: true,
        barcode: true,
        case_pack: true,
        expected_qty: true,
        good_qty: true,
        damaged_qty: true,
        excess_qty: true,
        unexpected: true,
      },
    });

    if (!item) {
      const looksLikeBarcode = /^\d{6,}$/.test(parsed.data.code.trim());
      return NextResponse.json(
        {
          ok: false,
          error: looksLikeBarcode ? "UNKNOWN_BARCODE" : "SCAN_FAILED",
          code: parsed.data.code.trim(),
        },
        { status: 404 },
      );
    }

    const expectedQty = item.expected_qty ?? 0;
    const goodQty = item.unexpected ? 0 : (item.good_qty ?? 0);
    const damagedQty = item.unexpected ? 0 : (item.damaged_qty ?? 0);
    const excessQty = item.unexpected ? 0 : (item.excess_qty ?? 0);
    const checkedQty = Math.min(goodQty + damagedQty, expectedQty);
    const uncheckedQty = item.unexpected ? 0 : Math.max(expectedQty - checkedQty, 0);

    if (!item.unexpected && uncheckedQty <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "OVER_RECEIVED",
          code: item.sku || item.barcode || parsed.data.code.trim(),
        },
        { status: 409 },
      );
    }

    const supplierCasePack = parsed.data.useSupplierCasePack
      ? await resolveSupplierCasePack(
          receipt.tenant_id,
          receipt.company_id,
          receipt.supplier_name,
          item.sku,
        )
      : null;

    const increment = parsed.data.useSupplierCasePack
      ? (supplierCasePack && supplierCasePack > 0 ? supplierCasePack : 1)
      : ((item.case_pack ?? 0) > 0 ? (item.case_pack ?? 0) : 1);

    const maxGoodAllowed = Math.max(expectedQty - damagedQty, 0);
    const nextGoodQty = Math.min(goodQty + increment, maxGoodAllowed);
    const computed = computeItemNumbers(expectedQty, nextGoodQty, damagedQty, excessQty, item.unexpected);

    const result = await prisma.$transaction(async (tx) => {
      const updatedItem = await tx.receiptItem.update({
        where: { id: item.id },
        data: {
          good_qty: nextGoodQty,
          status: computed.status,
        },
        select: {
          id: true,
          sku: true,
          barcode: true,
          expected_qty: true,
          good_qty: true,
          damaged_qty: true,
          excess_qty: true,
          unexpected: true,
        },
      });

      const receiptItems = await tx.receiptItem.findMany({
        where: {
          receipt_id: receipt.id,
          tenant_id: receipt.tenant_id,
          company_id: receipt.company_id,
        },
        select: {
          expected_qty: true,
          good_qty: true,
          damaged_qty: true,
          excess_qty: true,
          unexpected: true,
        },
      });

      const summary = buildSummary(
        receiptItems.map((row) => ({
          expected_qty: row.expected_qty ?? 0,
          good_qty: row.good_qty ?? 0,
          damaged_qty: row.damaged_qty ?? 0,
          excess_qty: row.excess_qty ?? 0,
          unexpected: row.unexpected,
        })),
      );

      await tx.receipt.update({
        where: { id: receipt.id },
        data: {
          total_items: summary.totalSku,
          completed_items: summary.completedItems,
          progress_percent: summary.progress,
          status: summary.receiptStatus,
          locked: summary.receiptStatus === "completed",
          last_activity_at: new Date(),
        },
      });

      const updatedChecked = Math.min(
        (updatedItem.good_qty ?? 0) + (updatedItem.damaged_qty ?? 0),
        updatedItem.expected_qty ?? 0,
      );
      const updatedUncheckedQty = updatedItem.unexpected
        ? 0
        : Math.max((updatedItem.expected_qty ?? 0) - updatedChecked, 0);

      return {
        code: updatedItem.sku || updatedItem.barcode || normalized,
        justCompleted: !item.unexpected && uncheckedQty > 0 && updatedUncheckedQty <= 0,
        scannedItem: {
          id: updatedItem.id,
          sku: updatedItem.sku || updatedItem.barcode || normalized,
          uncheckedQty: updatedUncheckedQty,
        },
        summary,
      };
    });

    return NextResponse.json({
      ok: true,
      code: result.code,
      justCompleted: result.justCompleted,
      scannedItem: result.scannedItem,
      summary: {
        totalSku: result.summary.totalSku,
        addedCount: result.summary.addedCount,
        expectedQtyTotal: result.summary.expectedQtyTotal,
        goodQtyTotal: result.summary.goodQtyTotal,
        diffQtyTotal: result.summary.diffQtyTotal,
        uncheckedQtyTotal: result.summary.uncheckedQtyTotal,
        damagedQtyTotal: result.summary.damagedQtyTotal,
        excessQtyTotal: result.summary.excessQtyTotal,
        progress: result.summary.progress,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : i18n.server.genericScanFailed,
      },
      { status: 500 },
    );
  }
}
