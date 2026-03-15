import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { BillingClient } from "./BillingClient";

type TabKey = "customer" | "supplier";
type SearchParams = Record<string, string | string[] | undefined>;

function normalizeTab(tab: string | null | undefined): TabKey {
  return tab === "supplier" ? "supplier" : "customer";
}

function formatDateOnly(value: Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
    timeZone: "America/Mexico_City",
  }).format(value);
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

function baseOrderNo(receiptNo: string) {
  const head = String(receiptNo || "")
    .trim()
    .split("-")[0];
  return head || String(receiptNo || "").trim();
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) {
    return (
      <AppShell>
        <section className="rounded-2xl border border-red-200 bg-white p-4 text-sm text-red-600">
          未获取到租户会话，请先登录。
        </section>
      </AppShell>
    );
  }

  const params = (await searchParams) || {};
  const tabRaw = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const activeTab = normalizeTab(tabRaw || null);

  const completedReceipts = await prisma.receipt.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      status: "completed",
    },
    select: {
      receipt_no: true,
      updated_at: true,
      items: {
        select: {
          sku: true,
          barcode: true,
          name_zh: true,
          name_es: true,
          expected_qty: true,
          sell_price: true,
          normal_discount: true,
          vip_discount: true,
          line_total: true,
        },
      },
    },
    orderBy: { updated_at: "desc" },
  });

  const grouped = new Map<
    string,
    {
      orderNo: string;
      totalAmount: number;
      latestAt: Date | null;
    }
  >();

  const detailMap = new Map<
    string,
    Map<
      string,
      {
        sku: string;
        barcode: string;
        nameZh: string;
        nameEs: string;
        qty: number;
        unitPrice: number;
        normalDiscount: number | null;
        vipDiscount: number | null;
        lineTotal: number;
      }
    >
  >();

  for (const receipt of completedReceipts) {
    const orderNo = baseOrderNo(receipt.receipt_no);
    const row =
      grouped.get(orderNo) ||
      ({
        orderNo,
        totalAmount: 0,
        latestAt: null,
      } as const);

    const orderDetail = detailMap.get(orderNo) || new Map();
    let receiptAmount = 0;

    for (const item of receipt.items) {
      const qty = Number(item.expected_qty || 0);
      const unitPrice = item.sell_price ? Number(item.sell_price) : 0;
      const normalDiscount = item.normal_discount === null ? null : Number(item.normal_discount);
      const vipDiscount = item.vip_discount === null ? null : Number(item.vip_discount);
      const lineTotalRaw = item.line_total ? Number(item.line_total) : null;
      const lineTotal =
        lineTotalRaw !== null && Number.isFinite(lineTotalRaw) ? lineTotalRaw : qty * unitPrice;

      receiptAmount += lineTotal;

      const sku = String(item.sku || "").trim();
      const barcode = String(item.barcode || "").trim();
      const key = `${sku}|${barcode}`;
      const old = orderDetail.get(key);
      if (!old) {
        orderDetail.set(key, {
          sku,
          barcode,
          nameZh: String(item.name_zh || "").trim(),
          nameEs: String(item.name_es || "").trim(),
          qty,
          unitPrice,
          normalDiscount: normalDiscount !== null && Number.isFinite(normalDiscount) ? normalDiscount : null,
          vipDiscount: vipDiscount !== null && Number.isFinite(vipDiscount) ? vipDiscount : null,
          lineTotal,
        });
      } else {
        old.qty += qty;
        old.lineTotal += lineTotal;
        if (old.normalDiscount === null && normalDiscount !== null && Number.isFinite(normalDiscount)) {
          old.normalDiscount = normalDiscount;
        }
        if (old.vipDiscount === null && vipDiscount !== null && Number.isFinite(vipDiscount)) {
          old.vipDiscount = vipDiscount;
        }
      }
    }

    detailMap.set(orderNo, orderDetail);

    const latestAt =
      !row.latestAt || row.latestAt.getTime() < receipt.updated_at.getTime()
        ? receipt.updated_at
        : row.latestAt;

    grouped.set(orderNo, {
      orderNo,
      totalAmount: row.totalAmount + receiptAmount,
      latestAt,
    });
  }

  const orderNos = Array.from(grouped.keys());
  const ygOrders =
    orderNos.length > 0
      ? await prisma.ygOrderImport.findMany({
          where: {
            tenant_id: session.tenantId,
            company_id: session.companyId,
            order_no: { in: orderNos },
          },
          select: {
            id: true,
            order_no: true,
            company_name: true,
            customer_name: true,
            contact_name: true,
            contact_phone: true,
            address_text: true,
            order_remark: true,
            store_label: true,
            updated_at: true,
          },
          orderBy: { updated_at: "desc" },
        })
      : [];

  const orderMap = new Map<
    string,
    {
      id: string;
      companyName: string;
      customerName: string;
      contactName: string;
      contactPhone: string;
      addressText: string;
      remarkText: string;
      storeLabelText: string;
    }
  >();

  for (const row of ygOrders) {
    if (orderMap.has(row.order_no)) continue;
    const companyName = row.company_name || row.customer_name || "-";
    const contactName = row.contact_name || row.customer_name || row.company_name || "-";
    orderMap.set(row.order_no, {
      id: row.id,
      companyName,
      customerName: row.customer_name || row.company_name || "",
      contactName,
      contactPhone: row.contact_phone || "-",
      addressText: row.address_text || "",
      remarkText: row.order_remark || "",
      storeLabelText: row.store_label || "",
    });
  }

  const initialRows = Array.from(grouped.values())
    .map((row) => {
      const order = orderMap.get(row.orderNo);
      return {
        id: order?.id || "",
        orderNo: row.orderNo,
        companyName: order?.companyName || "-",
        customerName: order?.customerName || "",
        contactName: order?.contactName || "-",
        contactPhone: order?.contactPhone || "-",
        addressText: order?.addressText || "",
        remarkText: order?.remarkText || "",
        storeLabelText: order?.storeLabelText || "",
        amountText: formatMoney(row.totalAmount),
        updatedAtText: formatDateOnly(row.latestAt),
      };
    })
    .sort((a, b) => b.orderNo.localeCompare(a.orderNo));

  const detailsByOrderNo = Object.fromEntries(
    Array.from(detailMap.entries()).map(([orderNo, items]) => [orderNo, Array.from(items.values())]),
  );

  return (
    <AppShell>
      <BillingClient initialRows={initialRows} detailsByOrderNo={detailsByOrderNo} activeTab={activeTab} />
    </AppShell>
  );
}
