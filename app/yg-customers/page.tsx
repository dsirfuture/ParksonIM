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

function moneyText(value: number) {
  return value.toFixed(2);
}

function normalizeText(value: string | null | undefined) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function customerDisplayName(row: {
  company_name: string | null;
  customer_name: string | null;
  contact_name: string | null;
}) {
  return (
    normalizeText(row.company_name) ||
    normalizeText(row.customer_name) ||
    normalizeText(row.contact_name) ||
    "未命名顾客"
  );
}

function customerKey(row: {
  company_name: string | null;
  customer_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
}) {
  return [
    normalizeText(row.company_name).toLowerCase(),
    normalizeText(row.customer_name).toLowerCase(),
    normalizeText(row.contact_name).toLowerCase(),
    normalizeText(row.contact_phone),
  ]
    .filter(Boolean)
    .join("::");
}

export default async function YgCustomersPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const orders = await prisma.ygOrderImport.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    orderBy: [{ updated_at: "desc" }, { order_no: "desc" }],
    select: {
      order_no: true,
      order_amount: true,
      company_name: true,
      customer_name: true,
      contact_name: true,
      contact_phone: true,
      address_text: true,
      updated_at: true,
    },
  });

  const customerMap = new Map<
    string,
    {
      key: string;
      displayName: string;
      companyName: string;
      customerName: string;
      contactName: string;
      contactPhone: string;
      addressText: string;
      orderCount: number;
      totalAmount: number;
      latestOrderNo: string;
      latestUpdatedAt: Date | null;
    }
  >();

  for (const row of orders) {
    const key = customerKey(row) || `fallback::${row.order_no}`;
    const displayName = customerDisplayName(row);
    const companyName = normalizeText(row.company_name);
    const customerName = normalizeText(row.customer_name);
    const contactName = normalizeText(row.contact_name);
    const contactPhone = normalizeText(row.contact_phone);
    const addressText = normalizeText(row.address_text);
    const amount = Number(row.order_amount || 0);
    const current = customerMap.get(key);

    if (!current) {
      customerMap.set(key, {
        key,
        displayName,
        companyName,
        customerName,
        contactName,
        contactPhone,
        addressText,
        orderCount: 1,
        totalAmount: Number.isFinite(amount) ? amount : 0,
        latestOrderNo: row.order_no,
        latestUpdatedAt: row.updated_at,
      });
      continue;
    }

    current.orderCount += 1;
    current.totalAmount += Number.isFinite(amount) ? amount : 0;

    if (row.updated_at && (!current.latestUpdatedAt || row.updated_at > current.latestUpdatedAt)) {
      current.latestUpdatedAt = row.updated_at;
      current.latestOrderNo = row.order_no;
      current.displayName = displayName || current.displayName;
      current.companyName = companyName || current.companyName;
      current.customerName = customerName || current.customerName;
      current.contactName = contactName || current.contactName;
      current.contactPhone = contactPhone || current.contactPhone;
      current.addressText = addressText || current.addressText;
    } else {
      if (!current.companyName && companyName) current.companyName = companyName;
      if (!current.customerName && customerName) current.customerName = customerName;
      if (!current.contactName && contactName) current.contactName = contactName;
      if (!current.contactPhone && contactPhone) current.contactPhone = contactPhone;
      if (!current.addressText && addressText) current.addressText = addressText;
    }
  }

  const rows = Array.from(customerMap.values())
    .sort((left, right) => {
      const leftTime = left.latestUpdatedAt ? left.latestUpdatedAt.getTime() : 0;
      const rightTime = right.latestUpdatedAt ? right.latestUpdatedAt.getTime() : 0;
      if (leftTime !== rightTime) return rightTime - leftTime;
      return right.orderCount - left.orderCount;
    })
    .map((row) => ({
      key: row.key,
      displayName: row.displayName,
      companyName: row.companyName,
      customerName: row.customerName,
      contactName: row.contactName,
      contactPhone: row.contactPhone,
      addressText: row.addressText,
      orderCount: row.orderCount,
      totalAmountText: moneyText(row.totalAmount),
      latestOrderNo: row.latestOrderNo,
      latestUpdatedAtText: formatDateTime(row.latestUpdatedAt),
    }));

  const latestUpdatedAt = rows.length > 0 ? rows[0].latestUpdatedAtText : "-";

  return (
    <AppShell>
      <YgCustomersClient
        initialRows={rows}
        summary={{
          totalCustomers: rows.length,
          totalOrders: orders.length,
          customersWithPhone: rows.filter((row) => Boolean(row.contactPhone)).length,
          latestUpdatedAtText: latestUpdatedAt,
        }}
      />
    </AppShell>
  );
}
