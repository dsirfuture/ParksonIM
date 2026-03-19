// @ts-nocheck
import { AppShell } from "@/components/app-shell";
import {
  extractCustomerContactPhone,
  normalizeStoreLabelInput,
  parseBillingBooleanFlag,
  parseBillingRemark,
} from "@/lib/billing-meta";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { parseYogoDiscountNumbers } from "@/lib/yogo-product-utils";
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

const FIXED_WAREHOUSE = "PARKSONMX仓";

function toDiscountFactor(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return value > 1 ? value / 100 : value;
}

function computeLineTotal(
  qty: number,
  unitPrice: number,
  normalDiscount: number | null,
  vipDiscount: number | null,
) {
  let factor = 1;
  if (normalDiscount !== null) factor *= 1 - normalDiscount;
  if (vipDiscount !== null) factor *= 1 - vipDiscount;
  return qty * unitPrice * factor;
}

function computeLineTotalWithoutVip(
  qty: number,
  unitPrice: number,
  normalDiscount: number | null,
) {
  let factor = 1;
  if (normalDiscount !== null) factor *= 1 - normalDiscount;
  return qty * unitPrice * factor;
}

function baseOrderNo(receiptNo: string) {
  const head = String(receiptNo || "")
    .trim()
    .split("-")[0];
  return head || String(receiptNo || "").trim();
}

