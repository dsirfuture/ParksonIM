import { getPosSaleRecordById } from "@/lib/pos/repositories/pos-sales.repository";
import { getPosStoreSettingByStoreId } from "@/lib/pos/repositories/pos-stores.repository";
import { getPosTicketSettingByStoreId } from "@/lib/pos/repositories/pos-ticket-settings.repository";
import { mapSaleRecordToTicketDto } from "@/lib/pos/server/pos-mappers";

export async function getPosSaleTicket(params: {
  tenantId: string;
  companyId: string;
  saleId: string;
}) {
  const sale = await getPosSaleRecordById({
    tenantId: params.tenantId,
    companyId: params.companyId,
    id: params.saleId,
  });

  if (!sale) {
    throw new Error("POS_SALE_NOT_FOUND");
  }

  const [ticketSetting, storeSetting] = await Promise.all([
    getPosTicketSettingByStoreId({
      tenantId: params.tenantId,
      companyId: params.companyId,
      storeId: sale.store_id,
    }),
    getPosStoreSettingByStoreId({
      tenantId: params.tenantId,
      companyId: params.companyId,
      storeId: sale.store_id,
    }),
  ]);

  return mapSaleRecordToTicketDto({
    sale,
    ticketSetting,
    storeSetting,
  });
}
