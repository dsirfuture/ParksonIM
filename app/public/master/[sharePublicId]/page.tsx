import { prisma } from '@/lib/prisma';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { notFound } from 'next/navigation';

export default async function PublicMasterPage({
  params,
}: {
  params: { sharePublicId: string };
}) {
  const lang = await getLang();
  const share = await prisma.masterShareLink.findUnique({
    where: { share_public_id: params.sharePublicId },
    include: {
      master: {
        include: {
          sources: { include: { receipt: true } }
        }
      }
    }
  });

  if (!share || !share.active || (share.expires_at && new Date() > share.expires_at)) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-[#2f3c7e]">{t(lang, "public.master.title")}</h1>
        <p className="text-slate-500 font-mono">{share.master.master_no}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700">关联验货单</div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wider">
              <th className="p-4 font-semibold">单号</th>
              <th className="p-4 font-semibold">供应商</th>
              <th className="p-4 font-semibold">状态</th>
            </tr>
          </thead>
          <tbody>
            {share.master.sources.map((s) => (
              <tr key={s.id} className="border-b border-slate-50">
                <td className="p-4 font-mono text-sm">{s.receipt.receipt_no}</td>
                <td className="p-4 text-sm">{s.receipt.supplier_name || '-'}</td>
                <td className="p-4">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">
                    {s.receipt.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center">
        <button className="bg-[#2f3c7e] text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:opacity-90 transition-opacity">
          下载完整结算单 (XLSX)
        </button>
      </div>
    </div>
  );
}
