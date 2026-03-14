import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { TableCard } from "@/components/table-card";
import { getLang } from "@/lib/i18n-server";

type TabKey = "customer" | "supplier";
type SearchParams = Record<string, string | string[] | undefined>;

const TAB_LIST: TabKey[] = ["customer", "supplier"];

function normalizeTab(tab: string | null | undefined): TabKey {
  return tab === "supplier" ? "supplier" : "customer";
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const lang = await getLang();
  const params = (await searchParams) || {};
  const tabRaw = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const activeTab = normalizeTab(tabRaw || null);

  const text =
    lang === "zh"
      ? {
          badge: "账单与对账",
          title: "对账与账单",
          desc: "汇总已完成验货单，生成对账结果，并为后续下载、分享与留痕做准备。",
          receiptsBtn: "查看验货单",
          exportBtn: "导出预留",
          tabCustomer: "客户出账单",
          tabSupplier: "供应商账单",
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
          badge: "Facturacion y conciliacion",
          title: "Conciliacion y facturas",
          desc: "Consolida recepciones completadas, genera resultados de conciliacion y prepara descarga, compartir y trazabilidad.",
          receiptsBtn: "Ver recepciones",
          exportBtn: "Reserva de exportacion",
          tabCustomer: "Factura clientes",
          tabSupplier: "Factura proveedores",
          totalBills: "Total de facturas",
          pendingBills: "Pendientes",
          reviewingBills: "Por revisar",
          finishedBills: "Listas para salida",
          totalHint: "Contara todos los lotes de facturacion",
          pendingHint: "Esperando generar resultado consolidado",
          reviewingHint: "Esperando confirmacion manual",
          finishedHint: "Facturas listas para descargar o compartir",
          processTitle: "Flujo de conciliacion",
          processDesc: "Se recomienda completar en este orden",
          p1: "1. Elegir las recepciones completadas que deben consolidarse.",
          p2: "2. Generar el resultado consolidado y revisar cantidad, diferencia y anomalias.",
          p3: "3. Hacer revision manual del contenido antes de salida.",
          p4: "4. Luego podra soportar descarga, enlace compartido y acceso publico.",
          outputTitle: "Capacidades de salida",
          outputDesc: "Esta pagina define primero la capacidad principal a conectar despues",
          o1: "Vista de resultado consolidado",
          o2: "Descarga de archivo",
          o3: "Generacion de enlace compartido",
          o4: "Pagina de acceso publico",
          o5: "Auditoria y trazabilidad de estado",
          recentTitle: "Facturas recientes",
          recentDesc: "Aqui se mostraran lotes, estado, fecha y acciones",
          recentEmpty:
            "Todavia no hay registros de facturacion. Cuando se conecte la logica real, aqui apareceran facturas recientes.",
          shareTitle: "Zona de compartir y descarga",
          shareDesc: "Aqui se conectaran descarga, copia de enlace y acceso publico",
          shareEmpty:
            "Todavia no hay contenido para compartir. Cuando se conecte la capacidad real, aqui apareceran acciones de descarga y compartir.",
        };

  const tabLabel = activeTab === "customer" ? text.tabCustomer : text.tabSupplier;

  return (
    <AppShell>
      <section className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="bg-white px-5 pt-4">
          <div className="flex flex-wrap items-end gap-2">
            {TAB_LIST.map((tab) => {
              const selected = activeTab === tab;
              const label = tab === "customer" ? text.tabCustomer : text.tabSupplier;
              return (
                <Link
                  key={tab}
                  href={`/billing?tab=${tab}`}
                  className={[
                    "inline-flex min-w-[148px] items-center justify-center rounded-t-2xl border px-4 py-2 text-sm font-semibold transition",
                    selected
                      ? "border-slate-200 bg-white text-slate-900"
                      : "border-transparent bg-slate-200 text-slate-600 hover:bg-slate-300",
                  ].join(" ")}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="p-5">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        </div>
      </section>
    </AppShell>
  );
}
