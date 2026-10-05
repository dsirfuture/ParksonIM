import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";
import {
  createPosInventoryMovements,
  findPosProductForImport,
  getPosStoreInventoryRows,
  listKnownPosStoreIds,
  upsertAndIncrementPosStoreInventory,
} from "@/lib/pos/repositories/pos-inventory.repository";
import {
  type PosInventoryImportCommitResult,
  type PosInventoryImportPreviewItem,
  type PosInventoryImportPreviewResult,
  type PosInventoryImportRowInput,
} from "@/lib/pos/types";

type TenantScope = {
  tenantId: string;
  companyId: string;
};

function cleanText(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function normalizeQty(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.trunc(parsed);
}

function normalizeImportRows(rows: PosInventoryImportRowInput[]) {
  return rows.map((row, index) => ({
    rowNumber: index + 2,
    storeId: cleanText(row.storeId),
    clave: cleanText(row.clave),
    barcode: cleanText(row.barcode),
    qty: normalizeQty(row.qty),
    note: cleanText(row.note),
  }));
}

export async function buildPosInventoryImportTemplate(params?: {
  storeId?: string;
}) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("IMPORT");
  worksheet.columns = [
    { header: "TIENDA", key: "storeId", width: 20 },
    { header: "CLAVE", key: "clave", width: 20 },
    { header: "COD. BARRAS", key: "barcode", width: 22 },
    { header: "CANT.", key: "qty", width: 12 },
    { header: "OBS.", key: "note", width: 28 },
  ];

  worksheet.addRow({
    storeId: cleanText(params?.storeId) || "store-demo-001",
    clave: "DST-300003",
    barcode: "6925103000037",
    qty: 10,
    note: "IMPORTACION INICIAL",
  });

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function previewPosInventoryImport(
  params: TenantScope & {
    rows: PosInventoryImportRowInput[];
  },
): Promise<PosInventoryImportPreviewResult> {
  const normalizedRows = normalizeImportRows(params.rows || []);
  if (!normalizedRows.length) {
    return {
      items: [],
      total: 0,
      importableCount: 0,
      invalidCount: 0,
    };
  }

  const knownStores = new Set(await listKnownPosStoreIds(params));

  const previewItems: PosInventoryImportPreviewItem[] = [];
  const matchedRows: Array<PosInventoryImportPreviewItem & { productId: string }> = [];

  for (const row of normalizedRows) {
    if (!row.storeId || !knownStores.has(row.storeId)) {
      previewItems.push({
        ...row,
        canImport: false,
        status: "store_not_found",
        reason: "POS_IMPORT_STORE_NOT_FOUND",
      });
      continue;
    }

    if (!row.clave && !row.barcode) {
      previewItems.push({
        ...row,
        canImport: false,
        status: "identifier_missing",
        reason: "POS_IMPORT_IDENTIFIER_REQUIRED",
      });
      continue;
    }

    if (!Number.isFinite(row.qty) || row.qty <= 0) {
      previewItems.push({
        ...row,
        canImport: false,
        status: "qty_invalid",
        reason: "POS_IMPORT_QTY_INVALID",
      });
      continue;
    }

    const matched = await findPosProductForImport({
      tenantId: params.tenantId,
      companyId: params.companyId,
      storeId: row.storeId,
      clave: row.clave,
      barcode: row.barcode,
    });

    if (!matched) {
      previewItems.push({
        ...row,
        canImport: false,
        status: "product_not_found",
        reason: "POS_IMPORT_PRODUCT_NOT_FOUND",
      });
      continue;
    }

    if (matched.status === "mismatch") {
      previewItems.push({
        ...row,
        canImport: false,
        status: "product_mismatch",
        reason: "POS_IMPORT_PRODUCT_MISMATCH",
      });
      continue;
    }

    const item: PosInventoryImportPreviewItem & { productId: string } = {
      ...row,
      productId: matched.productId,
      productName: matched.productName,
      canImport: true,
      status: "ready",
      reason: "POS_IMPORT_READY",
    };
    previewItems.push(item);
    matchedRows.push(item);
  }

  const seenKeys = new Set<string>();
  for (const item of previewItems) {
    if (!item.canImport || !item.productId) continue;
    const duplicateKey = `${item.storeId}::${item.productId}`;
    if (seenKeys.has(duplicateKey)) {
      item.canImport = false;
      item.status = "duplicate";
      item.reason = "POS_IMPORT_DUPLICATE_ROW";
      continue;
    }
    seenKeys.add(duplicateKey);
  }

  const inventoryLookups = new Map<string, number>();
  const grouped = new Map<string, string[]>();
  for (const item of previewItems) {
    if (!item.canImport || !item.productId) continue;
    const list = grouped.get(item.storeId) || [];
    list.push(item.productId);
    grouped.set(item.storeId, list);
  }

  await Promise.all(
    Array.from(grouped.entries()).map(async ([storeId, productIds]) => {
      const rows = await getPosStoreInventoryRows({
        tenantId: params.tenantId,
        companyId: params.companyId,
        storeId,
        productIds,
      }) as Array<{ store_id: string; product_id: string; on_hand_qty: number }>;
      for (const row of rows) {
        inventoryLookups.set(`${row.store_id}::${row.product_id}`, row.on_hand_qty);
      }
    }),
  );

  for (const item of previewItems) {
    if (!item.productId) continue;
    item.currentQty = inventoryLookups.get(`${item.storeId}::${item.productId}`) || 0;
  }

  return {
    items: previewItems,
    total: previewItems.length,
    importableCount: previewItems.filter((item) => item.canImport).length,
    invalidCount: previewItems.filter((item) => !item.canImport).length,
  };
}

export async function commitPosInventoryImport(
  params: TenantScope & {
    rows: PosInventoryImportRowInput[];
    operator?: string;
  },
): Promise<PosInventoryImportCommitResult> {
  const preview = await previewPosInventoryImport(params);
  if (!preview.items.length) {
    throw new Error("POS_IMPORT_EMPTY_ROWS");
  }
  if (preview.items.some((item) => !item.canImport || !item.productId)) {
    const error = new Error("POS_IMPORT_PREVIEW_INVALID");
    (error as Error & { preview?: PosInventoryImportPreviewResult }).preview = preview;
    throw error;
  }

  return withPrismaRetry(async () =>
    prisma.$transaction(async (tx) => {
      const items: PosInventoryImportCommitResult["items"] = [];
      const movementItems = [];

      for (const row of preview.items as Array<PosInventoryImportPreviewItem & { productId: string }>) {
        const productId = row.productId!;
        const existingRows = await getPosStoreInventoryRows({
          tenantId: params.tenantId,
          companyId: params.companyId,
          storeId: row.storeId,
          productIds: [productId],
        }, tx) as Array<{ id: string; on_hand_qty: number }>;
        const existing = existingRows[0] || null;
        const qtyBefore = existing?.on_hand_qty || 0;

        const updated = await upsertAndIncrementPosStoreInventory({
          tenantId: params.tenantId,
          companyId: params.companyId,
          storeId: row.storeId,
          productId,
          qtyChange: row.qty,
        }, tx);

        movementItems.push({
          storeId: row.storeId,
          productId,
          moveType: "import",
          qtyChange: row.qty,
          qtyBefore,
          qtyAfter: updated.on_hand_qty,
          sourceType: "import",
          sourceId: updated.id,
          sourceFolio: null,
          note: row.note || null,
          createdBy: cleanText(params.operator) || null,
        });

        items.push({
          rowNumber: row.rowNumber,
          storeId: row.storeId,
          productId,
          productName: row.productName || row.clave || row.barcode,
          qtyChange: row.qty,
          qtyBefore,
          qtyAfter: updated.on_hand_qty,
        });
      }

      await createPosInventoryMovements({
        tenantId: params.tenantId,
        companyId: params.companyId,
        items: movementItems,
      }, tx);

      return {
        totalRows: preview.total,
        importedCount: items.length,
        items,
      };
    }),
  );
}
