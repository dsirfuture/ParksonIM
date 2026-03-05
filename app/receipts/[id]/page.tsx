import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { notFound } from "next/navigation";

export const runtime = "nodejs";

export default async function ReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const lang = await getLang();

  if (!session) return <div>Access Denied</div>;

  const { id } = await params;

  // No include() yet
  const receipt = await prisma.receipt.findFirst({
    where: {
      id,
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
  });

  if (!receipt) notFound();

  // ✅ TS-safe: prisma model typings not aligned yet, so use any + fallbacks
  const r: any = receipt;
  const status: string = (r?.status ?? "pending") as string;
  const receiptNo: string = (r?.receipt_no ?? id) as string;
  const supplierName: string = (r?.supplier_name ?? t(lang, "common.unknownSupplier")) as string;

  const totalItems: number = Number(r?.total_items ?? 0);
  const completedItems: number = Number(r?.completed_items ?? 0);
  const progressPercent: number = Number(r?.progress_percent ?? 0);

  // placeholders until ReceiptItem/Evidence/ScanLog are migrated
  const items: any[] = [];
  const evidences: any[] = [];
  const logs: any[] = [];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-[#2f3c7e]">{receiptNo}</h1>
            <span
              className={`px-3 py-1 rounded-full text-sm font-bold ${
                status === "completed"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {t(lang, `status.${status}`)}
            </span>
          </div>
          <p className="text-slate-500">{supplierName}</p>
        </div>

        <div className="flex gap-3">
          <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors">
            {t(lang, "common.export")}
          </button>
          <button className="bg-[#2f3c7e] text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity">
            {t(lang, "common.share")}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">{t(lang, "receipt.cards.totalSku")}</div>
          <div className="text-2xl font-bold">{totalItems}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">{t(lang, "receipt.cards.completed")}</div>
          <div className="text-2xl font-bold">{completedItems}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">{t(lang, "receipt.cards.progress")}</div>
          <div className="text-2xl font-bold text-[#2f3c7e]">{progressPercent.toFixed(1)}%</div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">{t(lang, "receipt.cards.photos")}</div>
          <div className="text-2xl font-bold">{evidences.length}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700">
          {t(lang, "receipt.items.title")}
        </div>

        <div className="p-6 text-sm text-slate-500">
          {t(lang, "receipt.items.notReady")}
          <div className="mt-2 text-xs text-slate-400">
            (items/evidence/logs will be enabled after Prisma migrations)
          </div>
        </div>
      </div>
    </div>
  );
}
