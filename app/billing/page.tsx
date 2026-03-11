import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { TableCard } from "@/components/table-card";
import { getLang } from "@/lib/i18n-server";

export default async function BillingPage() {
  const lang = await getLang();

  const text =
    lang === "zh"
      ? {
          badge: "账单与对账",
          title: "对账与账单",
          desc: "汇总已完成验货单，生成对账结果，并为后续下载、分享与留痕做准备。",
          receiptsBtn: "查看验货单",
          exportBtn: "导出预留",
          totalBills: "账单总数",
          pendingBills: "待生成",
          reviewingBills: "待复核",
          finishedBills: "可输出",
          totalHint: "后续统计全部账单批次",
          pendingHint: "等待生成汇总结果",
          reviewingHint: "等待人工确认或复核",
          finishedHint: "可下载或分享的账单",
          processTitle: "对账流程",
          processDesc: "建议按这个顺序完成账单处理",
          p1: "1. 从已完成验货单中选择需要汇总的记录。",
          p2: "2. 生成账单汇总结果，并检查数量、差异与异常。",
          p3: "3. 人工复核账单内容，确认后进入输出阶段。",
          p4: "4. 后续可支持下载、分享链接和公共访问页。",
          outputTitle: "输出能力",
          outputDesc: "当前页面先定义后续要承接的核心能力",
          o1: "账单汇总结果展示",
          o2: "下载文件输出",
          o3: "分享链接生成",
          o4: "公共访问页",
          o5: "审计日志与状态留痕",
          recentTitle: "最近账单记录",
          recentDesc: "后续这里展示账单批次、状态、时间与操作入口",
          recentEmpty:
            "当前还没有账单记录。后续接入汇总账单逻辑后，这里会展示最近生成的账单。",
          shareTitle: "分享与下载预留区",
          shareDesc: "后续这里接入下载、复制链接、公共访问与状态控制能力",
          shareEmpty:
            "当前还没有可分享的账单内容。接入真实账单能力后，这里会展示下载、分享与公开访问入口。",
        }
      : {
          badge: "Facturación y conciliación",
          title: "Conciliación y facturas",
          desc: "Consolida recepciones completadas, genera resultados de conciliación y prepara la descarga, el compartir y el registro del proceso.",
          receiptsBtn: "Ver recepciones",
          exportBtn: "Reserva de exportación",
          totalBills: "Total de facturas",
          pendingBills: "Pendientes",
          reviewingBills: "Por revisar",
          finishedBills: "Listas para salida",
          totalHint: "Después contará todos los lotes de facturación",
          pendingHint: "Esperando generar el resultado consolidado",
          reviewingHint: "Esperando revisión manual",
          finishedHint: "Listas para descargar o compartir",
          processTitle: "Flujo de conciliación",
          processDesc: "Se recomienda completar la operación en este orden",
          p1: "1. Elegir las recepciones completadas que deben consolidarse.",
          p2: "2. Generar el resultado de conciliación y revisar cantidades, diferencias y anomalías.",
          p3: "3. Hacer una revisión manual del contenido antes de la salida final.",
          p4: "4. Después se podrá soportar descarga, enlace compartido y acceso público.",
          outputTitle: "Capacidades de salida",
          outputDesc:
            "Por ahora esta página define las funciones que se conectarán después",
          o1: "Vista del resultado consolidado",
          o2: "Salida de archivo descargable",
          o3: "Generación de enlace compartido",
          o4: "Página pública de acceso",
          o5: "Bitácora y trazabilidad del estado",
          recentTitle: "Facturas recientes",
          recentDesc:
            "Después aquí se mostrarán lotes, estado, fecha y acciones",
          recentEmpty:
            "Todavía no hay registros de facturación. Cuando se conecte la lógica real, aquí aparecerán las facturas más recientes.",
          shareTitle: "Área de compartir y descargar",
          shareDesc:
            "Después aquí se conectarán descarga, copia de enlace, acceso público y control de estado",
          shareEmpty:
            "Todavía no hay contenido disponible para compartir. Cuando se conecte la capacidad real, aquí aparecerán las acciones de descarga y compartir.",
        };

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
              {text.receiptsBtn}
            </Link>

            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-soft transition hover:opacity-95"
            >
              {text.exportBtn}
            </button>
          </>
        }
      />

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={text.totalBills} value="0" hint={text.totalHint} />
        <StatCard
          label={text.pendingBills}
          value="0"
          hint={text.pendingHint}
          valueClassName="text-amber-600"
        />
        <StatCard
          label={text.reviewingBills}
          value="0"
          hint={text.reviewingHint}
          valueClassName="text-blue-600"
        />
        <StatCard
          label={text.finishedBills}
          value="0"
          hint={text.finishedHint}
          valueClassName="text-emerald-600"
        />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
        <TableCard title={text.processTitle} description={text.processDesc}>
          <div className="p-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <ul className="space-y-2 text-sm leading-6 text-slate-600">
                <li>{text.p1}</li>
                <li>{text.p2}</li>
                <li>{text.p3}</li>
                <li>{text.p4}</li>
              </ul>
            </div>
          </div>
        </TableCard>

        <TableCard title={text.outputTitle} description={text.outputDesc}>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {[text.o1, text.o2, text.o3, text.o4, text.o5].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="text-sm font-medium text-slate-700">{item}</div>
              </div>
            ))}
          </div>
        </TableCard>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
        <TableCard title={text.recentTitle} description={text.recentDesc}>
          <div className="p-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
              {text.recentEmpty}
            </div>
          </div>
        </TableCard>

        <TableCard title={text.shareTitle} description={text.shareDesc}>
          <div className="p-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
              {text.shareEmpty}
            </div>
          </div>
        </TableCard>
      </div>
    </AppShell>
  );
}
