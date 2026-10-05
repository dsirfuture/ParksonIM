import { prisma } from "@/lib/prisma";

function baseOrderNo(receiptNo: string) {
  const normalized = String(receiptNo || "").trim();
  if (!normalized) return "";
  return normalized.replace(/-\d+$/u, "");
}

function normalizeOrderKey(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

function tailThree(orderNo: string) {
  const digits = orderNo.replace(/\D/g, "");
  return (digits.slice(-3) || "000").padStart(3, "0");
}

export async function ensureYgOrderHeadersForOrderNos(params: {
  tenantId: string;
  companyId: string;
  orderNos: string[];
}) {
  const normalizedOrderNos = Array.from(
    new Set(
      params.orderNos
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    ),
  );
  if (normalizedOrderNos.length === 0) {
    return { createdCount: 0 };
  }

  const existingRows = await prisma.ygOrderImport.findMany({
    where: {
      tenant_id: params.tenantId,
      company_id: params.companyId,
      order_no: { in: normalizedOrderNos },
    },
    select: { order_no: true },
  });

  const existingSet = new Set(existingRows.map((row) => normalizeOrderKey(row.order_no)));
  const missingOrderNos = normalizedOrderNos.filter((item) => !existingSet.has(normalizeOrderKey(item)));
  if (missingOrderNos.length === 0) {
    return { createdCount: 0 };
  }

  const receiptWhere = missingOrderNos.flatMap((orderNo) => [
    { receipt_no: orderNo },
    { receipt_no: { startsWith: `${orderNo}-` } },
  ]);

  const [receiptRows, customerRows] = await Promise.all([
    prisma.receipt.findMany({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        status: "completed",
        OR: receiptWhere,
      },
      select: {
        receipt_no: true,
        supplier_name: true,
        updated_at: true,
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: { updated_at: "desc" },
    }),
    prisma.ygCustomerImport.findMany({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        last_order_no: { in: missingOrderNos },
      },
      select: {
        last_order_no: true,
        company_name: true,
        relation_name: true,
        registered_phone: true,
        updated_at: true,
      },
      orderBy: { updated_at: "desc" },
    }),
  ]);

  const receiptSummaryMap = new Map<
    string,
    {
      supplierSet: Set<string>;
      itemCount: number;
    }
  >();
  for (const row of receiptRows) {
    const orderNo = baseOrderNo(row.receipt_no);
    const key = normalizeOrderKey(orderNo);
    if (!key) continue;
    const current =
      receiptSummaryMap.get(key) ||
      {
        supplierSet: new Set<string>(),
        itemCount: 0,
      };
    const supplierName = String(row.supplier_name || "").trim();
    if (supplierName) {
      current.supplierSet.add(supplierName);
    }
    current.itemCount += Number(row._count.items || 0);
    receiptSummaryMap.set(key, current);
  }

  const customerMap = new Map<
    string,
    {
      companyName: string | null;
      contactName: string | null;
      contactPhone: string | null;
    }
  >();
  for (const row of customerRows) {
    const key = normalizeOrderKey(row.last_order_no);
    if (!key || customerMap.has(key)) continue;
    customerMap.set(key, {
      companyName: row.company_name?.trim() || null,
      contactName: row.relation_name?.trim() || row.company_name?.trim() || null,
      contactPhone: row.registered_phone?.trim() || null,
    });
  }

  const createData = missingOrderNos
    .filter((orderNo) => receiptSummaryMap.has(normalizeOrderKey(orderNo)))
    .map((orderNo) => {
      const key = normalizeOrderKey(orderNo);
      const receiptSummary = receiptSummaryMap.get(key)!;
      const customer = customerMap.get(key);
      return {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        order_no: orderNo,
        source_file_name: "billing-auto-reconcile",
        sheet_name: "auto",
        order_amount: null,
        last_three: tailThree(orderNo),
        company_name: customer?.companyName || null,
        customer_name: customer?.companyName || null,
        contact_name: customer?.contactName || null,
        contact_phone: customer?.contactPhone || null,
        address_text: null,
        order_remark: null,
        store_label: null,
        supplier_count: receiptSummary.supplierSet.size,
        item_count: receiptSummary.itemCount,
        created_by: "system-reconcile",
      };
    });

  if (createData.length === 0) {
    return { createdCount: 0 };
  }

  const result = await prisma.ygOrderImport.createMany({
    data: createData,
    skipDuplicates: true,
  });

  return { createdCount: result.count };
}
