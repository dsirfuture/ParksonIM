import { getPosStore, listPosStores } from "@/lib/pos/server/pos-stores.server";
import { getPosTicketSettingByStoreId, listPosTicketSettings, upsertPosTicketSetting } from "@/lib/pos/repositories/pos-ticket-settings.repository";
import { upsertPosStoreSetting } from "@/lib/pos/repositories/pos-stores.repository";
import { type PosTicketSettingConfig, type PosTicketSettingInput } from "@/lib/pos/types";

function cleanText(value: string | null | undefined) {
  return value?.trim() || "";
}

function mapTicketSettingRow(
  row: {
    id: string;
    store_id: string;
    ticket_header_name: string | null;
    ticket_header_subtitle: string | null;
    logo_url: string | null;
    show_logo: boolean;
    address: string | null;
    phone: string | null;
    whatsapp: string | null;
    website: string | null;
    qr_content: string | null;
    rfc: string | null;
    show_ticket_barcode: boolean;
    show_rfc: boolean;
    show_whatsapp: boolean;
    show_website: boolean;
    show_qr: boolean;
    show_cashier: boolean;
    show_customer: boolean;
    footer_line_1: string | null;
    footer_line_2: string | null;
    updated_at: Date;
  } | null,
  fallback: {
    storeId: string;
    companyFullName: string;
    defaultTicketHeader: string;
    ticketSubtitle: string;
    address: string;
    phone: string;
    rfc: string;
  },
): PosTicketSettingConfig {
  return {
    id: row?.id || `virtual:${fallback.storeId}`,
    storeId: fallback.storeId,
    ticketHeaderName: cleanText(row?.ticket_header_name) || fallback.defaultTicketHeader,
    ticketHeaderSubtitle: cleanText(row?.ticket_header_subtitle) || fallback.ticketSubtitle,
    companyFullName: fallback.companyFullName,
    logoUrl: cleanText(row?.logo_url),
    showLogo: row?.show_logo ?? false,
    address: cleanText(row?.address) || fallback.address,
    phone: cleanText(row?.phone) || fallback.phone,
    whatsapp: cleanText(row?.whatsapp),
    website: cleanText(row?.website),
    qrContent: cleanText(row?.qr_content),
    rfc: cleanText(row?.rfc) || fallback.rfc,
    showTicketBarcode: row?.show_ticket_barcode ?? false,
    showRfc: row?.show_rfc ?? false,
    showWhatsapp: row?.show_whatsapp ?? false,
    showWebsite: row?.show_website ?? false,
    showQr: row?.show_qr ?? false,
    showCashier: row?.show_cashier ?? true,
    showCustomer: row?.show_customer ?? true,
    footerLine1: cleanText(row?.footer_line_1),
    footerLine2: cleanText(row?.footer_line_2),
    updatedAt: (row?.updated_at || new Date(0)).toISOString(),
  };
}

function normalizeTicketInput(input: PosTicketSettingInput) {
  return {
    ticketHeaderName: cleanText(input.ticketHeaderName),
    ticketHeaderSubtitle: cleanText(input.ticketHeaderSubtitle),
    companyFullName: cleanText(input.companyFullName),
    logoUrl: cleanText(input.logoUrl),
    showLogo: Boolean(input.showLogo),
    address: cleanText(input.address),
    phone: cleanText(input.phone),
    whatsapp: cleanText(input.whatsapp),
    website: cleanText(input.website),
    qrContent: cleanText(input.qrContent),
    rfc: cleanText(input.rfc),
    showTicketBarcode: Boolean(input.showTicketBarcode),
    showRfc: Boolean(input.showRfc),
    showWhatsapp: Boolean(input.showWhatsapp),
    showWebsite: Boolean(input.showWebsite),
    showQr: Boolean(input.showQr),
    showCashier: input.showCashier !== false,
    showCustomer: input.showCustomer !== false,
    footerLine1: cleanText(input.footerLine1),
    footerLine2: cleanText(input.footerLine2),
  };
}

async function fallbackStore(
  params: { tenantId: string; companyId: string; storeId: string },
) {
  const store = await getPosStore(params);
  return {
    storeId: store.storeId,
    companyFullName: store.companyFullName,
    defaultTicketHeader: store.defaultTicketHeader,
    ticketSubtitle: store.ticketSubtitle,
    address: store.address,
    phone: store.phone,
    rfc: store.rfc,
  };
}

export async function listPosTicketConfigs(params: {
  tenantId: string;
  companyId: string;
  scopeStoreId?: string;
}) {
  const [rows, stores] = await Promise.all([
    listPosTicketSettings(params),
    params.scopeStoreId
      ? [await getPosStore({ tenantId: params.tenantId, companyId: params.companyId, storeId: params.scopeStoreId })]
      : listPosStores({ tenantId: params.tenantId, companyId: params.companyId }),
  ]);
  const rowMap = new Map(rows.map((row) => [row.store_id, row]));
  return stores.map((store) =>
    mapTicketSettingRow(rowMap.get(store.storeId) as any, {
      storeId: store.storeId,
      companyFullName: store.companyFullName,
      defaultTicketHeader: store.defaultTicketHeader,
      ticketSubtitle: store.ticketSubtitle,
      address: store.address,
      phone: store.phone,
      rfc: store.rfc,
    }),
  );
}

export async function getPosTicketConfig(params: { tenantId: string; companyId: string; storeId: string }) {
  const [row, fallback] = await Promise.all([
    getPosTicketSettingByStoreId(params),
    fallbackStore(params),
  ]);
  return mapTicketSettingRow(row as any, fallback);
}

export async function savePosTicketConfig(params: {
  tenantId: string;
  companyId: string;
  storeId: string;
  input: PosTicketSettingInput;
}) {
  const normalized = normalizeTicketInput(params.input);
  if (params.input.companyFullName !== undefined) {
    const store = await getPosStore(params);
    await upsertPosStoreSetting({
      tenantId: params.tenantId,
      companyId: params.companyId,
      storeId: params.storeId,
      input: {
        storeName: store.storeName,
        companyFullName: normalized.companyFullName,
        storeCode: store.storeCode,
        address: store.address,
        phone: store.phone,
        rfc: store.rfc,
        active: store.active,
        defaultTicketHeader: store.defaultTicketHeader,
        ticketSubtitle: store.ticketSubtitle,
      },
    });
  }
  const row = await upsertPosTicketSetting({
    tenantId: params.tenantId,
    companyId: params.companyId,
    storeId: params.storeId,
    input: normalized,
  });
  const fallback = await fallbackStore(params);
  return mapTicketSettingRow(row as any, fallback);
}
