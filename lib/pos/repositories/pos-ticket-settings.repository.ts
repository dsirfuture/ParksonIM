import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";

type TenantScope = {
  tenantId: string;
  companyId: string;
};

export async function getPosTicketSettingByStoreId(
  params: TenantScope & { storeId: string },
) {
  return withPrismaRetry(() =>
    prisma.posTicketSetting.findFirst({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
        store_id: params.storeId,
      },
    }),
  );
}

export async function listPosTicketSettings(
  params: TenantScope,
) {
  return withPrismaRetry(() =>
    prisma.posTicketSetting.findMany({
      where: {
        tenant_id: params.tenantId,
        company_id: params.companyId,
      },
      orderBy: { store_id: "asc" },
    }),
  );
}

export async function upsertPosTicketSetting(
  params: TenantScope & {
    storeId: string;
    input: {
      ticketHeaderName?: string;
      ticketHeaderSubtitle?: string;
      logoUrl?: string;
      showLogo: boolean;
      address?: string;
      phone?: string;
      whatsapp?: string;
      website?: string;
      qrContent?: string;
      rfc?: string;
      showTicketBarcode: boolean;
      showRfc: boolean;
      showWhatsapp: boolean;
      showWebsite: boolean;
      showQr: boolean;
      showCashier: boolean;
      showCustomer: boolean;
      footerLine1?: string;
      footerLine2?: string;
    };
  },
) {
  const updateData: Prisma.PosTicketSettingUncheckedUpdateInput = {
    ticket_header_name: params.input.ticketHeaderName || null,
    ticket_header_subtitle: params.input.ticketHeaderSubtitle || null,
    logo_url: params.input.logoUrl || null,
    show_logo: params.input.showLogo,
    address: params.input.address || null,
    phone: params.input.phone || null,
    whatsapp: params.input.whatsapp || null,
    website: params.input.website || null,
    qr_content: params.input.qrContent || null,
    rfc: params.input.rfc || null,
    show_ticket_barcode: params.input.showTicketBarcode,
    show_rfc: params.input.showRfc,
    show_whatsapp: params.input.showWhatsapp,
    show_website: params.input.showWebsite,
    show_qr: params.input.showQr,
    show_cashier: params.input.showCashier,
    show_customer: params.input.showCustomer,
    footer_line_1: params.input.footerLine1 || null,
    footer_line_2: params.input.footerLine2 || null,
  };

  const createData: Prisma.PosTicketSettingUncheckedCreateInput = {
    tenant_id: params.tenantId,
    company_id: params.companyId,
    store_id: params.storeId,
    ticket_header_name: params.input.ticketHeaderName || null,
    ticket_header_subtitle: params.input.ticketHeaderSubtitle || null,
    logo_url: params.input.logoUrl || null,
    show_logo: params.input.showLogo,
    address: params.input.address || null,
    phone: params.input.phone || null,
    whatsapp: params.input.whatsapp || null,
    website: params.input.website || null,
    qr_content: params.input.qrContent || null,
    rfc: params.input.rfc || null,
    show_ticket_barcode: params.input.showTicketBarcode,
    show_rfc: params.input.showRfc,
    show_whatsapp: params.input.showWhatsapp,
    show_website: params.input.showWebsite,
    show_qr: params.input.showQr,
    show_cashier: params.input.showCashier,
    show_customer: params.input.showCustomer,
    footer_line_1: params.input.footerLine1 || null,
    footer_line_2: params.input.footerLine2 || null,
  };

  return withPrismaRetry(() =>
    prisma.posTicketSetting.upsert({
      where: {
        tenant_id_company_id_store_id: {
          tenant_id: params.tenantId,
          company_id: params.companyId,
          store_id: params.storeId,
        },
      },
      update: updateData,
      create: createData,
    }),
  );
}
