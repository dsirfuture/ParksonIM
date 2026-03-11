import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { redirect } from "next/navigation";
import { YgOrdersClient } from "./YgOrdersClient";

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

export default async function YgOrdersPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
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
        include: {
          items: {
            orderBy: {
              line_no: "asc",
            },
          },
        },
      },
    },
    take: 20,
  });

  const initialRows = rows.map((row) => ({
    id: row.id,
    orderNo: row.order_no,
    orderAmountText: formatMoney(row.order_amount),
    customerName: row.customer_name || "",
    contactText: [row.contact_name || "", row.contact_phone || ""]
      .filter(Boolean)
      .join(" / "),
    addressText: row.address_text || "",
    remarkText: row.order_remark || "",
    storeLabelText: row.store_label || "",
    createdAtText: formatDateTime(row.created_at),
    supplierCount: row.supplier_count,
    itemCount: row.item_count,
    supplierOrders: row.supplierOrders.map((item) => ({
      id: item.id,
      supplierCode: item.supplier_code,
      derivedOrderNo: item.derived_order_no,
      orderAmountText: formatMoney(item.order_amount),
      itemCount: item.item_count,
      noteText: item.note_text || "",
      items: item.items.map((detail) => ({
        id: detail.id,
        location: detail.location,
        itemNo: detail.item_no || "",
        barcode: detail.barcode || "",
        productName: detail.product_name || "",
        totalQty: detail.total_qty,
        unitPriceText: formatMoney(detail.unit_price),
        lineTotalText: formatMoney(detail.line_total),
      })),
    })),
  }));

  return (
    <AppShell>
      <YgOrdersClient initialRows={initialRows} />
    </AppShell>
  );
}
