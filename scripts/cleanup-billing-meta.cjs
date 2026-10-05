#!/usr/bin/env node

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const BILLING_META_PREFIX = "[[BILLING_META]]";

function trimString(value) {
  return typeof value === "string" ? value.trim() : "";
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

function normalizeBillingHeaderMeta(value) {
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

function parseBillingRemark(raw) {
  const text = String(raw || "");
  if (!text.startsWith(BILLING_META_PREFIX)) {
    return {
      noteText: text,
      meta: normalizeBillingHeaderMeta({}),
    };
  }

  let rest = text;
  let mergedMeta = normalizeBillingHeaderMeta({});

  while (rest.startsWith(BILLING_META_PREFIX)) {
    const body = rest.slice(BILLING_META_PREFIX.length);
    const extracted = extractLeadingJsonObject(body);
    const metaJson = extracted && extracted.jsonText ? extracted.jsonText.trim() : "";
    if (!metaJson) break;

    try {
      const parsed = JSON.parse(metaJson);
      mergedMeta = {
        ...mergedMeta,
        ...normalizeBillingHeaderMeta(parsed),
      };
      rest = (extracted.restText || "").trimStart();
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

function buildBillingRemark(noteText, metaValue) {
  const meta = normalizeBillingHeaderMeta(metaValue);
  const parsed = parseBillingRemark(noteText);
  const note = trimString(parsed.noteText);
  const hasMeta = Object.values(meta).some(Boolean);

  if (!hasMeta && !note) return null;
  if (!hasMeta) return note || null;

  const payload = `${BILLING_META_PREFIX}${JSON.stringify(meta)}`;
  return note ? `${payload}\n${note}` : payload;
}

async function main() {
  const apply = process.argv.includes("--apply");

  const rows = await prisma.ygOrderImport.findMany({
    where: {
      order_remark: {
        contains: BILLING_META_PREFIX,
      },
    },
    select: {
      id: true,
      order_no: true,
      order_remark: true,
    },
    orderBy: {
      updated_at: "desc",
    },
  });

  const changes = [];

  for (const row of rows) {
    const raw = String(row.order_remark || "");
    const parsed = parseBillingRemark(raw);
    const cleaned = buildBillingRemark(parsed.noteText, parsed.meta) || null;

    if ((cleaned || "") !== raw) {
      changes.push({
        id: row.id,
        orderNo: row.order_no,
        metaCount: (raw.match(/\[\[BILLING_META\]\]/g) || []).length,
        beforeLength: raw.length,
        afterLength: (cleaned || "").length,
        cleaned,
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        scanned: rows.length,
        changed: changes.length,
        sample: changes.slice(0, 10).map((item) => ({
          orderNo: item.orderNo,
          metaCount: item.metaCount,
          beforeLength: item.beforeLength,
          afterLength: item.afterLength,
        })),
      },
      null,
      2,
    ),
  );

  if (!apply || changes.length === 0) {
    return;
  }

  for (const item of changes) {
    await prisma.ygOrderImport.update({
      where: { id: item.id },
      data: {
        order_remark: item.cleaned,
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        updated: changes.length,
        orders: changes.slice(0, 20).map((item) => item.orderNo),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
