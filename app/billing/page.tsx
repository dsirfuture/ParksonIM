import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/tenant';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';

export default async function BillingPage() {
  const session = await getSession();
  const lang = await getLang();

  if (!session) return <div>Access Denied</div>;

  const masterReceipts = await prisma.masterReceipt.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    include: {
      sources: { include: { receipt: true } },
      shares: true,
    },
    orderBy: { created_at: 'desc' },
  });

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-[#2f3c7e]">{t(lang, "billing.title")}</h1>
        <button className="bg-[#2f3c7e] text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity">
          合并新结算单
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {masterReceipts.map((m) => (
          <div key={m.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-lg font-bold text-slate-800">{m.master_no}</div>
                <div className="text-xs text-slate-400">创建于 {new Date(m.created_at).toLocaleDateString()}</div>
              </div>
              <div className="flex gap-2">
                <button className="text-sm text-[#2f3c7e] font-medium hover:underline">
                  {t(lang, "common.share")}
                </button>
                <button className="text-sm text-slate-600 font-medium hover:underline">
                  {t(lang, "common.export")}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {m.sources.map((s) => (
                <span key={s.id} className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-mono">
                  {s.receipt.receipt_no}
                </span>
              ))}
            </div>

            {m.shares.length > 0 && (
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex justify-between items-center">
                <div className="text-xs text-blue-700 font-medium">
                  公开分享链接已激活
                </div>
                <button className="text-[10px] bg-white text-blue-700 px-2 py-1 rounded border border-blue-200 font-bold">
                  {t(lang, "common.copy_link")}
                </button>
              </div>
            )}
          </div>
        ))}

        {masterReceipts.length === 0 && (
          <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
            暂无结算单
          </div>
        )}
      </div>
    </div>
  );
}
