import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp"];

function norm(value) {
  return String(value || "").trim();
}

async function hasImage(baseDir, key) {
  for (const ext of IMAGE_EXTS) {
    const fullPath = path.join(baseDir, `${key}.${ext}`);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      // continue
    }
  }
  return false;
}

async function main() {
  const baseDir = path.join(process.cwd(), "public", "products");

  const [ygItems, receiptItems] = await Promise.all([
    prisma.ygSupplierOrderItemS.findMany({
      select: { item_no: true, barcode: true },
    }),
    prisma.receiptItem.findMany({
      select: { sku: true, barcode: true },
    }),
  ]);

  const usage = new Map();
  for (const row of ygItems) {
    for (const key of [norm(row.item_no), norm(row.barcode)]) {
      if (!key) continue;
      usage.set(key, (usage.get(key) || 0) + 1);
    }
  }
  for (const row of receiptItems) {
    for (const key of [norm(row.sku), norm(row.barcode)]) {
      if (!key) continue;
      usage.set(key, (usage.get(key) || 0) + 1);
    }
  }

  const allKeys = [...usage.keys()].sort();
  const missing = [];
  for (const key of allKeys) {
    if (!(await hasImage(baseDir, key))) {
      missing.push({ key, count: usage.get(key) || 0 });
    }
  }

  missing.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

  console.log(`Total keys: ${allKeys.length}`);
  console.log(`Missing images: ${missing.length}`);
  if (missing.length > 0) {
    console.log("Top missing:");
    for (const row of missing.slice(0, 50)) {
      console.log(`${row.key}, used ${row.count}`);
    }
  }

  const outDir = path.join(process.cwd(), "tmp");
  await fs.mkdir(outDir, { recursive: true });
  const csv = [
    "key,usage_count",
    ...missing.map((row) => `${JSON.stringify(row.key)},${row.count}`),
  ].join("\n");
  const outPath = path.join(outDir, "missing-product-images.csv");
  await fs.writeFile(outPath, csv, "utf8");
  console.log(`CSV written: ${outPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
