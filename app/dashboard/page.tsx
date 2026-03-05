import { getSession } from "@/lib/tenant";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export default async function DashboardPage() {
  const session = await getSession();
  const lang = await getLang();

  if (!session) return <div>Access Denied</div>;

  // Temporary placeholder numbers (until Prisma schema/migrations align)
  const data = {
    total_receipts: 0,
    pending: 0,
    in_progress: 0,
    completed: 0,
    total_items_sum: 0,
    completed_items_sum: 0,
  };

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2f3c7e]">{t(lang, "dashboard.title")}</h1>
          <p className="text-slate-500">{t(lang, "dashboard.subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">{t(lang, "dashboard.cards.totalReceipts")}</div>
          <div className="text-2xl font-bold">{data.total_receipts}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">{t(lang, "dashboard.cards.pending")}</div>
          <div className="text-2xl font-bold">{data.pending}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">{t(lang, "dashboard.cards.inProgress")}</div>
          <div className="text-2xl font-bold">{data.in_progress}</div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">{t(lang, "dashboard.cards.completed")}</div>
          <div className="text-2xl font-bold">{data.completed}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="font-semibold text-slate-700">{t(lang, "dashboard.noteTitle")}</div>
        <p className="text-sm text-slate-500 mt-2">{t(lang, "dashboard.noteDesc")}</p>
      </div>
    </div>
  );
}
