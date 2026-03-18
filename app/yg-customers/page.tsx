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

function isExcludedCustomerName(value: string | null | undefined) {
  return normalizeText(value) === "百盛供应链 Parkson";
}

function buildVisibleCustomerSignature(input: {
  registeredPhone: string;
  companyName: string;
  relationName: string;
  regionName: string;
  lastVisitedAtText: string;
  lastOrderAtText: string;
}) {
  return [
    input.registeredPhone,
    input.companyName,
    input.relationName,
    input.regionName,
    input.lastVisitedAtText,
    input.lastOrderAtText,
  ]
    .map((value) => normalizeText(value).toLowerCase())
    .join("::");
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

  const includedCustomers = customers.filter((row) => !isExcludedCustomerName(row.company_name));
  const includedCustomerKeys = new Set(
    includedCustomers.map((row) =>
      buildCustomerKey({
        customer_id: row.customer_id,
        registered_phone: row.registered_phone,
        company_name: row.company_name,
        relation_no: row.relation_no,
        relation_name: row.relation_name,
      }) || row.customer_key,
    ),
  );

  const filteredOrders = orders.filter((order) => {
    if (isExcludedCustomerName(order.company_name || order.customer_name || order.contact_name)) {
      return false;
    }
    const key =
      buildCustomerKey({
        customer_id: order.customer_id,
        registered_phone: order.contact_phone,
        company_name: order.company_name || order.customer_name || order.contact_name,
        relation_no: null,
        relation_name: order.customer_name || order.contact_name,
      }) || `fallback::${order.order_no}`;
    return includedCustomerKeys.has(key);
  });

  const orderGroups = new Map<
    string,
    Array<{
      orderNo: string;
      orderDateText: string;
      orderAmount: number;
      latestStatus: string;
    }>
  >();

  for (const order of filteredOrders) {
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

  const rows = includedCustomers.map((row) => {
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
      rowKey: `${customerKey}::${normalizeText(row.relation_no)}::${normalizeText(row.company_name)}::${normalizeText(row.registered_phone)}`,
      customerKey,
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
      detailRows: details.map((detail) => ({
        orderNo: detail.orderNo,
        orderDateText: detail.orderDateText,
        orderAmountText: moneyText(detail.orderAmount),
        latestStatus: detail.latestStatus,
      })),
      totalOrderAmountText: moneyText(totalAmount),
      totalOrderCount: details.length,
    };
  });

  const dedupedRows = Array.from(
    rows.reduce((map, row) => {
      const signature = buildVisibleCustomerSignature({
        registeredPhone: row.registeredPhone,
        companyName: row.companyName,
        relationName: row.relationName,
        regionName: row.regionName,
        lastVisitedAtText: row.lastVisitedAtText,
        lastOrderAtText: row.lastOrderAtText,
      });
      const existing = map.get(signature);
      if (!existing) {
        map.set(signature, row);
        return map;
      }

      const mergedDetailRows = Array.from(
        [...existing.detailRows, ...row.detailRows].reduce((detailMap, detail) => {
          detailMap.set(`${detail.orderNo}::${detail.orderDateText}`, detail);
          return detailMap;
        }, new Map<string, (typeof row.detailRows)[number]>()),
      ).map(([, detail]) => detail);

      const mergedAmount = mergedDetailRows.reduce((sum, detail) => sum + Number(detail.orderAmountText || 0), 0);
      map.set(signature, {
        ...existing,
        detailRows: mergedDetailRows,
        totalOrderCount: mergedDetailRows.length,
        totalOrderAmountText: moneyText(mergedAmount),
      });
      return map;
    }, new Map<string, (typeof rows)[number]>()),
  ).map(([, row]) => row);

  const sortedRows = dedupedRows.sort((left, right) => {
    return right.totalOrderCount - left.totalOrderCount || right.syncedAtText.localeCompare(left.syncedAtText);
  });

  const latestSyncedAt = includedCustomers[0]
    ? formatDateTime(includedCustomers[0].synced_at ?? includedCustomers[0].updated_at)
    : "-";
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
          totalCustomers: sortedRows.length,
          customersWithOrders,
          totalOrders: filteredOrders.length,
          totalOrderAmountText: moneyText(totalAmount),
          latestSyncedAtText: latestSyncedAt,
          monthlyRegisteredCount,
          monthlyRegisteredLabel: `本月（${currentYear}/${String(Number(currentMonth))}）注册客户量`,
        }}
      />
    </AppShell>
  );
}
