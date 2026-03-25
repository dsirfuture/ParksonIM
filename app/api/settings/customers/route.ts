// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { getSession } from "@/lib/tenant";

function normalizeKey(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function buildCandidateKeys(input: {
  name?: unknown;
  contact?: unknown;
  phone?: unknown;
  whatsapp?: unknown;
}) {
  return [
    normalizeKey(input.name),
    normalizeKey(input.contact),
    normalizeKey(input.phone),
    normalizeKey(input.whatsapp),
  ].filter(Boolean);
}

function formatDateText(value: Date | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Mexico_City",
  }).format(value);
}

function isPackingStatus(value: unknown) {
  const raw = String(value || "").trim().toLowerCase();
  return raw === "2" || raw === "packing" || raw === "picking" || raw === "配货中";
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    const allowed = await hasPermission(session, "manageCustomers");
    if (!allowed) return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });

    const [profiles, ygCustomers, orders] = await Promise.all([
      withPrismaRetry(() =>
        prisma.customerProfile.findMany({
          where: { tenant_id: session.tenantId, company_id: session.companyId },
          orderBy: [{ updated_at: "desc" }],
        }),
      ),
      withPrismaRetry(() =>
        prisma.ygCustomerImport.findMany({
          where: { tenant_id: session.tenantId, company_id: session.companyId },
          orderBy: [{ last_order_at: "desc" }, { updated_at: "desc" }],
        }),
      ),
      withPrismaRetry(() =>
        prisma.ygOrderImport.findMany({
          where: { tenant_id: session.tenantId, company_id: session.companyId },
          orderBy: [{ order_created_at: "desc" }, { updated_at: "desc" }, { order_no: "desc" }],
          select: {
            order_no: true,
            company_name: true,
            customer_name: true,
            contact_name: true,
            contact_phone: true,
            order_amount: true,
            latest_status: true,
            order_created_at: true,
            updated_at: true,
          },
        }),
      ),
    ]);

    const orderKeyMap = new Map<string, any[]>();
    for (const order of orders) {
      const keys = buildCandidateKeys({
        name: order.company_name || order.customer_name,
        contact: order.contact_name,
        phone: order.contact_phone,
      });
      for (const key of keys) {
        const list = orderKeyMap.get(key) || [];
        list.push(order);
        orderKeyMap.set(key, list);
      }
    }

    const ygCustomerMap = new Map<string, any>();
    for (const row of ygCustomers) {
      const keys = buildCandidateKeys({
        name: row.company_name,
        contact: row.relation_name,
        phone: row.registered_phone,
      });
      for (const key of keys) {
        if (!ygCustomerMap.has(key)) {
          ygCustomerMap.set(key, row);
        }
      }
    }

    function buildOrderSummary(candidateKeys: string[]) {
      const matchedMap = new Map<string, any>();
      for (const key of candidateKeys) {
        const matches = orderKeyMap.get(key) || [];
        for (const order of matches) {
          matchedMap.set(order.order_no, order);
        }
      }

      const detailRows = Array.from(matchedMap.values())
        .sort((left, right) => {
          const leftTime = new Date(left.order_created_at || left.updated_at || 0).getTime();
          const rightTime = new Date(right.order_created_at || right.updated_at || 0).getTime();
          return rightTime - leftTime;
        })
        .map((order) => ({
          orderNo: order.order_no,
          orderDateText: formatDateText(order.order_created_at || order.updated_at),
          orderAmountText: Number(order.order_amount || 0).toFixed(2),
          latestStatus: String(order.latest_status || "").trim() || "-",
        }));

      const totalOrderAmount = detailRows.reduce((sum, item) => sum + Number(item.orderAmountText || 0), 0);
      const packingAmount = Array.from(matchedMap.values()).reduce((sum, order) => {
        if (!isPackingStatus(order.latest_status)) return sum;
        return sum + Number(order.order_amount || 0);
      }, 0);

      return {
        totalOrderAmountText: totalOrderAmount.toFixed(2),
        packingAmountText: packingAmount.toFixed(2),
        totalOrderCount: detailRows.length,
        detailRows,
      };
    }

    const matchedYgCustomerKeys = new Set<string>();
    const profileRows = profiles.map((row) => {
      const profileKeys = buildCandidateKeys({
        name: row.name,
        contact: row.contact_name,
        phone: row.mobile,
        whatsapp: row.whatsapp,
      });
      const matchedYg = profileKeys.map((key) => ygCustomerMap.get(key)).find(Boolean) || null;
      if (matchedYg?.customer_key) {
        matchedYgCustomerKeys.add(matchedYg.customer_key);
      }
      const candidateKeys = Array.from(
        new Set([
          ...profileKeys,
          ...buildCandidateKeys({
            name: matchedYg?.company_name,
            contact: matchedYg?.relation_name,
            phone: matchedYg?.registered_phone,
          }),
        ]),
      );
      const orderSummary = buildOrderSummary(candidateKeys);

      return {
        id: row.id,
        sourceType: "profile",
        name: matchedYg?.company_name || row.name || "",
        contact: matchedYg?.relation_name || row.contact_name || "",
        phone: matchedYg?.registered_phone || row.mobile || "",
        whatsapp: row.whatsapp || "",
        email: row.email || "",
        stores: row.store_addresses || "",
        cityCountry:
          [matchedYg?.province_name, matchedYg?.region_name].filter(Boolean).join(" / ")
          || row.city_country
          || "",
        customerType: row.customer_type || "",
        vipLevel: row.vip_level || "",
        creditLevel: row.credit_level || "",
        tags: row.tag_text || "",
        orderStats: String(orderSummary.totalOrderCount || row.order_stat_text || ""),
        ...orderSummary,
      };
    });

    const syncedOnlyRows = ygCustomers
      .filter((row) => !matchedYgCustomerKeys.has(row.customer_key))
      .map((row) => {
        const candidateKeys = buildCandidateKeys({
          name: row.company_name,
          contact: row.relation_name,
          phone: row.registered_phone,
        });
        return {
          id: `yg:${row.customer_key}`,
          sourceType: "yg",
          name: row.company_name || "",
          contact: row.relation_name || "",
          phone: row.registered_phone || "",
          whatsapp: "",
          email: "",
          stores: "",
          cityCountry: [row.province_name, row.region_name].filter(Boolean).join(" / "),
          customerType: "",
          vipLevel: "",
          creditLevel: "",
          tags: "",
          orderStats: "",
          ...buildOrderSummary(candidateKeys),
        };
      });

    return NextResponse.json({
      ok: true,
      items: [...profileRows, ...syncedOnlyRows],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "读取客户失败" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    const allowed = await hasPermission(session, "manageCustomers");
    if (!allowed) return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });

    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id || "").trim();
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ ok: false, error: "客户名称必填" }, { status: 400 });

    const data = {
      name,
      contact_name: String(body.contact || "").trim() || null,
      mobile: String(body.phone || "").trim() || null,
      whatsapp: String(body.whatsapp || "").trim() || null,
      email: String(body.email || "").trim() || null,
      store_addresses: String(body.stores || "").trim() || null,
      city_country: String(body.cityCountry || "").trim() || null,
      customer_type: String(body.customerType || "").trim() || null,
      vip_level: String(body.vipLevel || "").trim() || null,
      credit_level: String(body.creditLevel || "").trim() || null,
      tag_text: String(body.tags || "").trim() || null,
      order_stat_text: String(body.orderStats || "").trim() || null,
    };

    if (id && !id.startsWith("yg:")) {
      const target = await withPrismaRetry(() =>
        prisma.customerProfile.findFirst({
          where: { id, tenant_id: session.tenantId, company_id: session.companyId },
          select: { id: true },
        }),
      );
      if (!target) return NextResponse.json({ ok: false, error: "客户不存在" }, { status: 404 });
      await withPrismaRetry(() =>
        prisma.customerProfile.update({ where: { id }, data }),
      );
      return NextResponse.json({ ok: true, id });
    }

    const created = await withPrismaRetry(() =>
      prisma.customerProfile.create({
        data: { tenant_id: session.tenantId, company_id: session.companyId, ...data },
        select: { id: true },
      }),
    );
    return NextResponse.json({ ok: true, id: created.id });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "保存客户失败" },
      { status: 500 },
    );
  }
}
