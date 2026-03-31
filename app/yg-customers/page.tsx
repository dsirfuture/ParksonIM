// @ts-nocheck
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

function normalizeKey(value: string | null | undefined) {
  return normalizeText(value).toLowerCase();
}

function isExcludedCustomerName(value: string | null | undefined) {
  return normalizeText(value) === "百盛供应链 Parkson";
}

export default async function YgCustomersPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [customers, orders, customerSyncSummaryRows] = await Promise.all([
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
    prisma.$queryRawUnsafe<Array<{ latest_received_at: Date | null }>>(
      `
        SELECT MAX(updated_at) AS latest_received_at
        FROM yg_customer_imports
        WHERE tenant_id = $1::uuid
          AND company_id = $2::uuid
      `,
      session.tenantId,
      session.companyId,
    ),
  ]);

  const includedCustomers = customers.filter((row) => !isExcludedCustomerName(row.company_name));

  const ordersByCustomerId = new Map<string, typeof orders>();
  const ordersByCompanyName = new Map<string, typeof orders>();
  for (const order of orders) {
    if (isExcludedCustomerName(order.company_name || order.customer_name || order.contact_name)) continue;
    const customerIdKey = normalizeKey(order.customer_id);
    if (customerIdKey) {
      const list = ordersByCustomerId.get(customerIdKey) || [];
      list.push(order);
      ordersByCustomerId.set(customerIdKey, list);
    }
    const companyKey = normalizeKey(order.company_name || order.customer_name);
    if (companyKey) {
      const list = ordersByCompanyName.get(companyKey) || [];
      list.push(order);
      ordersByCompanyName.set(companyKey, list);
    }
  }

  const orderGroups = new Map<
    string,
    Array<{
      orderNo: string;
      orderDateText: string;
      orderAmount: number;
      latestStatus: string;
    }>
  >();

  let filteredOrdersCount = 0;

  const rows = includedCustomers.map((row) => {
    const orderLookupKey = normalizeKey(row.company_name) || normalizeKey(row.customer_key) || normalizeKey(row.customer_id);
    const customerIds = normalizeKey(row.customer_id) ? [normalizeKey(row.customer_id)] : [];
    const rowKey = `${orderLookupKey || "row"}::${normalizeText(row.relation_no)}::${normalizeText(row.company_name)}::${normalizeText(row.registered_phone)}::${row.id}`;
    const matchedMap = new Map<string, {
      orderNo: string;
      orderDateText: string;
      orderAmount: number;
      latestStatus: string;
    }>();
    for (const customerId of customerIds) {
      for (const order of ordersByCustomerId.get(customerId) || []) {
        matchedMap.set(order.order_no, {
          orderNo: order.order_no,
          orderDateText: formatDateOnly(order.order_created_at ?? order.updated_at),
          orderAmount: Number(order.order_amount || 0),
          latestStatus: normalizeText(order.latest_status) || "-",
        });
      }
    }
    if (matchedMap.size === 0) {
      for (const order of ordersByCompanyName.get(normalizeKey(row.company_name)) || []) {
        matchedMap.set(order.order_no, {
          orderNo: order.order_no,
          orderDateText: formatDateOnly(order.order_created_at ?? order.updated_at),
          orderAmount: Number(order.order_amount || 0),
          latestStatus: normalizeText(order.latest_status) || "-",
        });
      }
    }
    const details = Array.from(matchedMap.values());
    filteredOrdersCount += details.length;
    orderGroups.set(rowKey, details);
    const totalAmount = details.reduce((sum, item) => sum + item.orderAmount, 0);

    return {
      rowKey,
      customerKey: rowKey,
      customerId: normalizeText(row.customer_id),
      registeredPhone: normalizeText(row.registered_phone),
      companyName: normalizeText(row.company_name) || "未命名客户",
      noteText: normalizeText(row.note_text),
      relationNo: normalizeText(row.relation_no),
      relationName: normalizeText(row.relation_name),
      groupName: normalizeText(row.group_name),
      provinceName: normalizeText(row.province_name),
      regionName: normalizeText(row.region_name),
      statusText: normalizeText(row.status_text),
      salesRepName: normalizeText(row.sales_rep_name),
      registeredAtText: formatDateOnly(row.registered_at),
      lastVisitedAtText: formatDateOnly(row.last_visited_at),
      lastOrderAtText: formatDateOnly(row.last_order_at),
      lastOrderNo: normalizeText(row.last_order_no),
      syncedAtText: formatDateTime(row.synced_at ?? row.updated_at),
      detailRows: (orderGroups.get(rowKey) || []).map((detail) => ({
        orderNo: detail.orderNo,
        orderDateText: detail.orderDateText,
        orderAmountText: moneyText(detail.orderAmount),
        latestStatus: detail.latestStatus,
      })),
      totalOrderAmountText: moneyText(totalAmount),
      totalOrderCount: details.length,
    };
  });

  const sortedRows = rows.sort((left, right) => {
    return right.totalOrderCount - left.totalOrderCount || right.syncedAtText.localeCompare(left.syncedAtText);
  });

  const latestSyncedAt = formatDateTime(customerSyncSummaryRows[0]?.latest_received_at || null);
  const customersWithOrders = sortedRows.filter((row) => row.totalOrderCount > 0).length;
  const totalAmount = sortedRows.reduce((sum, row) => sum + Number(row.totalOrderAmountText || 0), 0);
  const monthFormatter = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "America/Mexico_City",
  });
  const currentMonthKey = monthFormatter.format(new Date());
  const monthlyRegisteredCount = includedCustomers.filter((row) => {
    if (!row.registered_at) return false;
    return monthFormatter.format(row.registered_at) === currentMonthKey;
  }).length;
  const [currentYear, currentMonth] = currentMonthKey.split("-");

  return (
    <AppShell>
      <YgCustomersClient
        initialRows={sortedRows}
        summary={{
          totalCustomers: includedCustomers.length,
          customersWithOrders,
          totalOrders: filteredOrdersCount,
          totalOrderAmountText: moneyText(totalAmount),
          latestSyncedAtText: latestSyncedAt,
          monthlyRegisteredCount,
          monthlyRegisteredLabel: `本月（${currentYear}/${String(Number(currentMonth))}）注册客户量`,
        }}
      />
    </AppShell>
  );
}
