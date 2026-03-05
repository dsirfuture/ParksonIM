import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/tenant';
import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function ReceiptDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  const lang = await getLang();

  if (!session) return <div>Access Denied</div>;

  const receipt = await prisma.receipt.findUnique({
    where: { id: params.id },
    include: {
      items: { orderBy: { sku: 'asc' } },
      evidences: true,
      logs: { take: 10, orderBy: { created_at: 'desc' } }
    }
  });

  if (!receipt) notFound();

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-[#2f3c7e]">{receipt.receipt_no}</h1>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
              receipt.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {t(lang, `status.${receipt.status}`)}
            </span>
          </div>
          <p className="text-slate-500">{receipt.supplier_name || '未知供应商'}</p>
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
          <div className="text-sm text-slate-500 mb-1">总SKU数</div>
          <div className="text-2xl font-bold">{receipt.total_items}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">已完成</div>
          <div className="text-2xl font-bold">{receipt.completed_items}</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">进度</div>
          <div className="text-2xl font-bold text-[#2f3c7e]">{receipt.progress_percent.toFixed(1)}%</div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-sm text-slate-500 mb-1">照片数量</div>
          <div className="text-2xl font-bold">{receipt.evidences.length}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700">商品详情</div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wider">
              <th className="p-4 font-semibold">SKU / 条码</th>
              <th className="p-4 font-semibold">名称</th>
              <th className="p-4 font-semibold">预期</th>
              <th className="p-4 font-semibold">良品</th>
              <th className="p-4 font-semibold">不良</th>
              <th className="p-4 font-semibold">状态</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.map((item) => (
              <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="p-4">
                  <div className="font-mono text-sm font-bold">{item.sku}</div>
                  <div className="text-xs text-slate-400">{item.barcode}</div>
                </td>
                <td className="p-4">
                  <div className="text-sm">{lang === 'zh' ? item.name_zh : item.name_es}</div>
                  {item.unexpected && <span className="text-[10px] bg-amber-100 text-amber-700 px-1 rounded">意外</span>}
                </td>
                <td className="p-4 font-mono">{item.expected_qty}</td>
                <td className="p-4 font-mono text-emerald-600 font-bold">{item.good_qty}</td>
                <td className="p-4 font-mono text-red-600 font-bold">{item.damaged_qty}</td>
                <td className="p-4">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    item.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {item.status}
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
