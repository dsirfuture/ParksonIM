import { notFound } from "next/navigation";
import { getLang } from "@/lib/i18n-server";
import { getReceiptScanStateByPublicShareId } from "@/lib/receipts/scan-state";
import { getMobileReceiptI18n, resolveLang } from "@/lib/mobile-receipt-i18n";
import { MobileScanClient } from "./MobileScanClient";

type PageProps = {
  params: Promise<{
    publicShareId: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PublicReceiptMobileScanPage({
  params,
  searchParams,
}: PageProps) {
  const { publicShareId } = await params;
  const cookieLang = await getLang();
  const query = (await searchParams) || {};
  const queryLang = Array.isArray(query.lang) ? query.lang[0] : query.lang;
  const lang = resolveLang(queryLang, cookieLang);
  const state = await getReceiptScanStateByPublicShareId({
    publicShareId,
    lang,
  });

  if (!state) {
    notFound();
  }

  const text = getMobileReceiptI18n(lang);
  const search = `?lang=${lang}`;

  return (
    <MobileScanClient
      lang={lang}
      receiptNo={state.receiptNo}
      supplierName={state.supplierName}
      inspectedAtText={state.inspectedAtText}
      rows={state.rows.map((row) => ({
        id: row.id,
        sku: row.sku,
        barcode: row.barcode,
        casePack: row.casePack,
        expectedQty: row.expectedQty,
        goodQty: row.goodQty,
        excessQty: row.excessQty,
        uncheckedQty: row.uncheckedQty,
        status: row.status,
        unexpected: row.unexpected,
      }))}
      initialSummary={state.summary}
      receiptLocked={state.receiptLocked}
      receiptStatus={state.receiptStatus}
      initialNextReceipt={state.nextReceipt}
      stateEndpoint={`/api/public/receipts/${publicShareId}/scan-state${search}`}
      scanEndpoint={`/api/public/receipts/${publicShareId}/scan${search}`}
      evidenceEndpoint={`/api/public/receipts/${publicShareId}/evidence${search}`}
      completeEndpoint={`/api/public/receipts/${publicShareId}/complete${search}`}
      text={text}
    />
  );
}
