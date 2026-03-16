"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { TableCard } from "@/components/table-card";
import { getClientLang } from "@/lib/lang-client";
import type {
  DsExchangeRatePayload,
  DsFinanceRow,
  DsInventoryRow,
  DsOrderRow,
  DsOverviewStats,
} from "@/lib/dropshipping-types";

type OverviewPayload = {
  stats: DsOverviewStats;
  recentOrders: Array<{
    id: string;
    customerName: string;
    platform: string;
    orderNo: string;
    sku: string;
    quantity: number;
    shippingStatus: "pending" | "shipped" | "cancelled";
    createdAt: string;
  }>;
  alerts: Array<{
    type:
      | "pending_order"
      | "missing_shipping_proof"
      | "low_inventory"
      | "duplicate_order"
      | "exchange_rate_failed"
      | "customer_unsettled";
    count: number;
  }>;
  trends: {
    orderCount: number;
    shippedCount: number;
    receivable: number;
  };
};

type Props = {
  initialLang: "zh" | "es";
  initialOverview: OverviewPayload;
  initialOrders: DsOrderRow[];
  initialInventory: DsInventoryRow[];
  initialFinance: DsFinanceRow[];
  initialExchangeRate: DsExchangeRatePayload;
};

type TabKey = "overview" | "orders" | "inventory" | "finance";

type OrderFormState = {
  id: string;
  customerName: string;
  platform: string;
  platformOrderNo: string;
  sku: string;
  productNameZh: string;
  productNameEs: string;
  quantity: string;
  trackingNo: string;
  color: string;
  warehouse: string;
  shippedAt: string;
  shippingFee: string;
  shippingStatus: "pending" | "shipped" | "cancelled";
  notes: string;
};

const EMPTY_ORDER_FORM: OrderFormState = {
  id: "",
  customerName: "",
  platform: "",
  platformOrderNo: "",
  sku: "",
  productNameZh: "",
  productNameEs: "",
  quantity: "1",
  trackingNo: "",
  color: "",
  warehouse: "",
  shippedAt: "",
  shippingFee: "",
  shippingStatus: "pending",
  notes: "",
};

function fmtDate(value: string | null | undefined, lang: "zh" | "es") {
  if (!value) return "-";
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Mexico_City",
  }).format(new Date(value));
}

