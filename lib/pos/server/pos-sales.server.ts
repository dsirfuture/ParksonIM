import { getPosSaleRecordById, getPosSaleSourceFolioMap, listPosSaleRecords } from "@/lib/pos/repositories/pos-sales.repository";
import { mapSaleRecordToListItem } from "@/lib/pos/server/pos-mappers";
import { type PosSaleQuery } from "@/lib/pos/types";

async function attachSourceFolios(
  params: {
    tenantId: string;
    companyId: string;
  },
  rows: Array<{
    source_type: string;
    source_id: string | null;
  }>,
): Promise<{ suspended: Map<string, string>; quote: Map<string, string> }> {
  const suspendedIds = rows.filter((item) => item.source_type === "suspended" && item.source_id).map((item) => String(item.source_id));
  const quoteIds = rows.filter((item) => item.source_type === "quote" && item.source_id).map((item) => String(item.source_id));
  return getPosSaleSourceFolioMap({
    tenantId: params.tenantId,
    companyId: params.companyId,
    suspendedIds,
    quoteIds,
  });
}

export async function listPosSales(params: {
  tenantId: string;
  companyId: string;
  storeId?: string;
  take?: number;
  query?: PosSaleQuery;
}) {
  const rows = await listPosSaleRecords(params);
  const sourceFolios = await attachSourceFolios(params, rows);
  return rows.map((row) => {
    const item = mapSaleRecordToListItem(row);
    if (row.source_type === "suspended" && row.source_id) {
      item.sourceFolio = sourceFolios.suspended.get(String(row.source_id)) || undefined;
    }
    if (row.source_type === "quote" && row.source_id) {
      item.sourceFolio = sourceFolios.quote.get(String(row.source_id)) || undefined;
    }
    return item;
  });
}

export async function getPosSaleDetail(params: {
  tenantId: string;
  companyId: string;
  id: string;
}) {
  const row = await getPosSaleRecordById(params);
  if (!row) {
    throw new Error("POS_SALE_NOT_FOUND");
  }
  const sourceFolios = await attachSourceFolios(params, [row]);
  const item = mapSaleRecordToListItem(row);
  if (row.source_type === "suspended" && row.source_id) {
    item.sourceFolio = sourceFolios.suspended.get(String(row.source_id)) || undefined;
  }
  if (row.source_type === "quote" && row.source_id) {
    item.sourceFolio = sourceFolios.quote.get(String(row.source_id)) || undefined;
  }
  return item;
}
