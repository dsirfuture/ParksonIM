import { mapPosProductRow } from "@/lib/pos/server/pos-mappers";
import {
  findPosProductRowByBarcode,
  findPosProductRowByClave,
  listPosPrimaryCategoryRows,
  listPosProductRows,
  searchPosProductRows,
} from "@/lib/pos/repositories/pos-products.repository";

type TenantScope = {
  tenantId: string;
  companyId: string;
};

export async function listPosProducts(params: TenantScope & { storeId?: string | null; take?: number; includeYogo?: boolean; category?: string | null }) {
  const rows = await listPosProductRows(params);
  return rows.map(mapPosProductRow);
}

export async function searchPosProducts(params: TenantScope & { storeId?: string | null; q: string; take?: number; includeYogo?: boolean }) {
  const rows = await searchPosProductRows(params);
  return rows.map(mapPosProductRow);
}

export async function getPosProductByBarcode(params: TenantScope & { storeId?: string | null; barcode: string; includeYogo?: boolean }) {
  const row = await findPosProductRowByBarcode(params);
  return row ? mapPosProductRow(row) : null;
}

export async function getPosProductByClave(params: TenantScope & { storeId?: string | null; clave: string; includeYogo?: boolean }) {
  const row = await findPosProductRowByClave(params);
  return row ? mapPosProductRow(row) : null;
}

export async function listPosPrimaryCategories(params: TenantScope & { storeId?: string | null; includeYogo?: boolean }) {
  return listPosPrimaryCategoryRows(params);
}
