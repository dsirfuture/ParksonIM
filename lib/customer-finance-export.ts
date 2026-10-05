import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type CustomerFinanceOrderExportRow = {
  orderNo: string;
  channelText: string;
  orderDateText: string;
  orderAmountText: string;
  packingAmountText: string;
  shippedAtText: string;
  remarkText: string;
};

export type CustomerFinancePaymentExportRow = {
  orderNo: string;
  payableAmountText: string;
  paidAmountText: string;
  paymentTimeText: string;
  paymentMethodText: string;
  paymentTargetText: string;
  unpaidAmountText: string;
  remarkText: string;
};

export type CustomerFinanceDetailExportPayload = {
  customerName: string;
  linkedYgName: string;
  realName: string;
  contact: string;
  phone: string;
  stores: string;
  address: string;
  vipLevel: string;
  creditLevel: string;
  totalOrderCount: string;
  totalOrderAmountText: string;
  totalPackingAmountText: string;
  orderRows: CustomerFinanceOrderExportRow[];
  paymentRows: CustomerFinancePaymentExportRow[];
};

function sanitizeFileName(value: string) {
  return String(value || "customer-finance")
    .trim()
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeDisplay(value: string) {
  const text = String(value || "").trim();
  return text || "-";
}

function formatDateLabel() {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function findBrowserExecutable() {
  return [
    process.env.PARKSON_PDF_BROWSER,
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/microsoft-edge",
  ].filter(Boolean) as string[];
}

async function resolveBrowserExecutable() {
  for (const candidate of findBrowserExecutable()) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error("未找到可用的浏览器 PDF 渲染器");
}

function isPositiveAmount(value: string) {
  const numeric = Number(String(value || "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) && numeric > 0;
}

function buildCustomerFinanceHtml(payload: CustomerFinanceDetailExportPayload) {
  const orderRows = payload.orderRows.length
    ? payload.orderRows.map((row) => `
      <tr>
        <td>${escapeHtml(normalizeDisplay(row.orderNo))}</td>
        <td>${escapeHtml(normalizeDisplay(row.channelText))}</td>
        <td>${escapeHtml(normalizeDisplay(row.orderDateText))}</td>
        <td class="num">${escapeHtml(normalizeDisplay(row.orderAmountText))}</td>
        <td class="num">${escapeHtml(normalizeDisplay(row.packingAmountText))}</td>
        <td>${escapeHtml(normalizeDisplay(row.shippedAtText))}</td>
        <td>${escapeHtml(normalizeDisplay(row.remarkText))}</td>
      </tr>`).join("")
    : `<tr><td colspan="7" class="empty">当前没有匹配到下单记录</td></tr>`;

  const paymentRows = payload.paymentRows.length
    ? payload.paymentRows.map((row) => {
        const unpaid = normalizeDisplay(row.unpaidAmountText);
        const unpaidClass = isPositiveAmount(unpaid) ? "num danger" : "num";
        return `
          <tr>
            <td>${escapeHtml(normalizeDisplay(row.orderNo))}</td>
            <td class="num">${escapeHtml(normalizeDisplay(row.payableAmountText))}</td>
            <td class="num">${escapeHtml(normalizeDisplay(row.paidAmountText))}</td>
            <td>${escapeHtml(normalizeDisplay(row.paymentTimeText))}</td>
            <td>${escapeHtml(normalizeDisplay(row.paymentMethodText))}</td>
            <td class="${unpaidClass}">${escapeHtml(unpaid)}</td>
            <td>${escapeHtml(normalizeDisplay(row.remarkText))}</td>
          </tr>`;
      }).join("")
    : `<tr><td colspan="7" class="empty">当前没有付款记录</td></tr>`;

  const vipText = normalizeDisplay(payload.vipLevel);
  const creditText = normalizeDisplay(payload.creditLevel);
  const vipIsActive = vipText.toUpperCase() === "VIP";
  const vipContent = vipIsActive
    ? `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
         <path d="M17.42 3a2 2 0 0 1 1.649.868l.087.14L22.49 9.84a2 2 0 0 1-.208 2.283l-.114.123l-9.283 9.283a1.25 1.25 0 0 1-1.666.091l-.102-.09l-9.283-9.284a2 2 0 0 1-.4-2.257l.078-.15l3.333-5.832a2 2 0 0 1 1.572-1.001L6.58 3zM7.293 9.293a1 1 0 0 0 0 1.414l3.823 3.823a1.25 1.25 0 0 0 1.768 0l3.823-3.823a1 1 0 1 0-1.414-1.414L12 12.586L8.707 9.293a1 1 0 0 0-1.414 0"
           fill="#c0a11b"/>
       </svg>`
    : escapeHtml(vipText);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(payload.customerName)} 客户财务</title>
  <style>
    @page { size: A4 landscape; margin: 18mm 16mm 14mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #334155;
      font-family: "Microsoft YaHei", "Noto Sans SC", "PingFang SC", "Segoe UI", Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body { font-size: 12px; }
    .page { width: 100%; }
    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
    }
    .brand-left {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: .02em;
      color: #2f3c7f;
    }
    .brand-right {
      font-size: 16px;
      font-weight: 700;
      color: #64748b;
    }
    .grid4 {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    .card, .summary-card, .table-wrap {
      border: 1px solid #dbe4f0;
      background: #fff;
    }
    .card {
      min-height: 58px;
      padding: 10px 12px;
    }
    .card.large {
      margin-top: 10px;
      min-height: 64px;
    }
    .label {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 8px;
    }
    .value {
      font-size: 12px;
      color: #334155;
      word-break: break-word;
    }
    .summary-row {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
      margin-top: 16px;
    }
    .summary-card {
      min-height: 70px;
      padding: 12px 10px;
      text-align: center;
      background: #f4f6fa;
    }
    .summary-card .label { margin-bottom: 10px; }
    .summary-card .value { font-size: 15px; }
    .vip-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 20px;
    }
    .section-title {
      margin: 28px 0 10px;
      font-size: 13px;
      font-weight: 700;
      color: #334155;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th, td {
      border-bottom: 1px solid #dbe4f0;
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
      word-break: break-word;
    }
    th {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      background: #fff;
    }
    td { color: #334155; }
    td.num { text-align: left; }
    th.num { text-align: left; }
    .danger { color: #dc2626; }
    .empty {
      text-align: center;
      color: #94a3b8;
      padding: 14px 10px;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="topbar">
      <div class="brand-left">PARKSONMX</div>
      <div class="brand-right">百盛供应链</div>
    </div>
    <div class="grid4">
      <div class="card"><div class="label">客户名称</div><div class="value">${escapeHtml(normalizeDisplay(payload.realName))}</div></div>
      <div class="card"><div class="label">联系人</div><div class="value">${escapeHtml(normalizeDisplay(payload.contact))}</div></div>
      <div class="card"><div class="label">手机</div><div class="value">${escapeHtml(normalizeDisplay(payload.phone))}</div></div>
      <div class="card"><div class="label">门店编号</div><div class="value">${escapeHtml(normalizeDisplay(payload.stores))}</div></div>
    </div>
    <div class="card large"><div class="label">客户地址</div><div class="value">${escapeHtml(normalizeDisplay(payload.address))}</div></div>

    <div class="summary-row">
      <div class="summary-card"><div class="label">VIP等级</div><div class="value"><span class="vip-icon">${vipContent}</span></div></div>
      <div class="summary-card"><div class="label">信用等级</div><div class="value">${escapeHtml(creditText)}</div></div>
      <div class="summary-card"><div class="label">下单次数</div><div class="value">${escapeHtml(normalizeDisplay(payload.totalOrderCount))}</div></div>
      <div class="summary-card"><div class="label">下单金额</div><div class="value">${escapeHtml(normalizeDisplay(payload.totalOrderAmountText))}</div></div>
      <div class="summary-card"><div class="label">累计配货金额</div><div class="value">${escapeHtml(normalizeDisplay(payload.totalPackingAmountText))}</div></div>
    </div>

    <div class="section-title">订单总览</div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:14.28%">订单号</th>
            <th style="width:14.28%">渠道</th>
            <th style="width:14.28%">下单日期</th>
            <th class="num" style="width:14.28%">下单金额</th>
            <th class="num" style="width:14.28%">配货金额</th>
            <th style="width:14.28%">发货日期</th>
            <th style="width:14.32%">备注</th>
          </tr>
        </thead>
        <tbody>${orderRows}</tbody>
      </table>
    </div>

    <div class="section-title">付款详情</div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:14.28%">订单号</th>
            <th class="num" style="width:14.28%">需付金额</th>
            <th class="num" style="width:14.28%">已付金额</th>
            <th style="width:14.28%">付款时间</th>
            <th style="width:14.28%">付款方式</th>
            <th class="num" style="width:14.28%">未付金额</th>
            <th style="width:14.32%">备注</th>
          </tr>
        </thead>
        <tbody>${paymentRows}</tbody>
      </table>
    </div>

  </div>
</body>
</html>`;
}

export function buildCustomerFinancePdfFileName(customerName: string) {
  return `${sanitizeFileName(customerName || "customer-finance")}-PARKSONMX.pdf`;
}

export async function buildCustomerFinanceDetailPdf(payload: CustomerFinanceDetailExportPayload) {
  const browserPath = await resolveBrowserExecutable();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "parkson-cf-pdf-"));
  const htmlPath = path.join(tempDir, "customer-finance.html");
  const pdfPath = path.join(tempDir, "customer-finance.pdf");

  try {
    await fs.writeFile(htmlPath, buildCustomerFinanceHtml(payload), "utf8");
    await execFileAsync(browserPath, [
      "--headless",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--allow-file-access-from-files",
      "--no-pdf-header-footer",
      `--print-to-pdf=${pdfPath}`,
      "--print-to-pdf-no-header",
      `file://${htmlPath}`,
    ], {
      env: {
        ...process.env,
        LANG: "zh_CN.UTF-8",
      },
      maxBuffer: 20 * 1024 * 1024,
    });

    const pdfBytes = await fs.readFile(pdfPath);
    return new Uint8Array(pdfBytes);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
