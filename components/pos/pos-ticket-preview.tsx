"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { type Lang, t } from "@/lib/i18n";
import { buildBarcodeSvgMarkup } from "@/lib/pos/barcode";
import { type PosTicketDto } from "@/lib/pos/types";

type PosTicketPreviewProps = {
  lang: Lang;
  ticket: PosTicketDto;
};

function money(lang: Lang, value: number) {
  return new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function ticketLineMoney(value: number) {
  return `＄${value.toFixed(2)}`;
}

function ticketSummaryMoney(value: number) {
  return `＄ ${value.toFixed(2)} MX`;
}

function ticketDiscountLabel(line: PosTicketDto["lines"][number]) {
  if (!line.discountValue) return "-";
  if (line.discountType === "percent") return `${line.discountValue}%`;
  return ticketLineMoney(line.discountValue);
}

function dateTime(lang: Lang, value: string) {
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function PosTicketPreview({ lang, ticket }: PosTicketPreviewProps) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [ticketBarcodeSvg, setTicketBarcodeSvg] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!ticket.showQr || !ticket.qrContent) {
      setQrDataUrl("");
      return () => {
        cancelled = true;
      };
    }
    QRCode.toDataURL(ticket.qrContent, { margin: 1, width: 164 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [ticket.qrContent, ticket.showQr]);

  useEffect(() => {
    if (!ticket.showTicketBarcode || !ticket.ticketBarcodeValue) {
      setTicketBarcodeSvg("");
      return;
    }
    setTicketBarcodeSvg(
      buildBarcodeSvgMarkup(ticket.ticketBarcodeValue, {
        width: 1.2,
        height: 34,
        displayValue: true,
        margin: 0,
      }),
    );
  }, [ticket.showTicketBarcode, ticket.ticketBarcodeValue]);

  return (
    <div className="mx-auto w-full max-w-[360px] rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-slate-900 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
      <div className="text-center">
        {ticket.showLogo && ticket.logoUrl ? (
          <div className="mb-2 flex justify-center">
            <img src={ticket.logoUrl} alt={ticket.storeName} className="h-10 w-auto max-w-[120px] object-contain" />
          </div>
        ) : null}
        <div className="text-lg font-bold">{ticket.storeName}</div>
        {ticket.companyFullName ? (
          <div className="mt-1 text-xs font-medium text-slate-700">{ticket.companyFullName}</div>
        ) : null}
        {ticket.headerSubtitle ? (
          <div className="mt-1 text-xs text-slate-500">{ticket.headerSubtitle}</div>
        ) : null}
        {ticket.address ? (
          <div className="mt-3 text-xs text-slate-500">{ticket.address}</div>
        ) : null}
        {ticket.phone ? <div className="text-xs text-slate-500">{ticket.phone}</div> : null}
        {ticket.showWhatsapp && ticket.whatsapp ? (
          <div className="text-xs text-slate-500">{ticket.whatsapp}</div>
        ) : null}
        {ticket.showWebsite && ticket.website ? (
          <div className="text-xs text-slate-500">{ticket.website}</div>
        ) : null}
        {ticket.showRfc && ticket.rfc ? (
          <div className="text-xs text-slate-500">{ticket.rfc}</div>
        ) : null}
      </div>

      <div className="my-4 border-t border-dashed border-slate-300" />

      <div className="space-y-1 text-xs text-slate-600">
        <div>{t(lang, "pos.field.folio")}: {ticket.folio}</div>
        <div>{t(lang, "pos.field.datetime")}: {dateTime(lang, ticket.createdAt)}</div>
        {ticket.showCashier ? <div>{t(lang, "pos.field.cashier")}: {ticket.cashierName}</div> : null}
        {ticket.showCustomer && ticket.customerName ? <div>{t(lang, "pos.field.customer")}: {ticket.customerName}</div> : null}
      </div>

      <div className="my-4 border-t border-dashed border-slate-300" />

      <div className="space-y-3">
        {ticket.lines.map((line, index) => (
          <div key={`${line.clave}-${index}`} className="border-b border-dashed border-slate-200 pb-3 last:border-b-0 last:pb-0">
            <div className="text-[13px] font-medium text-slate-900">{line.productName}</div>
            <div className="mt-1 text-[11px] text-slate-500">
              {[line.clave, line.barcode, line.spec].filter(Boolean).join(" / ")}
            </div>
            <div className="mt-2 grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-2 text-[11px] text-slate-500">
              <div className="text-center">{t(lang, "pos.field.quantity")}: {line.qty}</div>
              <div className="text-center">{t(lang, "pos.field.unit_price")}: {ticketLineMoney(line.unitPrice)}</div>
              <div className="text-center">{t(lang, "pos.field.discount")}: {ticketDiscountLabel(line)}</div>
              <div className="text-right font-semibold text-slate-700">{ticketLineMoney(line.subtotal)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="my-4 border-t border-dashed border-slate-300" />

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between"><span className="text-slate-500">{t(lang, "pos.field.subtotal")}</span><span>{ticketSummaryMoney(ticket.subtotal)}</span></div>
        <div className="flex items-center justify-between"><span className="text-slate-500">{t(lang, "pos.field.discount")}</span><span>{ticketSummaryMoney(ticket.discountTotal)}</span></div>
        <div className="flex items-center justify-between text-base font-bold"><span>{t(lang, "pos.field.total")}</span><span>{ticketSummaryMoney(ticket.total)}</span></div>
        <div className="flex items-center justify-between"><span className="text-slate-500">{t(lang, "pos.field.payment_method")}</span><span>{ticket.paymentMethod ? t(lang, `pos.payment.${ticket.paymentMethod}`) : "-"}</span></div>
        <div className="flex items-center justify-between"><span className="text-slate-500">{t(lang, "pos.field.received_amount")}</span><span>{ticketSummaryMoney(ticket.receivedAmount)}</span></div>
        <div className="flex items-center justify-between"><span className="text-slate-500">{t(lang, "pos.field.change")}</span><span>{ticketSummaryMoney(ticket.changeAmount)}</span></div>
      </div>

      {ticket.showQr && ticket.qrContent && qrDataUrl ? (
        <>
          <div className="my-4 border-t border-dashed border-slate-300" />
          <div className="flex justify-center">
            <img src={qrDataUrl} alt="QR" className="h-28 w-28 object-contain" />
          </div>
        </>
      ) : null}

      {ticket.showTicketBarcode && ticketBarcodeSvg ? (
        <>
          <div className="my-4 border-t border-dashed border-slate-300" />
          <div className="flex justify-center">
            <div
              className="w-full max-w-[220px] overflow-hidden"
              dangerouslySetInnerHTML={{ __html: ticketBarcodeSvg }}
            />
          </div>
        </>
      ) : null}

      {ticket.footerLine1 || ticket.footerLine2 ? (
        <>
          <div className="my-4 border-t border-dashed border-slate-300" />
          <div className="space-y-1 text-center text-xs text-slate-500">
            {ticket.footerLine1 ? <div>{ticket.footerLine1}</div> : null}
            {ticket.footerLine2 ? <div>{ticket.footerLine2}</div> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