function normalizeLookupKey(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

function normalizeCustomerKey(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
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

  const skuList = Array.from(
    new Set(
      completedReceipts.flatMap((receipt) =>
        receipt.items
          .map((item) => String(item.sku || "").trim())
          .filter((sku) => sku.length > 0),
      ),
    ),
  );
  const barcodeList = Array.from(
    new Set(
      completedReceipts.flatMap((receipt) =>
        receipt.items
          .map((item) => String(item.barcode || "").trim())
          .filter((barcode) => barcode.length > 0),
      ),
    ),
  );

  const productDiscountRows =
    skuList.length > 0
      ? await prisma.productCatalog.findMany({
          where: {
            tenant_id: session.tenantId,
            company_id: session.companyId,
            sku: { in: skuList },
          },
          select: {
            sku: true,
            normal_discount: true,
            vip_discount: true,
          },
        })
      : [];

  const productDiscountMap = new Map<
    string,
    {
      normalDiscount: number | null;
      vipDiscount: number | null;
    }
  >(
    productDiscountRows.map((row) => [
      String(row.sku || "").trim(),
      {
        normalDiscount:
          row.normal_discount === null ? null : Number(row.normal_discount),
        vipDiscount: row.vip_discount === null ? null : Number(row.vip_discount),
      },
    ]),
  );

  const yogoDiscountRows =
    skuList.length > 0 || barcodeList.length > 0
      ? await prisma.yogoProductSource.findMany({
          where: {
            tenant_id: session.tenantId,
            company_id: session.companyId,
            OR: [
              ...(skuList.length > 0 ? [{ product_code: { in: skuList } }] : []),
              ...(barcodeList.length > 0 ? [{ product_no: { in: barcodeList } }] : []),
            ],
          },
          select: {
            product_code: true,
            product_no: true,
            category_name: true,
            source_discount: true,
            updated_at: true,
          },
          orderBy: [{ updated_at: "desc" }],
        })
      : [];

  const yogoDiscountMap = new Map<
    string,
    {
      normalDiscount: number | null;
      vipDiscount: number | null;
    }
  >();
  for (const row of yogoDiscountRows) {
    const skuKey = normalizeLookupKey(row.product_code);
    const discount = parseYogoDiscountNumbers(row.category_name, row.source_discount);
    if (skuKey && !yogoDiscountMap.has(skuKey)) {
      yogoDiscountMap.set(skuKey, {
        normalDiscount: discount.normal,
        vipDiscount: discount.vip,
      });
    }
    const barcodeKey = normalizeLookupKey((row as { product_no?: string | null }).product_no);
    if (barcodeKey && !yogoDiscountMap.has(barcodeKey)) {
      yogoDiscountMap.set(barcodeKey, {
        normalDiscount: discount.normal,
        vipDiscount: discount.vip,
      });
    }
  }

  const grouped = new Map<
    string,
    {
      orderNo: string;
      originalAmount: number;
      discountedAmount: number;
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
        originalAmount: 0,
        discountedAmount: 0,
        latestAt: null,
      } as const);

    const orderDetail = detailMap.get(orderNo) || new Map();
    let receiptOriginalAmount = 0;
    let receiptDiscountedAmount = 0;

    for (const item of receipt.items) {
      const sku = String(item.sku || "").trim();
      const barcode = String(item.barcode || "").trim();
      const qty = Number(item.expected_qty || 0);
      // Billing unit price must always come from the completed receipt's supplier price.
      // `sell_price` here is the imported 验货单“供应价”, not the product catalog selling price.
      const supplierUnitPrice = item.sell_price === null ? 0 : Number(item.sell_price);
      const catalogDiscount = productDiscountMap.get(sku);
      const yogoDiscount =
        yogoDiscountMap.get(normalizeLookupKey(sku)) ??
        yogoDiscountMap.get(normalizeLookupKey(barcode));
      const normalDiscountRaw =
        yogoDiscount?.normalDiscount ??
        catalogDiscount?.normalDiscount ??
        (item.normal_discount === null ? null : Number(item.normal_discount));
      const vipDiscountRaw =
        yogoDiscount?.vipDiscount ??
        catalogDiscount?.vipDiscount ??
        (item.vip_discount === null ? null : Number(item.vip_discount));
      const normalDiscount = toDiscountFactor(normalDiscountRaw);
      const vipDiscount = toDiscountFactor(vipDiscountRaw);
      const lineTotal = computeLineTotal(qty, supplierUnitPrice, normalDiscount, vipDiscount);
      const lineOriginalTotal = qty * supplierUnitPrice;
      const lineDiscountedTotal = computeLineTotalWithoutVip(qty, supplierUnitPrice, normalDiscount);

      receiptOriginalAmount += lineOriginalTotal;
      receiptDiscountedAmount += lineDiscountedTotal;

      const key = `${sku}|${barcode}`;
      const old = orderDetail.get(key);
      if (!old) {
        orderDetail.set(key, {
          sku,
          barcode,
          nameZh: String(item.name_zh || "").trim(),
          nameEs: String(item.name_es || "").trim(),
          qty,
          unitPrice: supplierUnitPrice,
          normalDiscount:
            normalDiscountRaw !== null && Number.isFinite(normalDiscountRaw)
              ? normalDiscountRaw
              : null,
          vipDiscount:
            vipDiscountRaw !== null && Number.isFinite(vipDiscountRaw)
              ? vipDiscountRaw
              : null,
          lineTotal,
        });
      } else {
        old.qty += qty;
        old.lineTotal += lineTotal;
        if (
          old.normalDiscount === null &&
          normalDiscountRaw !== null &&
          Number.isFinite(normalDiscountRaw)
        ) {
          old.normalDiscount = normalDiscountRaw;
        }
        if (
          old.vipDiscount === null &&
          vipDiscountRaw !== null &&
          Number.isFinite(vipDiscountRaw)
        ) {
          old.vipDiscount = vipDiscountRaw;
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
      originalAmount: row.originalAmount + receiptOriginalAmount,
      discountedAmount: row.discountedAmount + receiptDiscountedAmount,
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

  const customerMatchKeys = Array.from(
    new Set(
      ygOrders.flatMap((row) =>
        [row.customer_name, row.company_name, row.contact_name]
          .map((value) => normalizeCustomerKey(value))
          .filter(Boolean),
      ),
    ),
  );

  const customerPhoneRows =
    customerMatchKeys.length > 0
      ? await prisma.ygOrderImport.findMany({
          where: {
            tenant_id: session.tenantId,
            company_id: session.companyId,
          },
          select: {
            customer_name: true,
            company_name: true,
            contact_name: true,
            contact_phone: true,
            order_remark: true,
            updated_at: true,
          },
          orderBy: { updated_at: "desc" },
        })
      : [];

  const customerPhoneMap = new Map<string, string>();
  for (const row of customerPhoneRows) {
    const parsedCustomerRemark = parseBillingRemark(row.order_remark);
    const phone = extractCustomerContactPhone(row.contact_phone, parsedCustomerRemark.noteText);
    if (!phone) continue;
    for (const key of [row.customer_name, row.company_name, row.contact_name]
      .map((value) => normalizeCustomerKey(value))
      .filter(Boolean)) {
      if (!customerPhoneMap.has(key)) {
        customerPhoneMap.set(key, phone);
      }
    }
  }

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
      issueDateText: string;
      boxCountText: string;
      shipDateText: string;
      warehouseText: string;
      shippingMethodText: string;
      recipientNameText: string;
      recipientPhoneText: string;
      carrierCompanyText: string;
      paymentTermText: string;
      generatedAtText: string;
      generatedVipEnabled: boolean;
    }
  >();

  for (const row of ygOrders) {
    if (orderMap.has(row.order_no)) continue;
    const companyName = row.customer_name || row.company_name || "-";
    const contactName = row.contact_name || row.customer_name || row.company_name || "-";
    const parsedRemark = parseBillingRemark(row.order_remark);
    const metaPhone = String(parsedRemark.meta.recipientPhone || "").trim();
    const directCustomerPhone = extractCustomerContactPhone(
      row.contact_phone,
      parsedRemark.noteText,
    );
    const fallbackPhone =
      customerPhoneMap.get(normalizeCustomerKey(row.customer_name)) ||
      customerPhoneMap.get(normalizeCustomerKey(row.company_name)) ||
      customerPhoneMap.get(normalizeCustomerKey(row.contact_name)) ||
      "";
    const resolvedPhone = directCustomerPhone || fallbackPhone;
    orderMap.set(row.order_no, {
      id: row.id,
      companyName,
      customerName: row.customer_name || row.company_name || "",
      contactName,
      contactPhone: resolvedPhone || "-",
      addressText: row.address_text || "",
      remarkText: parsedRemark.noteText,
      storeLabelText: normalizeStoreLabelInput(row.store_label),
      issueDateText: formatDateOnly(new Date()),
      boxCountText: parsedRemark.meta.boxCount,
      shipDateText: parsedRemark.meta.shipDate,
      warehouseText: FIXED_WAREHOUSE,
      shippingMethodText: parsedRemark.meta.shippingMethod,
      recipientNameText: parsedRemark.meta.recipientName || contactName,
      recipientPhoneText: metaPhone || "",
      carrierCompanyText: parsedRemark.meta.carrierCompany,
      paymentTermText: parsedRemark.meta.paymentTerm,
      generatedAtText: parsedRemark.meta.generatedAt,
      generatedVipEnabled: parseBillingBooleanFlag(parsedRemark.meta.generatedVipEnabled),
    });
  }

  const initialRows = Array.from(grouped.values())
    .map((row) => {
      const order = orderMap.get(row.orderNo);
      const detailItems = Array.from(detailMap.get(row.orderNo)?.values() || []);
      const effectiveVipEnabled = Boolean(order?.generatedAtText && order?.generatedVipEnabled);
      const finalDiscountedAmount = detailItems.reduce((sum, item) => {
        let factor = 1;
        const normalDiscount = toDiscountFactor(item.normalDiscount);
        const vipDiscount = toDiscountFactor(item.vipDiscount);
        if (normalDiscount !== null) factor *= 1 - normalDiscount;
        if (effectiveVipEnabled && vipDiscount !== null) factor *= 1 - vipDiscount;
        return sum + Number(item.qty || 0) * Number(item.unitPrice || 0) * factor;
      }, 0);
      return {
        id: order?.id || "",
        orderNo: row.orderNo,
        companyName: order?.companyName || "-",
        customerName: order?.customerName || "",
        contactName: order?.contactName || "-",
        contactPhone: order?.contactPhone || "-",
        addressText: order?.addressText || "",
        remarkText: order?.remarkText || "",
        storeLabelText: normalizeStoreLabelInput(order?.storeLabelText || ""),
        issueDateText: formatDateOnly(new Date()),
        boxCountText: order?.boxCountText || "",
        shipDateText: order?.shipDateText || "",
        warehouseText: FIXED_WAREHOUSE,
        shippingMethodText: order?.shippingMethodText || "",
        recipientNameText: order?.recipientNameText || "",
        recipientPhoneText: order?.recipientPhoneText || "",
        carrierCompanyText: order?.carrierCompanyText || "",
        paymentTermText: order?.paymentTermText || "",
        generatedAtText: order?.generatedAtText || "",
        generatedVipEnabled: order?.generatedVipEnabled || false,
        originalAmountText: formatMoney(row.originalAmount),
        discountedAmountText: formatMoney(finalDiscountedAmount),
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