function fmtMoney(value: number, lang: "zh" | "es") {
  return new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function DropshippingClient({
  initialLang,
  initialOverview,
  initialOrders,
  initialInventory,
  initialFinance,
  initialExchangeRate,
}: Props) {
  const [lang, setLang] = useState<"zh" | "es">(initialLang);
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [overview, setOverview] = useState(initialOverview);
  const [orders, setOrders] = useState(initialOrders);
  const [inventory, setInventory] = useState(initialInventory);
  const [finance, setFinance] = useState(initialFinance);
  const [exchangeRate, setExchangeRate] = useState(initialExchangeRate);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "shipped" | "cancelled">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<OrderFormState>(EMPTY_ORDER_FORM);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string>("");
  const [error, setError] = useState("");
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setLang(getClientLang());
  }, []);

  const text = lang === "zh"
    ? {
        badge: "轻量业务模块",
        title: "一件代发管理",
        desc: "在现有 ParksonIM 后台内集中处理代发订单、SKU 备货、客户结算与汇率信息。",
        refresh: "刷新数据",
        create: "新增订单",
        import: "导入文件",
        tabs: { overview: "总览", orders: "订单管理", inventory: "SKU备货", finance: "财务结算" },
        stats: {
          todayOrders: "今日录单",
          todayShipped: "今日已发货",
          todayPending: "今日待处理",
          unsettled: "待结算客户",
          receivable: "当前总应收",
          paid: "当前总已收",
          unpaid: "当前总未收",
          rate: "今日汇率",
        },
        sections: {
          recent: "最近订单",
          alerts: "待处理提醒",
          orders: "订单列表",
          inventory: "SKU 备货汇总",
          finance: "客户结算",
          rate: "汇率状态",
        },
        fields: {
          customer: "客户",
          platform: "平台",
          orderNo: "订单号",
          sku: "SKU",
          quantity: "数量",
          status: "状态",
          trackingNo: "物流号",
          warehouse: "发货仓",
          shippingFee: "代发费",
          productZh: "中文名",
          remaining: "剩余",
          stocked: "备货",
          shipped: "已发",
          stockAmount: "备货金额",
          rateAmount: "汇率后金额",
          total: "总金额",
          paid: "已付",
          unpaid: "未付",
          lastPaid: "最近付款",
        },
        form: {
          create: "新增订单",
          edit: "编辑订单",
          customer: "客户名称",
          platform: "平台",
          orderNo: "后台订单号",
          sku: "SKU",
          productZh: "产品中文名",
          productEs: "产品西文名",
          quantity: "数量",
          trackingNo: "物流号",
          color: "颜色",
          warehouse: "发货仓",
          shippedAt: "发货日期",
          shippingFee: "代发费",
          status: "发货状态",
          notes: "备注",
          cancel: "取消",
          submit: "保存",
        },
        alerts: {
          pending_order: "未发货订单",
          missing_shipping_proof: "已发货但缺少凭据",
          low_inventory: "库存不足 SKU",
          duplicate_order: "重复订单",
          exchange_rate_failed: "汇率抓取失败",
          customer_unsettled: "未结清客户",
        },
        status: {
          pending: "待发货",
          shipped: "已发货",
          cancelled: "已取消",
          healthy: "充足",
          low: "偏低",
          empty: "售罄",
          unpaid: "未结",
          partial: "部分已结",
          paid: "已结清",
        },
        empty: {
          title: "暂无数据",
          desc: "当前还没有一件代发记录，可以先新增一条订单开始使用。",
        },
        warnings: "异常",
        saving: "保存中...",
        importing: "导入中...",
      }
    : {
        badge: "Modulo interno",
        title: "Dropshipping",
        desc: "Gestiona pedidos, inventario SKU, liquidacion por cliente y tipo de cambio dentro del ParksonIM actual.",
        refresh: "Actualizar",
        create: "Nuevo pedido",
        import: "Importar archivo",
        tabs: { overview: "Resumen", orders: "Pedidos", inventory: "Inventario SKU", finance: "Finanzas" },
        stats: {
          todayOrders: "Pedidos hoy",
          todayShipped: "Enviados hoy",
          todayPending: "Pendientes hoy",
          unsettled: "Clientes por cobrar",
          receivable: "Total por cobrar",
          paid: "Total cobrado",
          unpaid: "Total pendiente",
          rate: "Tipo de cambio",
        },
        sections: {
          recent: "Pedidos recientes",
          alerts: "Alertas",
          orders: "Lista de pedidos",
          inventory: "Resumen SKU",
          finance: "Liquidacion por cliente",
          rate: "Estado del tipo de cambio",
        },
        fields: {
          customer: "Cliente",
          platform: "Plataforma",
          orderNo: "Pedido",
          sku: "SKU",
          quantity: "Cant.",
          status: "Estado",
          trackingNo: "Guia",
          warehouse: "Almacen",
          shippingFee: "Cargo",
          productZh: "Nombre ZH",
          remaining: "Restante",
          stocked: "Stock",
          shipped: "Enviado",
          stockAmount: "Monto stock",
          rateAmount: "Monto convertido",
          total: "Total",
          paid: "Pagado",
          unpaid: "Pendiente",
          lastPaid: "Ultimo pago",
        },
        form: {
          create: "Nuevo pedido",
          edit: "Editar pedido",
          customer: "Cliente",
          platform: "Plataforma",
          orderNo: "Numero de pedido",
          sku: "SKU",
          productZh: "Nombre ZH",
          productEs: "Nombre ES",
          quantity: "Cantidad",
          trackingNo: "Guia",
          color: "Color",
          warehouse: "Almacen",
          shippedAt: "Fecha envio",
          shippingFee: "Cargo",
          status: "Estado",
          notes: "Nota",
          cancel: "Cancelar",
          submit: "Guardar",
        },
        alerts: {
          pending_order: "Pedidos pendientes",
          missing_shipping_proof: "Enviados sin comprobante",
          low_inventory: "SKU con poco stock",
          duplicate_order: "Pedidos duplicados",
          exchange_rate_failed: "Fallo de tipo de cambio",
          customer_unsettled: "Clientes sin liquidar",
        },
        status: {
          pending: "Pendiente",
          shipped: "Enviado",
          cancelled: "Cancelado",
          healthy: "Suficiente",
          low: "Bajo",
          empty: "Agotado",
          unpaid: "Sin pagar",
          partial: "Parcial",
          paid: "Pagado",
        },
        empty: {
          title: "Sin datos",
          desc: "Todavia no hay registros de dropshipping. Crea un pedido para empezar.",
        },
        warnings: "Alertas",
        saving: "Guardando...",
        importing: "Importando...",
      };

  async function refreshAll() {
    try {
      setError("");
      const [overviewRes, ordersRes, inventoryRes, financeRes, rateRes] = await Promise.all([
        fetch("/api/dropshipping/overview"),
        fetch("/api/dropshipping/orders"),
        fetch("/api/dropshipping/inventory"),
        fetch("/api/dropshipping/finance"),
        fetch("/api/dropshipping/exchange-rate"),
      ]);
      const [overviewJson, ordersJson, inventoryJson, financeJson, rateJson] = await Promise.all([
        overviewRes.json(),
        ordersRes.json(),
        inventoryRes.json(),
        financeRes.json(),
        rateRes.json(),
      ]);
      if (!overviewRes.ok || !overviewJson?.ok) throw new Error(overviewJson?.error || "overview");
      if (!ordersRes.ok || !ordersJson?.ok) throw new Error(ordersJson?.error || "orders");
      if (!inventoryRes.ok || !inventoryJson?.ok) throw new Error(inventoryJson?.error || "inventory");
      if (!financeRes.ok || !financeJson?.ok) throw new Error(financeJson?.error || "finance");
      if (!rateRes.ok || !rateJson?.ok) throw new Error(rateJson?.error || "rate");
      setOverview(overviewJson.data);
      setOrders(ordersJson.items || []);
      setInventory(inventoryJson.items || []);
      setFinance(financeJson.items || []);
      setExchangeRate(rateJson.item);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Load failed");
    }
  }

  const filteredOrders = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return orders.filter((row) => {
      const hit =
        !normalized ||
        [
          row.customerName,
          row.platform,
          row.platformOrderNo,
          row.sku,
          row.productNameZh,
          row.trackingNo,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      const statusHit = statusFilter === "all" || row.shippingStatus === statusFilter;
      return hit && statusHit;
    });
  }, [keyword, orders, statusFilter]);

  function openCreateModal() {
    setForm(EMPTY_ORDER_FORM);
    setModalOpen(true);
  }

  function openEditModal(order: DsOrderRow) {
    setForm({
      id: order.id,
      customerName: order.customerName,
      platform: order.platform,
      platformOrderNo: order.platformOrderNo,
      sku: order.sku,
      productNameZh: order.productNameZh,
      productNameEs: order.productNameEs,
      quantity: String(order.quantity),
      trackingNo: order.trackingNo,
      color: order.color,
      warehouse: order.warehouse,
      shippedAt: order.shippedAt ? order.shippedAt.slice(0, 10) : "",
      shippingFee: order.shippingFee ? String(order.shippingFee) : "",
      shippingStatus: order.shippingStatus,
      notes: order.notes,
    });
    setModalOpen(true);
  }

  async function submitOrder() {
    try {
      setSaving(true);
      setError("");
      const endpoint = form.id ? `/api/dropshipping/orders/${form.id}` : "/api/dropshipping/orders";
      const method = form.id ? "PATCH" : "POST";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.customerName,
          platform: form.platform,
          platformOrderNo: form.platformOrderNo,
          sku: form.sku,
          productNameZh: form.productNameZh,
          productNameEs: form.productNameEs,
          quantity: Number(form.quantity || 0),
          trackingNo: form.trackingNo,
          color: form.color,
          warehouse: form.warehouse,
          shippedAt: form.shippedAt || null,
          shippingFee: form.shippingFee || null,
          shippingStatus: form.shippingStatus,
          notes: form.notes,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) throw new Error(json?.error || "save_failed");
      setModalOpen(false);
      setForm(EMPTY_ORDER_FORM);
      await refreshAll();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "save_failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleImport(file: File) {
    try {
      setImporting(true);
      setError("");
      setImportSummary("");
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/dropshipping/import", {
        method: "POST",
        body: formData,
      });
      const json = await response.json();
      if (!response.ok || !json?.ok) throw new Error(json?.error || "import_failed");
      const summary = json.summary || {};
      setImportSummary(
        lang === "zh"
          ? `已导入 ${summary.totalRows || 0} 行，新增订单 ${summary.createdOrders || 0}，更新订单 ${summary.updatedOrders || 0}，同步客户 ${summary.touchedCustomers || 0}，同步商品 ${summary.touchedProducts || 0}，导入付款快照 ${summary.seededPayments || 0}。`
          : `Importadas ${summary.totalRows || 0} filas, pedidos nuevos ${summary.createdOrders || 0}, pedidos actualizados ${summary.updatedOrders || 0}, clientes ${summary.touchedCustomers || 0}, productos ${summary.touchedProducts || 0}, pagos sembrados ${summary.seededPayments || 0}.`,
      );
      await refreshAll();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "import_failed");
    } finally {
      setImporting(false);
    }
  }

  const tabButtonClass = (tab: TabKey) =>
    `inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition ${
      activeTab === tab ? "bg-primary text-white shadow-soft" : "bg-white text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <section className="space-y-5">
      <PageHeader
        badge={text.badge}
        title={text.title}
        description={text.desc}
        meta={
          <div className="space-y-1">
            <div>RMB → MXN</div>
            <div>{text.sections.rate}: {exchangeRate.rateValue.toFixed(4)}</div>
          </div>
        }
        actions={
          <>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImport(file);
                event.currentTarget.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {text.refresh}
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {importing ? text.importing : text.import}
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft transition hover:opacity-95"
            >
              {text.create}
            </button>
          </>
        }
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>
      ) : null}

      {importSummary ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{importSummary}</div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(["overview", "orders", "inventory", "finance"] as TabKey[]).map((tab) => (
          <button key={tab} type="button" className={tabButtonClass(tab)} onClick={() => setActiveTab(tab)}>
            {text.tabs[tab]}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={text.stats.todayOrders} value={overview.stats.todayOrders} />
            <StatCard label={text.stats.todayShipped} value={overview.stats.todayShippedOrders} valueClassName="text-emerald-600" />
            <StatCard label={text.stats.todayPending} value={overview.stats.todayPendingOrders} valueClassName="text-amber-600" />
            <StatCard label={text.stats.unsettled} value={overview.stats.unsettledCustomers} valueClassName="text-rose-600" />
            <StatCard label={text.stats.receivable} value={fmtMoney(overview.stats.totalReceivable, lang)} />
            <StatCard label={text.stats.paid} value={fmtMoney(overview.stats.totalPaid, lang)} valueClassName="text-emerald-600" />
            <StatCard label={text.stats.unpaid} value={fmtMoney(overview.stats.totalUnpaid, lang)} valueClassName="text-rose-600" />
            <StatCard label={text.stats.rate} value={overview.stats.currentRate?.toFixed(4) || "-"} hint={fmtDate(overview.stats.rateUpdatedAt, lang)} />
          </section>

          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <TableCard title={text.sections.recent}>
              {overview.recentOrders.length === 0 ? (
                <EmptyState title={text.empty.title} description={text.empty.desc} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-slate-50 text-left text-sm text-slate-500">
                        <th className="px-4 py-3 font-medium">{text.fields.customer}</th>
                        <th className="px-4 py-3 font-medium">{text.fields.platform}</th>
                        <th className="px-4 py-3 font-medium">{text.fields.orderNo}</th>
                        <th className="px-4 py-3 font-medium">{text.fields.sku}</th>
                        <th className="px-4 py-3 font-medium">{text.fields.quantity}</th>
                        <th className="px-4 py-3 font-medium">{text.fields.status}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.recentOrders.map((row) => (
                        <tr key={row.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-sm text-slate-700">{row.customerName}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.platform}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.orderNo}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.sku}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{row.quantity}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{text.status[row.shippingStatus]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TableCard>

            <TableCard title={text.sections.alerts}>
              <div className="grid gap-3 p-4">
                {overview.alerts.map((item) => (
                  <div key={item.type} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-sm text-slate-500">{text.alerts[item.type]}</div>
                    <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{item.count}</div>
                  </div>
                ))}
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                  {text.sections.rate}: {exchangeRate.rateValue.toFixed(4)} / {fmtDate(exchangeRate.fetchedAt || exchangeRate.rateDate, lang)}
                  {exchangeRate.fetchFailed ? (
                    <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-rose-600">
                      {exchangeRate.failureReason || text.alerts.exchange_rate_failed}
                    </div>
                  ) : null}
                </div>
              </div>
            </TableCard>
          </div>
        </>
      ) : null}

      {activeTab === "orders" ? (
        <TableCard
          title={text.sections.orders}
          description={lang === "zh" ? "支持快速录单、状态切换和异常提示。" : "Alta rapida, estado y alertas basicas."}
          titleRight={
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder={lang === "zh" ? "搜索客户 / 平台 / 订单号 / SKU" : "Buscar cliente / plataforma / pedido / SKU"}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
              >
                <option value="all">{lang === "zh" ? "全部状态" : "Todos"}</option>
                <option value="pending">{text.status.pending}</option>
                <option value="shipped">{text.status.shipped}</option>
                <option value="cancelled">{text.status.cancelled}</option>
              </select>
            </div>
          }
        >
          {filteredOrders.length === 0 ? (
            <EmptyState
              title={text.empty.title}
              description={text.empty.desc}
              action={
                <button type="button" onClick={openCreateModal} className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white">
                  {text.create}
                </button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50 text-left text-sm text-slate-500">
                    <th className="px-4 py-3 font-medium">{text.fields.customer}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.platform}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.orderNo}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.sku}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.productZh}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.quantity}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.status}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.trackingNo}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.shippingFee}</th>
                    <th className="px-4 py-3 font-medium">{text.warnings}</th>
                    <th className="px-4 py-3 text-right font-medium">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-sm text-slate-700">{row.customerName}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.platform}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.platformOrderNo}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.sku}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.productNameZh}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.quantity}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                          {text.status[row.shippingStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.trackingNo || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{fmtMoney(row.shippingFee, lang)}</td>
                      <td className="px-4 py-3 text-sm text-rose-600">{row.warnings.length > 0 ? row.warnings.join(", ") : "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => openEditModal(row)} className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">
                          {lang === "zh" ? "编辑" : "Editar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TableCard>
      ) : null}

      {activeTab === "inventory" ? (
        <TableCard title={text.sections.inventory}>
          {inventory.length === 0 ? (
            <EmptyState title={text.empty.title} description={lang === "zh" ? "录入订单后系统会自动建立客户+SKU 库存记录，后续可继续扩展基础资料维护。" : "Al guardar pedidos se crean registros base de cliente+SKU para seguimiento."} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50 text-left text-sm text-slate-500">
                    <th className="px-4 py-3 font-medium">{text.fields.customer}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.sku}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.productZh}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.warehouse}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.stocked}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.shipped}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.remaining}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.stockAmount}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((row) => (
                    <tr key={row.inventoryId} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-sm text-slate-700">{row.customerName}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.sku}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.productNameZh}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.warehouse || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.stockedQty}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.shippedQty}</td>
                      <td className={`px-4 py-3 text-sm font-semibold ${row.remainingQty <= 0 ? "text-rose-600" : row.remainingQty < 5 ? "text-amber-600" : "text-slate-900"}`}>{row.remainingQty}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{fmtMoney(row.stockAmount, lang)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{text.status[row.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TableCard>
      ) : null}

      {activeTab === "finance" ? (
        <TableCard title={text.sections.finance}>
          {finance.length === 0 ? (
            <EmptyState title={text.empty.title} description={text.empty.desc} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50 text-left text-sm text-slate-500">
                    <th className="px-4 py-3 font-medium">{text.fields.customer}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.stockAmount}</th>
                    <th className="px-4 py-3 font-medium">{text.stats.rate}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.rateAmount}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.shippingFee}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.total}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.paid}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.unpaid}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.lastPaid}</th>
                    <th className="px-4 py-3 font-medium">{text.fields.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {finance.map((row) => (
                    <tr key={row.customerId} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">{row.customerName}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{fmtMoney(row.stockAmount, lang)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{row.exchangeRate?.toFixed(4) || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{fmtMoney(row.exchangedAmount, lang)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{fmtMoney(row.shippingAmount, lang)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{fmtMoney(row.totalAmount, lang)}</td>
                      <td className="px-4 py-3 text-sm text-emerald-600">{fmtMoney(row.paidAmount, lang)}</td>
                      <td className="px-4 py-3 text-sm text-rose-600">{fmtMoney(row.unpaidAmount, lang)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{fmtDate(row.lastPaidAt, lang)}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{text.status[row.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TableCard>
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-[920px] rounded-xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {form.id ? text.form.edit : text.form.create}
              </h3>
            </div>
            <div className="grid gap-4 px-5 py-5 md:grid-cols-2 xl:grid-cols-3">
              {([
                ["customerName", text.form.customer],
                ["platform", text.form.platform],
                ["platformOrderNo", text.form.orderNo],
                ["sku", text.form.sku],
                ["productNameZh", text.form.productZh],
                ["productNameEs", text.form.productEs],
                ["quantity", text.form.quantity],
                ["trackingNo", text.form.trackingNo],
                ["color", text.form.color],
                ["warehouse", text.form.warehouse],
                ["shippedAt", text.form.shippedAt],
                ["shippingFee", text.form.shippingFee],
              ] as Array<[keyof OrderFormState, string]>).map(([key, label]) => (
                <label key={key} className="space-y-1">
                  <span className="text-xs text-slate-500">{label}</span>
                  <input
                    type={key === "shippedAt" ? "date" : key === "quantity" || key === "shippingFee" ? "number" : "text"}
                    value={form[key]}
                    onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  />
                </label>
              ))}

              <label className="space-y-1">
                <span className="text-xs text-slate-500">{text.form.status}</span>
                <select
                  value={form.shippingStatus}
                  onChange={(event) => setForm((prev) => ({ ...prev, shippingStatus: event.target.value as OrderFormState["shippingStatus"] }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700"
                >
                  <option value="pending">{text.status.pending}</option>
                  <option value="shipped">{text.status.shipped}</option>
                  <option value="cancelled">{text.status.cancelled}</option>
                </select>
              </label>

              <label className="space-y-1 md:col-span-2 xl:col-span-3">
                <span className="text-xs text-slate-500">{text.form.notes}</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                {text.form.cancel}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submitOrder()}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? text.saving : text.form.submit}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
