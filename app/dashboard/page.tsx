import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { TableCard } from "@/components/table-card";
import { getLang } from "@/lib/i18n-server";

function formatTime(
  value: Date | string | null | undefined,
  lang: "zh" | "es",
) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function DashboardPage() {
  const session = await getSession();
  const lang = await getLang();

  const text =
    lang === "zh"
      ? {
          badge: "业务总览",
          title: "仪表盘",
          desc: "查看当前公司下的验货工作概况，并快速进入导入、列表、详情与扫描流程。",
          goReceipts: "进入验货单",
          importBtn: "导入新单",
          total: "全部验货单",
          pending: "待处理",
          progress: "处理中",
          completed: "已完成",
          totalHint: "当前公司下全部主单数量",
          pendingHint: "等待进入验货流程",
          progressHint: "正在扫描或核验中",
          completedHint: "已结束验货流程",
          focusTitle: "今日重点",
          focusDesc: "建议优先处理当前最关键的工作",
          focusA: "优先进入待处理或处理中验货单，避免任务堆积。",
          focusB: "导入新单后应尽快检查基础信息与数量是否正确。",
          focusC: "扫描完成后回到详情页确认状态是否已更新。",
          quickTitle: "快捷操作",
          quickDesc: "按业务顺序快速进入对应页面",
          q1: "验货单列表",
          q1d: "查看所有主单并进入详情或扫描",
          q2: "导入新单",
          q2d: "上传表格并进入导入流程",
          q3: "账单页面",
          q3d: "后续查看对账与账单汇总",
          q4: "登录页",
          q4d: "统一认证入口与语言切换",
          recentTitle: "最近更新的验货单",
          recentDesc: "按更新时间展示最近处理过的记录",
          noRecent: "当前还没有验货单数据，建议先导入一批测试数据。",
          receiptNo: "单号",
          supplier: "供应商",
          status: "状态",
          updatedAt: "更新时间",
          view: "查看",
          noSupplier: "未填写",
          sessionError:
            "未获取到开发会话，请检查 DEV_TENANT_ID / DEV_COMPANY_ID 配置。",
          rows: "条记录",
          statusPending: "待处理",
          statusProgress: "处理中",
          statusCompleted: "已完成",
        }
      : {
          badge: "Resumen del negocio",
          title: "Panel",
          desc: "Consulta la situación general del trabajo de inspección y entra rápidamente a importación, lista, detalle y escaneo.",
          goReceipts: "Ir a recepciones",
          importBtn: "Nueva importación",
          total: "Total de recepciones",
          pending: "Pendientes",
          progress: "En proceso",
          completed: "Completadas",
          totalHint: "Cantidad total de órdenes principales de la compañía",
          pendingHint: "Esperando entrar al flujo de inspección",
          progressHint: "En escaneo o validación",
          completedHint: "Proceso finalizado",
          focusTitle: "Prioridades de hoy",
          focusDesc: "Se recomienda atender primero el trabajo más importante",
          focusA:
            "Entrar primero a las recepciones pendientes o en proceso para evitar acumulación.",
          focusB:
            "Después de importar, revisar cuanto antes la información principal y las cantidades.",
          focusC:
            "Tras escanear, volver al detalle para confirmar si el estado fue actualizado.",
          quickTitle: "Acciones rápidas",
          quickDesc: "Entrar rápidamente a cada página según el flujo real",
          q1: "Lista de recepciones",
          q1d: "Ver todas las órdenes y entrar al detalle o escaneo",
          q2: "Nueva importación",
          q2d: "Subir archivo y entrar al flujo de importación",
          q3: "Facturación",
          q3d: "Después revisar conciliación y resumen de facturas",
          q4: "Acceso",
          q4d: "Entrada unificada de autenticación y cambio de idioma",
          recentTitle: "Recepciones actualizadas recientemente",
          recentDesc: "Muestra los registros tratados más recientemente",
          noRecent:
            "Todavía no hay recepciones. Se recomienda importar primero un lote de prueba.",
          receiptNo: "Número",
          supplier: "Proveedor",
          status: "Estado",
          updatedAt: "Actualizado",
          view: "Ver",
          noSupplier: "Sin proveedor",
          sessionError:
            "No se obtuvo la sesión de desarrollo. Revisa DEV_TENANT_ID y DEV_COMPANY_ID.",
          rows: "registros",
          statusPending: "Pendiente",
          statusProgress: "En proceso",
          statusCompleted: "Completada",
        };

  if (!session) {
    return (
      <AppShell>
        <div className="rounded-2xl border border-red-200 bg-white p-5 shadow-soft">
          <h1 className="text-xl font-bold text-slate-900">{text.title}</h1>
          <p className="mt-2 text-sm text-red-600">{text.sessionError}</p>
        </div>
      </AppShell>
    );
  }

  const receipts = await prisma.receipt.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    orderBy: {
      updated_at: "desc",
    },
    take: 5,
  });

  const allReceipts = await prisma.receipt.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    select: {
      status: true,
    },
  });

  const totalCount = allReceipts.length;
  const pendingCount = allReceipts.filter(
    (item) => item.status === "pending",
  ).length;
  const progressCount = allReceipts.filter(
    (item) => item.status === "in_progress",
  ).length;
  const completedCount = allReceipts.filter(
    (item) => item.status === "completed",
  ).length;

  function statusLabel(status: string) {
    if (status === "pending") return text.statusPending;
    if (status === "in_progress") return text.statusProgress;
    if (status === "completed") return text.statusCompleted;
    return status;
  }

  return (
    <AppShell>
      <PageHeader
        badge={text.badge}
        title={text.title}
        description={text.desc}
        actions={
          <>
            <Link
              href="/receipts"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {text.goReceipts}
            </Link>

            <Link
              href="/receipts/import"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft transition hover:opacity-95"
            >
              {text.importBtn}
            </Link>
          </>
        }
      />

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={text.total} value={totalCount} hint={text.totalHint} />
        <StatCard
          label={text.pending}
          value={pendingCount}
          hint={text.pendingHint}
          valueClassName="text-amber-600"
        />
        <StatCard
          label={text.progress}
          value={progressCount}
          hint={text.progressHint}
          valueClassName="text-blue-600"
        />
        <StatCard
          label={text.completed}
          value={completedCount}
          hint={text.completedHint}
          valueClassName="text-emerald-600"
        />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
        <TableCard title={text.focusTitle} description={text.focusDesc}>
          <div className="p-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <ul className="space-y-2 text-sm leading-6 text-slate-600">
                <li>{text.focusA}</li>
                <li>{text.focusB}</li>
                <li>{text.focusC}</li>
              </ul>
            </div>
          </div>
        </TableCard>

        <TableCard title={text.quickTitle} description={text.quickDesc}>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {[
              { href: "/receipts", title: text.q1, desc: text.q1d },
              { href: "/receipts/import", title: text.q2, desc: text.q2d },
              { href: "/billing", title: text.q3, desc: text.q3d },
              { href: "/login", title: text.q4, desc: text.q4d },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-primary hover:bg-white"
              >
                <div className="text-base font-semibold text-slate-900">
                  {item.title}
                </div>
                <div className="mt-1 text-sm text-slate-500">{item.desc}</div>
              </Link>
            ))}
          </div>
        </TableCard>
      </div>

      <TableCard
        title={text.recentTitle}
        description={text.recentDesc}
        right={`${receipts.length} ${text.rows}`}
      >
        {receipts.length === 0 ? (
          <div className="p-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
              {text.noRecent}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-50 text-left text-sm text-slate-500">
                  <th className="px-4 py-3 font-medium">{text.receiptNo}</th>
                  <th className="px-4 py-3 font-medium">{text.supplier}</th>
                  <th className="px-4 py-3 font-medium">{text.status}</th>
                  <th className="px-4 py-3 font-medium">{text.updatedAt}</th>
                  <th className="px-4 py-3 text-right font-medium">
                    {text.view}
                  </th>
                </tr>
              </thead>

              <tbody>
                {receipts.map((receipt) => (
                  <tr
                    key={receipt.id}
                    className="border-t border-slate-100 transition hover:bg-secondary-accent/30"
                  >
                    <td className="px-4 py-4 align-top">
                      <div className="font-semibold text-slate-900">
                        {receipt.receipt_no}
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        {receipt.id}
                      </div>
                    </td>

                    <td className="px-4 py-4 align-top text-sm text-slate-600">
                      {receipt.supplier_name || text.noSupplier}
                    </td>

                    <td className="px-4 py-4 align-top text-sm text-slate-600">
                      {statusLabel(receipt.status)}
                    </td>

                    <td className="px-4 py-4 align-top text-sm text-slate-600">
                      {formatTime(receipt.updated_at, lang)}
                    </td>

                    <td className="px-4 py-4 align-top text-right">
                      <Link
                        href={`/receipts/${receipt.id}`}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        {text.view}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TableCard>
    </AppShell>
  );
}
