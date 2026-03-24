import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type WeeklyStatementPdfOrder = {
  platformOrderNo: string;
  trackingNo: string;
  shippedAtText: string;
  sku: string;
  isStockedBadge?: boolean;
  quantity: number;
  unitPriceText: string;
  normalDiscountText: string;
  vipDiscountText: string;
  productAmountText: string;
  convertedAmountText: string;
  shippingFeeText: string;
  totalAmountText: string;
  highlightRed?: boolean;
};

export type WeeklyStatementPdfPayload = {
  customerName: string;
  statementNumber: string;
  generatedDateText: string;
  orderCount: number;
  statusText: string;
  hasUnpaid: boolean;
  cycleText: string;
  rateText: string;
  serviceFeeDisplay: string;
  settlementMode: "RMB" | "MXN";
  mxnSubtotalText: string;
  cnySubtotalText: string;
  serviceFeeTotalText: string;
  rawServiceFeeRmbText?: string;
  payableTotalText: string;
  orders: WeeklyStatementPdfOrder[];
  isGenerated: boolean;
  noteLines: string[];
};

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function findBrowserExecutable() {
  const candidates = [
    process.env.PARKSON_PDF_BROWSER,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/microsoft-edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean) as string[];

  return candidates;
}

async function resolveBrowserExecutable() {
  for (const candidate of findBrowserExecutable()) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // continue
    }
  }
  throw new Error("未找到可用的浏览器 PDF 渲染器，请安装 Edge 或 Chrome。");
}

