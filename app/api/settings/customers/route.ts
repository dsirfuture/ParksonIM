// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { getSession } from "@/lib/tenant";

function normalizeKey(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function buildDisplayName(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isExcludedYgName(value: unknown) {
  const text = buildDisplayName(value).toLowerCase();
  if (!text) return false;
  return text.includes("百盛供应链") || text.includes("parkson");
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

function getCompletenessScore(input: {
  name?: unknown;
  contact?: unknown;
  phone?: unknown;
  cityCountry?: unknown;
  customerId?: unknown;
}) {
  return [
    input.name,
    input.contact,
    input.phone,
    input.cityCountry,
    input.customerId,
  ].reduce((sum, value) => sum + (normalizeKey(value) ? 1 : 0), 0);
}

function pickPreferredYgRow(left: any, right: any) {
  const leftScore = getCompletenessScore({
    name: left?.company_name,
    contact: left?.relation_name,
    phone: left?.registered_phone,
    cityCountry: [left?.province_name, left?.region_name].filter(Boolean).join(" / "),
    customerId: left?.customer_id,
  });
  const rightScore = getCompletenessScore({
    name: right?.company_name,
    contact: right?.relation_name,
    phone: right?.registered_phone,
    cityCountry: [right?.province_name, right?.region_name].filter(Boolean).join(" / "),
    customerId: right?.customer_id,
  });
  if (rightScore !== leftScore) return rightScore > leftScore ? right : left;
  return (right?.updated_at?.getTime?.() || 0) > (left?.updated_at?.getTime?.() || 0) ? right : left;
}

function buildYgGroupKey(row: any) {
  return normalizeKey(row?.company_name) || normalizeKey(row?.customer_key) || normalizeKey(row?.customer_id);
}

function groupYgCustomers(rows: any[]) {
  const grouped = new Map<string, any>();
  for (const row of rows) {
    const key = buildYgGroupKey(row);
    if (!key) continue;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        ...row,
        _customerIds: new Set<string>(normalizeKey(row.customer_id) ? [normalizeKey(row.customer_id)] : []),
      });
      continue;
    }
    const preferred = pickPreferredYgRow(existing, row);
    const mergedIds = new Set<string>([
      ...Array.from(existing._customerIds || []),
      ...(normalizeKey(row.customer_id) ? [normalizeKey(row.customer_id)] : []),
    ]);
    grouped.set(key, {
      ...preferred,
      _customerIds: mergedIds,
      company_name: buildDisplayName(preferred.company_name || existing.company_name || row.company_name),
      relation_name: buildDisplayName(preferred.relation_name || existing.relation_name || row.relation_name),
      registered_phone: buildDisplayName(preferred.registered_phone || existing.registered_phone || row.registered_phone),
      province_name: buildDisplayName(preferred.province_name || existing.province_name || row.province_name),
      region_name: buildDisplayName(preferred.region_name || existing.region_name || row.region_name),
    });
  }
  return Array.from(grouped.values());
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

function normalizeAmountText(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    const allowed = await hasPermission(session, "manageCustomers");
    if (!allowed) return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });

    const [profiles, rawYgCustomers, orders, manualRecords] = await Promise.all([
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
            customer_id: true,
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
      withPrismaRetry(() =>
        prisma.customerManualOrderRecord.findMany({
          where: { tenant_id: session.tenantId, company_id: session.companyId },
          orderBy: [{ shipped_at: "desc" }, { created_at: "desc" }],
        }),
      ),
    ]);

    const includedOrders = orders.filter((order) => !isExcludedYgName(order.company_name || order.customer_name));
    const uniqueIncludedOrderMap = new Map<string, any>();
    for (const order of includedOrders) {
      if (!uniqueIncludedOrderMap.has(order.order_no)) {
        uniqueIncludedOrderMap.set(order.order_no, order);
      }
    }
    const ordersByCustomerId = new Map<string, any[]>();
    const ordersByCompanyName = new Map<string, any[]>();
    for (const order of includedOrders) {
      const customerIdKey = normalizeKey(order.customer_id);
      if (customerIdKey) {
        const list = ordersByCustomerId.get(customerIdKey) || [];
        list.push(order);
        ordersByCustomerId.set(customerIdKey, list);
      }
      const companyNameKey = normalizeKey(order.company_name || order.customer_name);
      if (companyNameKey) {
        const list = ordersByCompanyName.get(companyNameKey) || [];
        list.push(order);
        ordersByCompanyName.set(companyNameKey, list);
      }
    }
    const orderSummaryTotals = Array.from(uniqueIncludedOrderMap.values()).reduce(
      (sum, order) => sum + Number(order.order_amount || 0),
      0,
    );

    const ygCustomers = groupYgCustomers(rawYgCustomers);
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

    function buildOrderSummary(input: { customerIds?: string[]; companyName?: string | null }) {
      const matchedMap = new Map<string, any>();

      const customerIds = Array.isArray(input.customerIds) ? input.customerIds : [];
      for (const customerId of customerIds) {
        const matches = ordersByCustomerId.get(normalizeKey(customerId)) || [];
        for (const order of matches) {
          matchedMap.set(order.order_no, order);
        }
      }

      if (matchedMap.size === 0 && normalizeKey(input.companyName)) {
        const matches = ordersByCompanyName.get(normalizeKey(input.companyName)) || [];
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
      return {
        totalOrderAmountText: totalOrderAmount.toFixed(2),
        packingAmountText: "",
        totalOrderCount: detailRows.length,
        detailRows,
      };
    }

    const manualRecordsByProfileId = new Map<string, any[]>();
    const manualRecordsByCustomerName = new Map<string, any[]>();
    for (const row of manualRecords) {
      const profileKey = normalizeKey(row.customer_profile_id);
      if (profileKey) {
        const list = manualRecordsByProfileId.get(profileKey) || [];
        list.push(row);
        manualRecordsByProfileId.set(profileKey, list);
      }
      const nameKey = normalizeKey(row.customer_name);
      if (nameKey) {
        const list = manualRecordsByCustomerName.get(nameKey) || [];
        list.push(row);
        manualRecordsByCustomerName.set(nameKey, list);
      }
    }

    function buildManualOrderSummary(input: {
      profileId?: string | null;
      companyName?: string | null;
    }) {
      const matchedMap = new Map<string, any>();
      const profileIdKey = normalizeKey(input.profileId);
      if (profileIdKey) {
        for (const row of manualRecordsByProfileId.get(profileIdKey) || []) {
          matchedMap.set(row.id, row);
        }
      }
      const companyKey = normalizeKey(input.companyName);
      if (companyKey) {
        for (const row of manualRecordsByCustomerName.get(companyKey) || []) {
          matchedMap.set(row.id, row);
        }
      }

      const rows = Array.from(matchedMap.values()).sort((left, right) => {
        const leftTime = new Date(left.shipped_at || left.created_at || 0).getTime();
        const rightTime = new Date(right.shipped_at || right.created_at || 0).getTime();
        return rightTime - leftTime;
      });
      const totalPackingAmount = rows.reduce((sum, item) => sum + Number(item.packing_amount || 0), 0);
      const unpaidAmount = rows.reduce((sum, item) => sum + (item.paid_at ? 0 : Number(item.packing_amount || 0)), 0);
      const latestTermDays = rows.find((item) => Number.isFinite(Number(item.payment_term_days)))?.payment_term_days;

      return {
        manualOrderCount: rows.length,
        manualPackingAmountText: normalizeAmountText(totalPackingAmount),
        manualDebtAmountText: normalizeAmountText(unpaidAmount),
        paymentTermText: latestTermDays ? String(latestTermDays) : "",
        manualDetailRows: rows.map((item) => ({
          id: item.id,
          customerName: item.customer_name || "",
          ygOrderNo: item.yg_order_no || "",
          externalOrderNo: item.external_order_no || "",
          orderChannel: item.order_channel || "",
          packingAmountText: normalizeAmountText(item.packing_amount || 0),
          shippedAtText: formatDateText(item.shipped_at),
          paidAtText: formatDateText(item.paid_at),
          paymentTermText: item.payment_term_days ? String(item.payment_term_days) : "",
        })),
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
      if (buildYgGroupKey(matchedYg)) {
        matchedYgCustomerKeys.add(buildYgGroupKey(matchedYg));
      }
      const orderSummary = buildOrderSummary({
        customerIds: Array.from(matchedYg?._customerIds || []),
        companyName: matchedYg?.company_name || row.name,
      });
      const manualSummary = buildManualOrderSummary({
        profileId: row.id,
        companyName: matchedYg?.company_name || row.name,
      });

      return {
        id: row.id,
        sourceType: "profile",
        name: row.name || matchedYg?.company_name || "",
        linkedYgName: matchedYg?.company_name || "",
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
        channelText: manualSummary.manualOrderCount > 0 ? "友购 / 其他渠道" : "友购",
        orderStats: String(orderSummary.totalOrderCount + manualSummary.manualOrderCount || row.order_stat_text || ""),
        totalOrderCount: orderSummary.totalOrderCount + manualSummary.manualOrderCount,
        totalOrderAmountText: orderSummary.totalOrderAmountText,
        packingAmountText: manualSummary.manualPackingAmountText !== "0.00" ? manualSummary.manualPackingAmountText : "",
        debtAmountText: manualSummary.manualDebtAmountText !== "0.00" ? manualSummary.manualDebtAmountText : "",
        paymentTermText: manualSummary.paymentTermText,
        detailRows: orderSummary.detailRows,
        manualOrderRecords: manualSummary.manualDetailRows,
      };
    });

    const manualItems = profiles
      .map((row) => ({
        id: row.id,
        sourceType: "manual",
        name: row.name || "",
        contact: row.contact_name || "",
        phone: row.mobile || "",
        whatsapp: row.whatsapp || "",
        email: row.email || "",
        stores: row.store_addresses || "",
        cityCountry: row.city_country || "",
        customerType: row.customer_type || "",
        vipLevel: row.vip_level || "",
        creditLevel: row.credit_level || "",
        tags: row.tag_text || "",
        channelText: "其他渠道",
        orderStats: row.manual_order_count ? String(row.manual_order_count) : "",
        totalOrderCount: Number(row.manual_order_count || 0),
        totalOrderAmountText: row.manual_order_amount ? Number(row.manual_order_amount).toFixed(2) : "",
        packingAmountText: row.manual_packing_amount ? Number(row.manual_packing_amount).toFixed(2) : "",
        debtAmountText: row.manual_packing_amount ? Number(row.manual_packing_amount).toFixed(2) : "",
        paymentTermText: "",
        detailRows: [],
        manualOrderRecords: [],
      }))
      .sort((left, right) => Number(right.totalOrderAmountText || 0) - Number(left.totalOrderAmountText || 0));

    const syncedOnlyRows = ygCustomers
      .filter((row) => !matchedYgCustomerKeys.has(buildYgGroupKey(row)))
      .map((row) => {
        return {
          id: `yg:${buildYgGroupKey(row)}`,
          sourceType: "yg",
          name: row.company_name || "",
          linkedYgName: row.company_name || "",
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
          channelText: "友购",
          ...(() => {
            const orderSummary = buildOrderSummary({
              customerIds: Array.from(row._customerIds || []),
              companyName: row.company_name,
            });
            const manualSummary = buildManualOrderSummary({
              companyName: row.company_name,
            });
            return {
              orderStats: String(orderSummary.totalOrderCount + manualSummary.manualOrderCount),
              totalOrderCount: orderSummary.totalOrderCount + manualSummary.manualOrderCount,
              totalOrderAmountText: orderSummary.totalOrderAmountText,
              packingAmountText: manualSummary.manualPackingAmountText !== "0.00" ? manualSummary.manualPackingAmountText : "",
              debtAmountText: manualSummary.manualDebtAmountText !== "0.00" ? manualSummary.manualDebtAmountText : "",
              paymentTermText: manualSummary.paymentTermText,
              detailRows: orderSummary.detailRows,
              manualOrderRecords: manualSummary.manualDetailRows,
            };
          })(),
        };
      });

    const seenOrderNos = new Set<string>();
    for (const row of [...profileRows, ...syncedOnlyRows]) {
      for (const detail of row.detailRows || []) {
        if (detail.orderNo) {
          seenOrderNos.add(detail.orderNo);
        }
      }
    }

    const remainingOrderGroups = new Map<string, any[]>();
    for (const order of includedOrders) {
      if (seenOrderNos.has(order.order_no)) continue;
      const groupKey =
        normalizeKey(order.customer_id)
        || normalizeKey(order.company_name || order.customer_name)
        || normalizeKey(order.order_no);
      if (!groupKey) continue;
      const list = remainingOrderGroups.get(groupKey) || [];
      list.push(order);
      remainingOrderGroups.set(groupKey, list);
    }

    const orderOnlyRows = Array.from(remainingOrderGroups.entries()).map(([groupKey, groupOrders]) => {
      const sortedOrders = [...groupOrders].sort((left, right) => {
        const leftTime = new Date(left.order_created_at || left.updated_at || 0).getTime();
        const rightTime = new Date(right.order_created_at || right.updated_at || 0).getTime();
        return rightTime - leftTime;
      });
      const detailRows = sortedOrders.map((order) => ({
        orderNo: order.order_no,
        orderDateText: formatDateText(order.order_created_at || order.updated_at),
        orderAmountText: Number(order.order_amount || 0).toFixed(2),
        latestStatus: String(order.latest_status || "").trim() || "-",
      }));
      const totalOrderAmount = detailRows.reduce((sum, item) => sum + Number(item.orderAmountText || 0), 0);

      return {
        id: `order:${groupKey}`,
        sourceType: "yg",
        name: sortedOrders[0]?.company_name || sortedOrders[0]?.customer_name || "",
        linkedYgName: sortedOrders[0]?.company_name || sortedOrders[0]?.customer_name || "",
        contact: sortedOrders[0]?.contact_name || "",
        phone: sortedOrders[0]?.contact_phone || "",
        whatsapp: "",
        email: "",
        stores: "",
        cityCountry: "",
        customerType: "",
        vipLevel: "",
        creditLevel: "",
        tags: "",
        channelText: "友购",
        orderStats: String(detailRows.length),
        totalOrderAmountText: totalOrderAmount.toFixed(2),
        packingAmountText: "",
        debtAmountText: "",
        paymentTermText: "",
        totalOrderCount: detailRows.length,
        detailRows,
        manualOrderRecords: [],
      };
    });

    const seenManualRecordIds = new Set<string>();
    for (const row of [...profileRows, ...syncedOnlyRows, ...orderOnlyRows]) {
      for (const detail of row.manualOrderRecords || []) {
        if (detail.id) {
          seenManualRecordIds.add(detail.id);
        }
      }
    }

    const manualOnlyGroups = new Map<string, any[]>();
    for (const row of manualRecords) {
      if (seenManualRecordIds.has(row.id)) continue;
      const key =
        normalizeKey(row.customer_profile_id)
        || normalizeKey(row.customer_name)
        || normalizeKey(row.external_order_no)
        || normalizeKey(row.id);
      if (!key) continue;
      const list = manualOnlyGroups.get(key) || [];
      list.push(row);
      manualOnlyGroups.set(key, list);
    }

    const manualOnlyRows = Array.from(manualOnlyGroups.entries()).map(([groupKey, rows]) => {
      const sortedRows = [...rows].sort((left, right) => {
        const leftTime = new Date(left.shipped_at || left.created_at || 0).getTime();
        const rightTime = new Date(right.shipped_at || right.created_at || 0).getTime();
        return rightTime - leftTime;
      });
      const totalPackingAmount = sortedRows.reduce((sum, item) => sum + Number(item.packing_amount || 0), 0);
      const unpaidAmount = sortedRows.reduce((sum, item) => sum + (item.paid_at ? 0 : Number(item.packing_amount || 0)), 0);
      const latestTermDays = sortedRows.find((item) => Number.isFinite(Number(item.payment_term_days)))?.payment_term_days;

      return {
        id: `manual:${groupKey}`,
        sourceType: "manual",
        name: sortedRows[0]?.customer_name || "",
        linkedYgName: "",
        contact: "",
        phone: "",
        whatsapp: "",
        email: "",
        stores: "",
        cityCountry: "",
        customerType: "",
        vipLevel: "",
        creditLevel: "",
        tags: "",
        channelText: "其他渠道",
        orderStats: String(sortedRows.length),
        totalOrderCount: sortedRows.length,
        totalOrderAmountText: "0.00",
        packingAmountText: normalizeAmountText(totalPackingAmount),
        debtAmountText: normalizeAmountText(unpaidAmount),
        paymentTermText: latestTermDays ? String(latestTermDays) : "",
        detailRows: [],
        manualOrderRecords: sortedRows.map((item) => ({
          id: item.id,
          customerName: item.customer_name || "",
          ygOrderNo: item.yg_order_no || "",
          externalOrderNo: item.external_order_no || "",
          orderChannel: item.order_channel || "",
          packingAmountText: normalizeAmountText(item.packing_amount || 0),
          shippedAtText: formatDateText(item.shipped_at),
          paidAtText: formatDateText(item.paid_at),
          paymentTermText: item.payment_term_days ? String(item.payment_term_days) : "",
        })),
      };
    });

    return NextResponse.json({
      ok: true,
      items: [...profileRows, ...syncedOnlyRows, ...orderOnlyRows, ...manualOnlyRows],
      manualItems,
      summary: {
        totalOrderCount: uniqueIncludedOrderMap.size,
        totalOrderAmountText: orderSummaryTotals.toFixed(2),
      },
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
    const sourceType = String(body.sourceType || "").trim();
    if (!name) return NextResponse.json({ ok: false, error: "客户名称必填" }, { status: 400 });

    const manualOrderCountRaw = String(body.orderStats || body.totalOrderCount || "").trim();
    const manualOrderCount = manualOrderCountRaw ? Number.parseInt(manualOrderCountRaw, 10) : null;
    const manualOrderAmountRaw = String(body.totalOrderAmountText || "").replace(/[^0-9.-]/g, "").trim();
    const manualPackingAmountRaw = String(body.packingAmountText || "").replace(/[^0-9.-]/g, "").trim();
    const manualData =
      sourceType === "manual"
        ? {
            manual_order_count: Number.isFinite(manualOrderCount as number) ? manualOrderCount : null,
            manual_order_amount: manualOrderAmountRaw ? manualOrderAmountRaw : null,
            manual_packing_amount: manualPackingAmountRaw ? manualPackingAmountRaw : null,
          }
        : {};

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
      ...manualData,
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
