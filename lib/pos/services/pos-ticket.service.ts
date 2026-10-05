import { getPosDataMode } from "@/lib/pos/services/pos-data-mode";
import { getSales, getPosMemoryStore } from "@/lib/pos/mock/pos-memory-store";
import { type Lang, t } from "@/lib/i18n";
import { type PosTicketDto } from "@/lib/pos/types";
import { buildBarcodeSvgMarkup } from "@/lib/pos/barcode";
import QRCode from "qrcode";

async function safeJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`HTTP_${response.status}::${text.slice(0, 160)}`);
  }
}

async function fetchJson<T>(input: RequestInfo | URL): Promise<T> {
  const response = await fetch(input, {
    method: "GET",
    cache: "no-store",
  });
  const payload = await safeJson(response);
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `HTTP_${response.status}`);
  }
  return payload as T;
}

export async function getPosSaleTicketService(saleId: string): Promise<PosTicketDto> {
  if (getPosDataMode() === "mock") {
    const sale = getSales().find((item) => item.id === saleId);
    if (!sale) throw new Error("POS_SALE_NOT_FOUND");
    const storeContext = getPosMemoryStore().storeContext;
    return {
      saleId: sale.id,
      folio: sale.folio,
      createdAt: sale.createdAt,
      storeName: storeContext.storeName,
      companyFullName: "",
      logoUrl: "",
      showLogo: false,
      headerSubtitle: "",
      address: "",
      phone: "",
      whatsapp: "",
      website: "",
      qrContent: "",
      rfc: "",
      showRfc: false,
      ticketBarcodeValue: sale.folio,
      showTicketBarcode: false,
      showWhatsapp: false,
      showWebsite: false,
      showQr: false,
      showCashier: true,
      showCustomer: true,
      cashierName: sale.cashierName,
      customerName: sale.customer.name,
      paymentMethod: sale.paymentMethod,
      receivedAmount: sale.receivedAmount,
      changeAmount: sale.changeAmount,
      subtotal: sale.subtotal,
      discountTotal: sale.discountTotal,
      total: sale.total,
      lines: sale.lines.map((line) => ({
        productName: line.nameCn || line.nameEs || line.clave,
        clave: line.clave,
        barcode: line.barcode,
        spec: line.spec,
        qty: line.qty,
        unitPrice: line.unitPrice,
        discountType: line.lineDiscount?.type || null,
        discountValue: line.lineDiscount?.value || 0,
        subtotal: line.subtotal,
      })),
      footerLine1: "",
      footerLine2: "",
    };
  }
  const payload = await fetchJson<{ ok: true; item: PosTicketDto }>(`/api/pos/sales/${encodeURIComponent(saleId)}/ticket`);
  return payload.item;
}

function lineLabel(line: PosTicketDto["lines"][number]) {
  return [line.productName, line.spec].filter(Boolean).join(" / ");
}

function paymentLabel(lang: Lang, paymentMethod: PosTicketDto["paymentMethod"]) {
  if (paymentMethod === "cash") return t(lang, "pos.payment.cash");
  if (paymentMethod === "transfer") return t(lang, "pos.payment.transfer");
  if (paymentMethod === "card") return t(lang, "pos.payment.card");
  return "-";
}

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

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

async function qrMarkup(ticket: PosTicketDto) {
  if (!ticket.showQr || !ticket.qrContent) return "";
  const src = await QRCode.toDataURL(ticket.qrContent, { margin: 1, width: 160 });
  return `
    <div class="line"></div>
    <div class="center qr-wrap"><img class="qr" src="${src}" alt="QR" /></div>
  `;
}

function ticketBarcodeMarkup(ticket: PosTicketDto) {
  if (!ticket.showTicketBarcode || !ticket.ticketBarcodeValue) return "";
  return `
    <div class="line"></div>
    <div class="center barcode-wrap">
      ${buildBarcodeSvgMarkup(ticket.ticketBarcodeValue, { width: 1.2, height: 34, displayValue: true, margin: 0 })}
    </div>
  `;
}