function buildStatementHtml(payload: WeeklyStatementPdfPayload) {
  const productSettlementLabel =
    payload.settlementMode === "MXN" ? "商品金额（比索）" : "商品折算（人民币）";
  const serviceFeeLabel =
    payload.settlementMode === "MXN" ? "代发服务费（比索）" : "代发服务费（人民币）";
  const rawServiceFeeRmbLabel = "代发服务费（人民币）";
  const payableTotalLabel =
    payload.settlementMode === "MXN" ? "应付总额（比索）" : "应付总额（人民币）";
  const settlementColumnLabel =
    payload.settlementMode === "MXN" ? "结算金额" : "折算";
  const totalColumnLabel = "合计";
  const notes = payload.noteLines
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");

  const rows = payload.orders
    .map((item, index) => {
      const textColor = !payload.hasUnpaid ? "#334155" : item.highlightRed ? "#e11d48" : "#334155";
      const rowBg = index % 2 === 1 ? "#f8fafc" : "#ffffff";
      const totalColor = payload.hasUnpaid ? "#e11d48" : "#334155";
      return `
        <tr style="background:${rowBg}; color:${textColor};">
          <td>${escapeHtml(item.platformOrderNo)}</td>
          <td>${escapeHtml(item.trackingNo || "-")}</td>
          <td>${escapeHtml(item.shippedAtText || "-")}</td>
          <td>
            <span class="sku-cell">
              ${item.isStockedBadge ? '<span class="stock-badge">备</span>' : ""}
              <span>${escapeHtml(item.sku || "-")}</span>
            </span>
          </td>
          <td class="num">${escapeHtml(String(item.quantity ?? "-"))}</td>
          <td class="num">${escapeHtml(item.unitPriceText || "-")}</td>
          <td class="num">${escapeHtml(item.normalDiscountText || "-")}</td>
          <td class="num">${escapeHtml(item.vipDiscountText || "-")}</td>
          <td class="num">${escapeHtml(item.productAmountText || "-")}</td>
          <td class="num">${escapeHtml(item.convertedAmountText || "-")}</td>
          <td class="num">${escapeHtml(item.shippingFeeText || "-")}</td>
          <td class="num" style="color:${totalColor};">${escapeHtml(item.totalAmountText || "-")}</td>
        </tr>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>本周未结账单</title>
  <style>
    @page { size: A4 landscape; margin: 20px 24px 18px; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #334155;
      font-family: "Microsoft YaHei", "Noto Sans SC", "PingFang SC", "Segoe UI", Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body { width: auto; }
    .sheet {
      width: auto;
      min-height: auto;
      padding: 0;
      background: #fff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: stretch;
      gap: 32px;
    }
    .left {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      align-self: flex-start;
      height: 32px;
      padding: 0 16px;
      border: 1px solid #e2e8f0;
      border-radius: 9999px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: .18em;
      color: #64748b;
      background: #fff;
    }
    .title {
      margin: 16px 0 0;
      font-size: 34px;
      line-height: 1;
      letter-spacing: 6px;
      font-weight: 900;
      color: #020617;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: max-content max-content;
      gap: 10px 60px;
      width: fit-content;
      margin-top: 16px;
    }
    .meta-normal {
      font-size: 12px;
      line-height: 1.25;
      font-weight: 400;
      color: #64748b;
      white-space: nowrap;
    }
    .meta-soft {
      font-size: 12px;
      line-height: 1.25;
      color: #64748b;
      white-space: nowrap;
    }
    .info-card {
      width: 280px;
      padding: 14px;
      border: none;
      border-radius: 0;
      background: transparent;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding-bottom: 12px;
      margin-bottom: 12px;
      border-bottom: 1px solid rgba(226,232,240,.8);
      font-size: 12px;
    }
    .info-row:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }
    .info-label { color: #64748b; }
    .info-value { color: #334155; font-weight: 700; }
    .info-value.danger { color: #e11d48; }
    .info-value.success { color: #059669; }
    .summary {
      margin-top: 20px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      justify-items: center;
      text-align: center;
    }
    .summary-item { padding: 10px 20px 6px; }
    .summary-label {
      font-size: 12px;
      line-height: 1.25;
      color: #64748b;
    }
    .summary-value {
      margin-top: 8px;
      font-size: 14px;
      line-height: 1.2;
      font-weight: 900;
      color: #020617;
    }
    .summary-value.danger { color: #e11d48; }
    .summary-value.success { color: #334155; }
    .table-wrap {
      margin-top: 12px;
      border: 1px solid #e2e8f0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: auto;
    }
    thead tr {
      border-bottom: 1px solid #e2e8f0;
      background: #fff;
    }
    th {
      padding: 8px 8px;
      font-size: 12px;
      line-height: 1.2;
      font-weight: 600;
      color: #64748b;
      text-align: left;
      white-space: nowrap;
    }
    td {
      padding: 8px 8px;
      font-size: 12px;
      line-height: 1.2;
      border-bottom: 1px solid rgba(226,232,240,.7);
      white-space: nowrap;
      color: inherit;
    }
    td.num, th.num { text-align: right; }
    .footer {
      margin-top: 24px;
      padding-top: 0;
      display: grid;
      grid-template-columns: 1.7fr 1fr;
      gap: 20px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .notes-title, .settle-title {
      font-size: 14px;
      line-height: 1.2;
      font-weight: 900;
      color: #64748b;
    }
    .notes {
      margin-top: 16px;
      display: grid;
      gap: 10px;
      font-size: 12px;
      line-height: 17px;
      color: #64748b;
    }
    .notes p {
      margin: 0;
    }
    .settle {
      color: #64748b;
      width: 280px;
      justify-self: end;
    }
    .settle-list {
      margin-top: 10px;
      display: grid;
      gap: 13px;
      font-size: 12px;
    }
    .settle-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding-bottom: 13px;
      border-bottom: 1px solid #e2e8f0;
    }
    .settle-total {
      margin-top: 12px;
      margin-bottom: 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
    }
    .settle-total-label {
      font-size: 16px;
      line-height: 1.2;
      font-weight: 900;
      color: #64748b;
    }
    .settle-total-value {
      font-size: 16px;
      line-height: 1.2;
      font-weight: 900;
      color: #e11d48;
    }
    .settle-total-value.success { color: #334155; }
    .sku-cell {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .stock-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: #273a8a;
      color: #ffffff;
      font-size: 10px;
      line-height: 1;
      font-weight: 700;
      flex: 0 0 auto;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="left">
        <div class="pill">PARKSONMX</div>
        <div class="title">代发结算单</div>
        <div class="meta-grid">
          <div class="meta-normal">客户：${escapeHtml(payload.customerName)}</div>
          <div class="meta-normal">${escapeHtml(payload.cycleText)}</div>
          <div class="meta-soft">${escapeHtml(payload.rateText)}</div>
          <div class="meta-normal">代发费：${escapeHtml(payload.serviceFeeDisplay)}</div>
        </div>
      </div>

      <div class="info-card">
        <div class="info-row"><span class="info-label">对账单号</span><span class="info-value">${escapeHtml(payload.statementNumber)}</span></div>
        <div class="info-row"><span class="info-label">生成日期</span><span class="info-value">${escapeHtml(payload.generatedDateText)}</span></div>
        <div class="info-row"><span class="info-label">订单数</span><span class="info-value">${escapeHtml(String(payload.orderCount))}</span></div>
        <div class="info-row"><span class="info-label">状态</span><span class="info-value${payload.hasUnpaid ? " danger" : " success"}">${escapeHtml(payload.statusText)}</span></div>
      </div>
    </div>

    <div class="summary">
      <div class="summary-item"><div class="summary-label">商品小计（比索）</div><div class="summary-value">${escapeHtml(payload.mxnSubtotalText)}</div></div>
      <div class="summary-item"><div class="summary-label">${escapeHtml(payload.settlementMode === "MXN" ? rawServiceFeeRmbLabel : productSettlementLabel)}</div><div class="summary-value">${escapeHtml(payload.settlementMode === "MXN" ? (payload.rawServiceFeeRmbText || "-") : payload.cnySubtotalText)}</div></div>
      <div class="summary-item"><div class="summary-label">${escapeHtml(serviceFeeLabel)}</div><div class="summary-value">${escapeHtml(payload.serviceFeeTotalText)}</div></div>
      <div class="summary-item"><div class="summary-label">${escapeHtml(payableTotalLabel)}</div><div class="summary-value${payload.hasUnpaid ? " danger" : " success"}">${escapeHtml(payload.payableTotalText)}</div></div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>订单号</th>
            <th>物流号</th>
            <th>发货日期</th>
            <th>编码</th>
            <th class="num">数量</th>
            <th class="num">单价</th>
            <th class="num">普通折扣</th>
            <th class="num">VIP折扣</th>
            <th class="num">商品金额</th>
            <th class="num">${escapeHtml(settlementColumnLabel)}</th>
            <th class="num">代发费</th>
            <th class="num">${escapeHtml(totalColumnLabel)}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="footer">
      <div>
        <div class="notes-title">备注说明</div>
        <div class="notes">${notes}</div>
      </div>
      <div class="settle">
        <div class="settle-title">结算汇总</div>
        <div class="settle-list">
          <div class="settle-row"><span>商品小计（比索）</span><span>${escapeHtml(payload.mxnSubtotalText)}</span></div>
          <div class="settle-row"><span>${escapeHtml(productSettlementLabel)}</span><span>${escapeHtml(payload.cnySubtotalText)}</span></div>
          <div class="settle-row"><span>${escapeHtml(serviceFeeLabel)}</span><span>${escapeHtml(payload.serviceFeeTotalText)}</span></div>
        </div>
        <div class="settle-total">
          <span class="settle-total-label">${escapeHtml(payableTotalLabel)}</span>
          <span class="settle-total-value${payload.hasUnpaid ? "" : " success"}">${escapeHtml(payload.payableTotalText)}</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function buildWeeklyUnpaidStatementPdf(payload: WeeklyStatementPdfPayload) {
  const browser = await resolveBrowserExecutable();
  const tmpDir = path.join(process.cwd(), "tmp");
  await fs.mkdir(tmpDir, { recursive: true });

  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const htmlPath = path.join(tmpDir, `weekly-statement-${unique}.html`);
  const pdfPath = path.join(tmpDir, `weekly-statement-${unique}.pdf`);

  try {
    await fs.writeFile(htmlPath, buildStatementHtml(payload), "utf8");
    const htmlUrl = `file:///${htmlPath.replace(/\\/g, "/")}`;
    await execFileAsync(browser, [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--no-pdf-header-footer",
      `--print-to-pdf=${pdfPath}`,
      htmlUrl,
    ]);
    return await fs.readFile(pdfPath);
  } finally {
    await Promise.allSettled([fs.rm(htmlPath, { force: true }), fs.rm(pdfPath, { force: true })]);
  }
}

export function buildWeeklyUnpaidStatementPdfName(customerName: string, exportDateCode: string) {
  const safeCustomerName =
    String(customerName || "finance")
      .trim()
      .replace(/[\\/:*?"<>|]/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "finance";
  return `BS-${safeCustomerName}-本周未结账单-${exportDateCode}.pdf`;
}
