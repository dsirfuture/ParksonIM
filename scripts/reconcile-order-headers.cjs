#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(process.cwd(), ".env"));
loadEnvFile(path.join(process.cwd(), ".env.local"));

const { PrismaClient } = require("@prisma/client");

function baseOrderNo(receiptNo) {
  const head = String(receiptNo || "").trim().split("-")[0];
  return head || String(receiptNo || "").trim();
}

function normalizeOrderKey(value) {
  return String(value || "").trim().toUpperCase();
}

function tailThree(orderNo) {
  const digits = String(orderNo || "").replace(/\D/g, "");
  return (digits.slice(-3) || "000").padStart(3, "0");
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const requestedOrderNos = process.argv.slice(2).map((item) => item.trim()).filter(Boolean);
    const receipts = await prisma.receipt.findMany({
      where: {
        status: "completed",
        ...(requestedOrderNos.length > 0
          ? {
              OR: requestedOrderNos.flatMap((orderNo) => [
                { receipt_no: orderNo },
                { receipt_no: { startsWith: `${orderNo}-` } },
              ]),
            }
          : {}),
      },
      select: {
        tenant_id: true,
        company_id: true,
        receipt_no: true,
        supplier_name: true,
        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: { updated_at: "desc" },
    });

    const grouped = new Map();
    for (const row of receipts) {
      const orderNo = baseOrderNo(row.receipt_no);
      const key = `${row.tenant_id}::${row.company_id}::${normalizeOrderKey(orderNo)}`;
      const current =
        grouped.get(key) ||
        {
          tenant_id: row.tenant_id,
          company_id: row.company_id,
          order_no: orderNo,
          suppliers: new Set(),
          item_count: 0,
        };
      if (row.supplier_name) current.suppliers.add(String(row.supplier_name).trim());
      current.item_count += Number(row._count.items || 0);
      grouped.set(key, current);
    }

    let createdCount = 0;
    for (const item of grouped.values()) {
      const existing = await prisma.ygOrderImport.findFirst({
        where: {
          tenant_id: item.tenant_id,
          company_id: item.company_id,
          order_no: item.order_no,
        },
        select: { id: true },
      });
      if (existing) continue;

      const customer = await prisma.ygCustomerImport.findFirst({
        where: {
          tenant_id: item.tenant_id,
          company_id: item.company_id,
          last_order_no: item.order_no,
        },
        orderBy: { updated_at: "desc" },
        select: {
          company_name: true,
          relation_name: true,
          registered_phone: true,
        },
      });

      await prisma.ygOrderImport.create({
        data: {
          tenant_id: item.tenant_id,
          company_id: item.company_id,
          order_no: item.order_no,
          source_file_name: "billing-auto-reconcile",
          sheet_name: "auto",
          order_amount: null,
          last_three: tailThree(item.order_no),
          company_name: customer?.company_name || null,
          customer_name: customer?.company_name || null,
          contact_name: customer?.relation_name || customer?.company_name || null,
          contact_phone: customer?.registered_phone || null,
          address_text: null,
          order_remark: null,
          store_label: null,
          supplier_count: item.suppliers.size,
          item_count: item.item_count,
          created_by: "system-reconcile",
        },
      });
      createdCount += 1;
    }

    console.log(JSON.stringify({ ok: true, receiptGroups: grouped.size, createdCount }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
