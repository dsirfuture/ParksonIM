import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { YgCustomersClient } from "./YgCustomersClient";

function formatDateTime(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Mexico_City",
  }).format(value);
}

function formatDateOnly(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(value);
}

function moneyText(value: number) {
  return value.toFixed(2);
}

function normalizeText(value: string | null | undefined) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function buildCustomerKey(input: {
  customer_id?: string | null;
  registered_phone?: string | null;
  company_name?: string | null;
  relation_no?: string | null;
  relation_name?: string | null;
}) {
  return (
    normalizeText(input.customer_id) ||
    normalizeText(input.registered_phone) ||
    normalizeText(input.relation_no) ||
    normalizeText(input.company_name) ||
    normalizeText(input.relation_name)
  );
}

export default async function YgCustomersPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [customers, orders] = await Promise.all([
    prisma.ygCustomerImport.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      orderBy: [{ last_visited_at: "desc" }, { last_order_at: "desc" }, { updated_at: "desc" }],
    }),
    prisma.ygOrderImport.findMany({
      where: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      orderBy: [{ order_created_at: "desc" }, { updated_at: "desc" }, { order_no: "desc" }],
      select: {
        order_no: true,
        customer_id: true,
        company_name: true,
        customer_name: true,
        contact_name: true,
        contact_phone: true,
        order_amount: true,
        order_created_at: true,
        updated_at: true,
        latest_status: true,
      },
    }),
  ]);

  const orderGroups = new Map<
    string,
    Array<{
      orderNo: string;
      orderDateText: string;
      orderAmount: number;
      latestStatus: string;
    }>
  >();

  for (const order of orders) {
    const key =
      buildCustomerKey({
        customer_id: order.customer_id,
        registered_phone: order.contact_phone,
        company_name: order.company_name || order.customer_name || order.contact_name,
        relation_no: null,
        relation_name: order.customer_name || order.contact_name,
      }) || `fallback::${order.order_no}`;
    const group = orderGroups.get(key) || [];
    group.push({
      orderNo: order.order_no,
      orderDateText: formatDateOnly(order.order_created_at ?? order.updated_at),
      orderAmount: Number(order.order_amount || 0),
      latestStatus: normalizeText(order.latest_status) || "-",
    });
    orderGroups.set(key, group);
  }

  const fallbackCustomerRows = new Map<
    string,
    {
      customerKey: string;
      customerId: string;
      registeredPhone: string;
      companyName: string;
      noteText: string;
      relationNo: string;
      relationName: string;
      groupName: string;
      provinceName: string;
      regionName: string;
      statusText: string;
      lastVisitedAtText: string;
      lastOrderAtText: string;
      lastOrderNo: string;
      syncedAtText: string;
      detailRows: Array<{ orderNo: string; orderDateText: string; orderAmountText: string; latestStatus: string }>;
      totalOrderAmountText: string;
      totalOrderCount: number;
    }
  >();

  for (const order of orders) {
    const key =
      buildCustomerKey({
        customer_id: order.customer_id,
        registered_phone: order.contact_phone,
        company_name: order.company_name || order.customer_name || order.contact_name,
        relation_no: null,
        relation_name: order.customer_name || order.contact_name,
      }) || `fallback::${order.order_no}`;
    if (fallbackCustomerRows.has(key)) continue;

    const details = orderGroups.get(key) || [];
    const totalAmount = details.reduce((sum, row) => sum + row.orderAmount, 0);
    fallbackCustomerRows.set(key, {
      customerKey: key,
      customerId: normalizeText(order.customer_id),
      registeredPhone: normalizeText(order.contact_phone),
      companyName: normalizeText(order.company_name) || normalizeText(order.customer_name) || normalizeText(order.contact_name) || "未命名顾客",
      noteText: "",
      relationNo: "",
      relationName: normalizeText(order.customer_name) || normalizeText(order.contact_name),
      groupName: "",
      provinceName: "",
      regionName: "",
      statusText: normalizeText(order.latest_status),
      lastVisitedAtText: formatDateOnly(order.updated_at),
      lastOrderAtText: formatDateOnly(order.order_created_at ?? order.updated_at),
      lastOrderNo: order.order_no,
      syncedAtText: formatDateTime(order.updated_at),
      detailRows: details.map((detail) => ({
        orderNo: detail.orderNo,
        orderDateText: detail.orderDateText,
        orderAmountText: moneyText(detail.orderAmount),
        latestStatus: detail.latestStatus,
      })),
      totalOrderAmountText: moneyText(totalAmount),
      totalOrderCount: details.length,
    });
  }

  const rows =
    customers.length > 0
      ? customers.map((row) => {
          const customerKey =
            buildCustomerKey({
              customer_id: row.customer_id,
              registered_phone: row.registered_phone,
              company_name: row.company_name,
              relation_no: row.relation_no,
              relation_name: row.relation_name,
            }) || row.customer_key;
          const details = orderGroups.get(customerKey) || [];
          const totalAmount = details.reduce((sum, item) => sum + item.orderAmount, 0);

          return {
            customerKey,
            customerId: normalizeText(row.customer_id),
            registeredPhone: normalizeText(row.registered_phone),
            companyName: normalizeText(row.company_name) || "未命名顾客",
            noteText: normalizeText(row.note_text),
            relationNo: normalizeText(row.relation_no),
            relationName: normalizeText(row.relation_name),
            groupName: normalizeText(row.group_name),
            provinceName: normalizeText(row.province_name),
            regionName: normalizeText(row.region_name),
            statusText: normalizeText(row.status_text),
            lastVisitedAtText: formatDateOnly(row.last_visited_at),
            lastOrderAtText: formatDateOnly(row.last_order_at),
            lastOrderNo: normalizeText(row.last_order_no),
            syncedAtText: formatDateTime(row.synced_at ?? row.updated_at),
            detailRows: details.map((detail) => ({
              orderNo: detail.orderNo,
              orderDateText: detail.orderDateText,
              orderAmountText: moneyText(detail.orderAmount),
              latestStatus: detail.latestStatus,
            })),
            totalOrderAmountText: moneyText(totalAmount),
            totalOrderCount: details.length,
          };
        })
      : Array.from(fallbackCustomerRows.values());

  const sortedRows = rows.sort((left, right) => {
    return right.totalOrderCount - left.totalOrderCount || right.syncedAtText.localeCompare(left.syncedAtText);
  });

  const latestSyncedAt = sortedRows[0]?.syncedAtText || "-";
  const customersWithOrders = sortedRows.filter((row) => row.totalOrderCount > 0).length;
  const totalAmount = sortedRows.reduce((sum, row) => sum + Number(row.totalOrderAmountText || 0), 0);

  return (
    <AppShell>
      <YgCustomersClient
        initialRows={sortedRows}
        summary={{
          totalCustomers: sortedRows.length,
          customersWithOrders,
          totalOrders: orders.length,
          totalOrderAmountText: moneyText(totalAmount),
          latestSyncedAtText: latestSyncedAt,
        }}
      />
    </AppShell>
  );
}
