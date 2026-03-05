'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { t, Lang } from '@/lib/i18n';

export default function ImportWizard() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [receiptNo, setReceiptNo] = useState('');
  const [batch, setBatch] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>('zh');

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !receiptNo) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('receipt_no', receiptNo);

    try {
      const res = await fetch('/api/receipts/import/validate', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setBatch(data);
      } else {
        setError(data.error?.message || 'Validation failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!batch || loading) return;

    setLoading(true);
    try {
      const res = await fetch('/api/receipts/import/commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({ batch_id: batch.batch_id }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/receipts/${data.id}`);
      } else {
        setError(data.error?.message || 'Commit failed');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-[#2f3c7e]">导入验货单</h1>

      {!batch ? (
        <form onSubmit={handleValidate} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">验货单号</label>
            <input
              type="text"
              value={receiptNo}
              onChange={(e) => setReceiptNo(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#2f3c7e] outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Excel 文件 (SKU, barcode, total_qty...)</label>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full p-3 border border-slate-200 rounded-lg"
              required
            />
          </div>
          {error && <div className="text-red-600 text-sm font-medium">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2f3c7e] text-white p-3 rounded-lg font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? '正在验证...' : '验证文件'}
          </button>
        </form>
      ) : (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold">验证结果: {batch.status}</h2>
            <button onClick={() => setBatch(null)} className="text-slate-500 hover:underline text-sm">重新上传</button>
          </div>

          <div className="space-y-4">
            <div className="text-sm font-medium text-slate-700">预览 (前 5 行):</div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="p-2 border border-slate-100">SKU</th>
                    <th className="p-2 border border-slate-100">条码</th>
                    <th className="p-2 border border-slate-100">数量</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.preview.map((row: any, i: number) => (
                    <tr key={i}>
                      <td className="p-2 border border-slate-100">{row.sku}</td>
                      <td className="p-2 border border-slate-100">{row.barcode}</td>
                      <td className="p-2 border border-slate-100">{row.expected_qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {batch.exceptions.length > 0 && (
            <div className="p-4 bg-red-50 rounded-lg space-y-2">
              <div className="text-red-700 font-bold text-sm">发现错误:</div>
              <ul className="text-xs text-red-600 list-disc list-inside">
                {batch.exceptions.map((ex: any, i: number) => (
                  <li key={i}>第 {ex.row_number} 行 ({ex.field}): {ex.message}</li>
                ))}
              </ul>
            </div>
          )}

          {batch.status === 'validated' && (
            <button
              onClick={handleCommit}
              disabled={loading}
              className="w-full bg-emerald-600 text-white p-3 rounded-lg font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? '正在提交...' : '确认导入'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
