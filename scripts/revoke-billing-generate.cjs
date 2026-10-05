#!/usr/bin/env node

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const BILLING_META_PREFIX = "[[BILLING_META]]";

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeMeta(value) {
  const source = value || {};
  return {
    issueDate: trimString(source.issueDate),
    boxCount: trimString(source.boxCount),
    shipDate: trimString(source.shipDate),
    warehouse: trimString(source.warehouse),
    shippingMethod: trimString(source.shippingMethod),
    recipientName: trimString(source.recipientName),
    recipientPhone: trimString(source.recipientPhone),
    carrierCompany: trimString(source.carrierCompany),
    paymentTerm: trimString(source.paymentTerm),
    generatedAt: trimString(source.generatedAt),
    generatedVipEnabled: trimString(source.generatedVipEnabled),
    revokeReason: trimString(source.revokeReason),
    paidAt: trimString(source.paidAt),
    billingSnapshot: trimString(source.billingSnapshot),
  };
}

function extractLeadingJsonObject(text) {
  const source = String(text || "").trimStart();
  if (!source.startsWith("{")) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          jsonText: source.slice(0, index + 1),
          restText: source.slice(index + 1),
        };
      }
    }
  }

  return null;
}

function parseRemark(raw) {
  const text = String(raw || "");
  if (!text.startsWith(BILLING_META_PREFIX)) {
    return {
      noteText: text,
      meta: normalizeMeta({}),
    };
  }

  let rest = text;
  let mergedMeta = normalizeMeta({});

  while (rest.startsWith(BILLING_META_PREFIX)) {
    const body = rest.slice(BILLING_META_PREFIX.length);
    const extracted = extractLeadingJsonObject(body);
    const metaJson = extracted?.jsonText?.trim() || "";
    if (!metaJson) break;

    try {
      const parsed = JSON.parse(metaJson);
      mergedMeta = {
        ...mergedMeta,
        ...normalizeMeta(parsed),
      };
      rest = (extracted?.restText || "").trimStart();
    } catch {
      break;
    }
  }

  const noteText = rest.replace(/^\s*\+\s*/u, "").trim();
  return {
    noteText,
    meta: mergedMeta,
  };
}

function buildRemark(noteText, metaValue) {
  const meta = normalizeMeta(metaValue);
  const note = trimString(parseRemark(noteText).noteText);
  const hasMeta = Object.values(meta).some(Boolean);

  if (!hasMeta && !note) return null;
  if (!hasMeta) return note || null;

  const payload = `${BILLING_META_PREFIX}${JSON.stringify(meta)}`;
  return note ? `${payload}\n${note}` : payload;
}

async function main() {
  const orderNos = process.argv.slice(2).filter(Boolean);
  if (orderNos.length === 0) {
    throw new Error("请传入至少一个订单号");
  }

  const rows = await prisma.ygOrderImport.findMany({
    where: {
      order_no: { in: orderNos },
    },
    select: {
      id: true,
      order_no: true,
      order_remark: true,
    },
  });

  const updated = [];

  for (const row of rows) {
    const parsed = parseRemark(row.order_remark);
    const nextMeta = {
      ...parsed.meta,
      generatedAt: "",
      generatedVipEnabled: "",
      revokeReason: "脚本撤销自动生成",
      paidAt: "",
      billingSnapshot: "",
    };
    const nextRemark = buildRemark(parsed.noteText, nextMeta);
    await prisma.ygOrderImport.update({
      where: { id: row.id },
      data: {
        order_remark: nextRemark,
      },
    });
    updated.push({
      orderNo: row.order_no,
      changed: true,
    });
  }

  console.log(JSON.stringify({ ok: true, updated }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
