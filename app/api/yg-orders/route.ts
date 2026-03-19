// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";

function formatMoney(value: unknown) {
  if (value === null || value === undefined) return "-";

  const num =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : typeof value === "object" &&
            value !== null &&
            "toNumber" in value &&
            typeof (value as { toNumber: unknown }).toNumber === "function"
          ? (value as { toNumber: () => number }).toNumber()
          : Number(value);

  if (!Number.isFinite(num)) return "-";
  return num.toFixed(2);
}

function formatDateTime(value: Date | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

export async function GET() {
  try {
    const session = await getSession();

    if (!session?.tenantId || !session?.companyId) {
      return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    }

    const rows = await prisma.ygOrderImport.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      orderBy: {
        created_at: "desc",
      },
      include: {
        supplierOrders: {
          orderBy: {
            supplier_code: "asc",
          },
        },
      },
      take: 20,
    });

    return NextResponse.json({
      ok: true,
      items: rows.map((row) => ({
        id: row.id,
        orderNo: row.order_no,
        orderAmountText: formatMoney(row.order_amount),
        lastThree: row.last_three,
        sourceFileName: row.source_file_name,
        supplierCount: row.supplier_count,
        itemCount: row.item_count,
        customerName: row.customer_name || "",
        contactText: [row.contact_name || "", row.contact_phone || ""]
          .filter(Boolean)
          .join(" / "),
        addressText: row.address_text || "",
        remarkText: row.order_remark || "",
        storeLabelText: row.store_label || "",
        createdAtText: formatDateTime(row.created_at),
        supplierOrders: row.supplierOrders.map((item) => ({
          id: item.id,
          supplierCode: item.supplier_code,
          derivedOrderNo: item.derived_order_no,
          orderAmountText: formatMoney(item.order_amount),
          itemCount: item.item_count,
          noteText: item.note_text || "",
        })),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "读取失败",
      },
      { status: 500 },
    );
  }
}