export async function printPosTicket(ticket: PosTicketDto, lang: Lang, popup?: Window | null) {
  const targetWindow = popup || window.open("", "_blank", "width=420,height=840");
  if (!targetWindow) throw new Error("PRINT_WINDOW_BLOCKED");
  const qrBlock = await qrMarkup(ticket);
  const ticketBarcodeBlock = ticketBarcodeMarkup(ticket);

  const rows = ticket.lines.map((line) => `
    <tr>
      <td class="name">
        <div class="title">${esc(lineLabel(line))}</div>
        <div class="meta">${esc(line.clave || "")}${line.barcode ? ` / ${esc(line.barcode)}` : ""}</div>
      </td>
      <td class="num">${line.qty}</td>
      <td class="num">${esc(ticketLineMoney(line.unitPrice))}</td>
      <td class="num">${esc(ticketDiscountLabel(line))}</td>
      <td class="num subtotal">${esc(ticketLineMoney(line.subtotal))}</td>
    </tr>
  `).join("");

  targetWindow.document.write(`<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${esc(ticket.folio)}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; color: #0f172a; }
        .wrap { width: 360px; margin: 0 auto; padding: 16px 14px 24px; }
        .center { text-align: center; }
        .title { font-size: 18px; font-weight: 700; line-height: 1.35; }
        .sub { font-size: 12px; color: #475569; margin-top: 4px; }
        .muted { font-size: 11px; color: #64748b; }
        .block { margin-top: 12px; }
        .line { border-top: 1px dashed #94a3b8; margin: 12px 0; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td { padding: 6px 0; vertical-align: top; font-size: 12px; }
        th { color: #475569; text-align: center; }
        th.name-head { width: 48%; text-align: left; }
        th.qty-head, th.price-head, th.discount-head, th.subtotal-head { width: 13%; }
        .name { width: 48%; padding-right: 8px; }
        .num { text-align: center; white-space: nowrap; }
        .subtotal { text-align: right; }
        td.name .title { font-size: 13px; font-weight: 500; line-height: 1.35; }
        .meta { color: #64748b; font-size: 11px; margin-top: 2px; }
        .sum-row { display:flex; justify-content:space-between; padding:4px 0; font-size:12px; }
        .sum-row.total { font-size:14px; font-weight:700; }
        .qr-wrap { margin-top: 8px; }
        .qr { width: 112px; height: 112px; object-fit: contain; }
        .logo-wrap { margin-bottom: 8px; }
        .logo { max-width: 112px; max-height: 40px; object-fit: contain; }
        .barcode-wrap { margin-top: 8px; }
        .barcode-wrap svg { width: 100%; max-width: 220px; height: auto; }
        @media print {
          html, body { width: 80mm; }
          .wrap { width: auto; margin: 0; padding: 6mm; }
        }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="center">
          ${ticket.showLogo && ticket.logoUrl ? `<div class="logo-wrap"><img class="logo" src="${ticket.logoUrl}" alt="${esc(ticket.storeName)}" /></div>` : ""}
          <div class="title">${esc(ticket.storeName)}</div>
          ${ticket.headerSubtitle ? `<div class="sub">${esc(ticket.headerSubtitle)}</div>` : ""}
          ${ticket.companyFullName ? `<div class="muted">${esc(ticket.companyFullName)}</div>` : ""}
          ${ticket.address ? `<div class="muted block">${esc(ticket.address)}</div>` : ""}
          ${ticket.phone ? `<div class="muted">${esc(ticket.phone)}</div>` : ""}
          ${ticket.showWhatsapp && ticket.whatsapp ? `<div class="muted">${esc(ticket.whatsapp)}</div>` : ""}
          ${ticket.showWebsite && ticket.website ? `<div class="muted">${esc(ticket.website)}</div>` : ""}
          ${ticket.showRfc && ticket.rfc ? `<div class="muted">${esc(ticket.rfc)}</div>` : ""}
        </div>
        <div class="line"></div>
        <div class="muted">${esc(t(lang, "pos.field.folio"))}: ${esc(ticket.folio)}</div>
        <div class="muted">${esc(t(lang, "pos.field.datetime"))}: ${esc(dateTime(lang, ticket.createdAt))}</div>
        ${ticket.showCashier ? `<div class="muted">${esc(t(lang, "pos.field.cashier"))}: ${esc(ticket.cashierName)}</div>` : ""}
        ${ticket.showCustomer && ticket.customerName ? `<div class="muted">${esc(t(lang, "pos.field.customer"))}: ${esc(ticket.customerName)}</div>` : ""}
        <div class="line"></div>
        <table>
          <thead>
            <tr>
              <th class="name-head">${esc(t(lang, "pos.field.product"))}</th>
              <th class="qty-head">${esc(t(lang, "pos.field.quantity"))}</th>
              <th class="price-head">${esc(t(lang, "pos.field.unit_price"))}</th>
              <th class="discount-head">${esc(t(lang, "pos.field.discount"))}</th>
              <th class="subtotal-head">${esc(t(lang, "pos.field.subtotal"))}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="line"></div>
        <div class="sum-row"><span>${esc(t(lang, "pos.field.subtotal"))}</span><span>${esc(ticketSummaryMoney(ticket.subtotal))}</span></div>
        <div class="sum-row"><span>${esc(t(lang, "pos.field.discount"))}</span><span>${esc(ticketSummaryMoney(ticket.discountTotal))}</span></div>
        <div class="sum-row total"><span>${esc(t(lang, "pos.field.total"))}</span><span>${esc(ticketSummaryMoney(ticket.total))}</span></div>
        <div class="sum-row"><span>${esc(t(lang, "pos.field.payment_method"))}</span><span>${esc(paymentLabel(lang, ticket.paymentMethod))}</span></div>
        <div class="sum-row"><span>${esc(t(lang, "pos.field.received_amount"))}</span><span>${esc(ticketSummaryMoney(ticket.receivedAmount))}</span></div>
        <div class="sum-row"><span>${esc(t(lang, "pos.field.change"))}</span><span>${esc(ticketSummaryMoney(ticket.changeAmount))}</span></div>
        ${qrBlock}
        ${ticketBarcodeBlock}
        ${ticket.footerLine1 || ticket.footerLine2 ? `<div class="line"></div>` : ""}
        ${ticket.footerLine1 ? `<div class="center muted">${esc(ticket.footerLine1)}</div>` : ""}
        ${ticket.footerLine2 ? `<div class="center muted">${esc(ticket.footerLine2)}</div>` : ""}
      </div>
      <script>window.onload = function(){ window.print(); };</script>
    </body>
  </html>`);
  targetWindow.document.close();
}
