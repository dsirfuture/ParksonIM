import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/tenant';

export default async function DashboardPage() {
  const lang = await getLang();
  const session = await getSession();

  if (!session) return null;

  const stats = await prisma.receipt.aggregate({
    where: { tenant_id: session.tenantId },
    _count: { id: true },
    _sum: { completed_items: true, total_items: true }
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-[#2f3c7e]">{t(lang, "dashboard.title")}</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">总验货单</div>
          <div className="text-4xl font-black text-[#2f3c7e]">{stats._count.id}</div>
        </div>
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">已扫描商品</div>
          <div className="text-4xl font-black text-emerald-600">{stats._sum.completed_items || 0}</div>
        </div>
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">预期商品</div>
          <div className="text-4xl font-black text-slate-800">{stats._sum.total_items || 0}</div>
        </div>
      </div>
    </div>
  );
}
