import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { getLang } from "@/lib/i18n-server";
import { ReceiptsTableClient } from "./ReceiptsTableClient";

function getStatusLabel(status: string, lang: "zh" | "es") {
  if (lang === "zh") {
    switch (status) {
      case "pending":
        return "待验货";
      case "in_progress":
        return "验货进行中";
      case "completed":
        return "已完成";
      default:
        return "未知状态";
    }
  }

  switch (status) {
    case "pending":
      return "Pend. insp.";
    case "in_progress":
      return "En insp.";
    case "completed":
      return "Completada";
    default:
      return "Desconocido";
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case "pending":
      return "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200";
    case "in_progress":
      return "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200";
    case "completed":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200";
    default:
      return "bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-200";
  }
}

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
    hour12: false,
  }).format(date);
}

export default async function ReceiptsPage() {
  const session = await getSession();
  const lang = await getLang();

  const text =
    lang === "zh"
      ? {
          total: "全部验货单",
          pending: "待验货",
          progress: "验货进行中",
          completed: "已完成",
          importTitle: "导入验货单",
          importHint: "上传并生成新的验货单",
          totalHint: "当前公司全部记录",
          pendingHint: "尚未开始验货",
          progressHint: "正在进行验货作业",
          completedHint: "已完成验货流程",
          listTitle: "验货单列表",
          listDesc: "按上传文件时间倒序展示最近的验货单",
          rows: "条记录",
          searchPlaceholder: "搜索供应商名称、单号、时间、状态",
          receiptNo: "单号",
          supplier: "供应商",
          skuCount: "SKU",
          expectedQty: "应验数量",
          progressCol: "进度",
          status: "状态",
          uploadedAt: "上传文件时间",
          noSupplier: "未填写",
          noDataTitle: "暂无验货单数据",
          noDataDesc:
            "当前公司还没有验货单记录。建议先从导入页面上传文件，再回到这里查看列表。",
          noDataBtn: "前往导入",
          view: "查看详情",
          scan: "去扫描",
          sessionError:
            "未获取到开发会话，请检查 DEV_TENANT_ID / DEV_COMPANY_ID 配置。",
          emptySearch: "没有匹配到相关验货单",
          previousPage: "上一页",
          nextPage: "下一页",
        }
      : {
          total: "Recepciones",
          pending: "Pend. insp.",
          progress: "En insp.",
          completed: "Completadas",
          importTitle: "Importar",
          importHint: "Subir archivo y crear recepción",
          totalHint: "Todos los registros actuales",
          pendingHint: "Aún no iniciadas",
          progressHint: "Inspección en curso",
          completedHint: "Proceso completado",
          listTitle: "Lista recep.",
          listDesc: "Orden por carga",
          rows: "registros",
          searchPlaceholder: "Buscar proveedor, número, fecha, estado",
          receiptNo: "Número",
          supplier: "Prov.",
          skuCount: "SKU",
          expectedQty: "Cant. esp.",
          progressCol: "Progreso",
          status: "Estado",
          uploadedAt: "Hora carga",
          noSupplier: "Sin proveedor",
          noDataTitle: "No hay recepciones",
          noDataDesc:
            "La compañía aún no tiene registros. Primero importa un archivo y luego vuelve a esta lista.",
          noDataBtn: "Ir a importar",
          view: "Ver detalle",
          scan: "Escanear",
          sessionError:
            "No se obtuvo la sesión de desarrollo. Revisa DEV_TENANT_ID y DEV_COMPANY_ID.",
          emptySearch: "No se encontraron recepciones",
          previousPage: "Anterior",
          nextPage: "Siguiente",
        };

  if (!session) {
    return (
      <AppShell>
        <div className="rounded-xl border border-red-200 bg-white p-5 shadow-soft">
          <h1 className="text-xl font-bold text-slate-900">
            {lang === "zh" ? "验货单管理" : "Gestión de recepciones"}
          </h1>
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
    include: {
      items: {
        select: {
          expected_qty: true,
        },
      },
    },
    orderBy: {
      updated_at: "desc",
    },
  });

  const pendingCount = receipts.filter(
    (item) => item.status === "pending",
  ).length;
  const progressCount = receipts.filter(
    (item) => item.status === "in_progress",
  ).length;
  const completedCount = receipts.filter(
    (item) => item.status === "completed",
  ).length;

  const rows = receipts.map((receipt) => ({
    id: receipt.id,
    receiptNo: receipt.receipt_no,
    supplierName: receipt.supplier_name,
    totalItems: receipt.total_items,
    expectedQty: receipt.items.reduce(
      (sum, item) => sum + (item.expected_qty ?? 0),
      0,
    ),
    completedItems: receipt.completed_items,
    progressPercent: receipt.progress_percent || 0,
    status: receipt.status,
    statusLabel: getStatusLabel(receipt.status, lang),
    statusClassName: getStatusClass(receipt.status),
    uploadedAtText: formatTime(receipt.updated_at, lang),
  }));

  return (
    <AppShell>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={text.total}
          value={receipts.length}
          hint={text.totalHint}
        />
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

        <div className="flex min-h-[140px] flex-col justify-between rounded-xl bg-white p-5 shadow-soft">
          <div>
            <div className="text-sm font-medium text-slate-700">
              {text.importTitle}
            </div>
            <div className="mt-3 text-sm text-slate-400">{text.importHint}</div>
          </div>

          <div className="mt-5">
            <Link
              href="/receipts/import"
              className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {text.importTitle}
            </Link>
          </div>
        </div>
      </section>

      {receipts.length === 0 ? (
        <section className="mt-5 overflow-hidden rounded-xl bg-white shadow-soft">
          <EmptyState
            title={text.noDataTitle}
            description={text.noDataDesc}
            action={
              <Link
                href="/receipts/import"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {text.noDataBtn}
              </Link>
            }
          />
        </section>
      ) : (
        <ReceiptsTableClient
          text={{
            listTitle: text.listTitle,
            listDesc: text.listDesc,
            rows: text.rows,
            searchPlaceholder: text.searchPlaceholder,
            receiptNo: text.receiptNo,
            supplier: text.supplier,
            skuCount: text.skuCount,
            expectedQty: text.expectedQty,
            progressCol: text.progressCol,
            status: text.status,
            uploadedAt: text.uploadedAt,
            noSupplier: text.noSupplier,
            view: text.view,
            scan: text.scan,
            emptySearch: text.emptySearch,
            previousPage: text.previousPage,
            nextPage: text.nextPage,
          }}
          rows={rows}
        />
      )}
    </AppShell>
  );
}
