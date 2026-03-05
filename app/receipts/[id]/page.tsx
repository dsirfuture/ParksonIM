import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const runtime = "nodejs";

export default async function ReceiptDetailPage(props: any) {
  const params = props?.params as { id: string } | undefined;
  const id = params?.id?.trim();
  if (!id) notFound();

  const session = await getSession();
  const lang = getLang(); // ✅ no await (match our i18n-server)

  if (!session) return <div>{t(lang, "auth.required")}</div>;

  const receipt = await prisma.receipt.findFirst({
    where: {
      id,
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    include: {
      items: { orderBy: { sku: "asc" } },
      evidences: true,
      logs: { take: 10, orderBy: { created_at: "desc" } },
    },
  });

  if (!receipt) notFound();

  const exportHref = `/api/receipts/${receipt.id}/export`;
  // 如果你后面做“公开证据页”，可以把 shareHref 指向那页；先留占位
  const shareHref = `/receipts/${receipt.id}`; // 暂时不做公开分享，避免误跳

  const statusKey =
    receipt.status === "pending"
      ? "receipt.status.pending"
      : receipt.status === "in_progress"
      ? "receipt.status.in_progress"
      : "receipt.status.completed";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-[#2f3c7e]">{receipt.receipt_no}</h1>

            <span
              className={`px-3 py-1 rounded-full text-sm font-bold ${
                receipt.status === "completed"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {t(lang, statusKey)}
            </span>

            {receipt.locked ? (
              <span className="px-3 py-1 rounded-full text-sm font-bold bg-slate-100 text-slate-600">
                {t(lang, "receipt.locked")}
              </span>
            ) : null}
          </div>

          <p className="text-slate-500">
            {receipt.supplier_name || t(lang, "common.na")}
          </p>
        </div>

        <div className="flex gap-3">
          <a
            href={exportHref}
            className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors"
          >
            {t(lang, "common.export")}
          </a>

          <a
            href={shareHref}
            className="bg-[#2f3c7e] text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            {t(lang, "common.share")}
          </a>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">{t(lang, "receipt.detail.totalItems")}</div>
          <div className="text-2xl font-bold">{receipt.total_items}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">{t(lang, "receipt.detail.completedItems")}</div>
          <div className="text-2xl font-bold">{receipt.completed_items}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">{t(lang, "receipt.detail.progress")}</div>
          <div className="text-2xl font-bold text-[#2f3c7e]">
            {Number(receipt.progress_percent || 0).toFixed(1)}%
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">{t(lang, "item.col.image") /* 用作“照片/证据”可换key */}</div>
          <div className="text-2xl font-bold">{receipt.evidences.length}</div>
        </div>
      </div>

      {/* Items table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700">
          {t(lang, "receipt.detail.section.items")}
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wider">
              <th className="p-4 font-semibold">{t(lang, "item.col.sku")} / {t(lang, "item.col.barcode")}</th>
              <th className="p-4 font-semibold">{t(lang, "common.note")}</th>
              <th className="p-4 font-semibold">{t(lang, "scan.section.expected")}</th>
              <th className="p-4 font-semibold">{t(lang, "item.col.goodQty")}</th>
              <th className="p-4 font-semibold">{t(lang, "item.col.damagedQty")}</th>
              <th className="p-4 font-semibold">{t(lang, "item.col.status")}</th>
            </tr>
          </thead>

          <tbody>
            {receipt.items.map((item) => (
              <tr
                key={item.id}
                className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
              >
                <td className="p-4">
                  <div className="font-mono text-sm font-bold">{item.sku}</div>
                  <div className="text-xs text-slate-400">{item.barcode || "-"}</div>
                </td>

                <td className="p-4">
                  <div className="text-sm">{lang === "zh" ? item.name_zh : item.name_es}</div>
                  {item.unexpected ? (
                    <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1 rounded">
                      {t(lang, "scan.section.unexpected")}
                    </span>
                  ) : null}
                </td>

                <td className="p-4 font-mono">{item.expected_qty}</td>
                <td className="p-4 font-mono text-emerald-600 font-bold">{item.good_qty}</td>
                <td className="p-4 font-mono text-red-600 font-bold">{item.damaged_qty}</td>

                <td className="p-4">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      item.status === "completed"
                        ? "bg-emerald-100 text-emerald-700"
                        : item.status === "in_progress"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {t(
                      lang,
                      item.status === "pending"
                        ? "item.status.pending"
                        : item.status === "in_progress"
                        ? "item.status.in_progress"
                        : "item.status.completed"
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
