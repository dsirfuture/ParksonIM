import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileReceiptI18n, resolveLang } from "@/lib/mobile-receipt-i18n";

function toInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "object" &&
    value !== null &&
    "toNumber" in value &&
    typeof (value as { toNumber: unknown }).toNumber === "function"
  ) {
    try {
      return Number((value as { toNumber: () => number }).toNumber()) || 0;
    } catch {
      return 0;
    }
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ publicShareId: string }> },
) {
  const lang = resolveLang(new URL(request.url).searchParams.get("lang"));
  const i18n = getMobileReceiptI18n(lang);
  try {
    const { publicShareId } = await context.params;

    const receipt = await prisma.receipt.findFirst({
      where: {
        public_share_id: publicShareId,
      },
      include: {
        items: {
          select: {
            expected_qty: true,
            good_qty: true,
            damaged_qty: true,
            unexpected: true,
          },
        },
      },
    });

    if (!receipt) {
      return NextResponse.json({ ok: false, error: i18n.server.receiptNotFound }, { status: 404 });
    }

    const importedItems = receipt.items.filter((item) => !item.unexpected);
    const completedItems = importedItems.filter((item) => {
      const expectedQty = toInt(item.expected_qty);
      const checkedQty = toInt(item.good_qty) + toInt(item.damaged_qty);
      return expectedQty > 0 && checkedQty >= expectedQty;
    }).length;
    const expectedQtyTotal = importedItems.reduce(
      (sum, item) => sum + toInt(item.expected_qty),
      0,
    );
    const checkedQtyTotal = importedItems.reduce(
      (sum, item) => sum + toInt(item.good_qty) + toInt(item.damaged_qty),
      0,
    );
    const progress =
      expectedQtyTotal > 0
        ? Math.max(
            0,
            Math.min(100, Math.round((checkedQtyTotal / expectedQtyTotal) * 100)),
          )
        : 0;

    await prisma.receipt.update({
      where: { id: receipt.id },
      data: {
        status: "completed",
        locked: true,
        completed_items: completedItems,
        progress_percent: progress,
        last_activity_at: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      receiptId: receipt.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : i18n.ui.finishInspectionFailed,
      },
      { status: 500 },
    );
  }
}
