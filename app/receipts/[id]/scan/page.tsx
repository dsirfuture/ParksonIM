'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { t, Lang } from '@/lib/i18n';
import { BRAND } from '@/lib/brand';

export default function ScanWorkstation() {
  const params = useParams();
  const [lang, setLang] = useState<Lang>('zh');
  const [barcode, setBarcode] = useState('');
  const [receipt, setReceipt] = useState<any>(null);
  const [lastItems, setLastItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const l = document.cookie.split('; ').find(row => row.startsWith('lang='))?.split('=')[1] as Lang;
    setLang(l || 'zh');
    
    const init = async () => {
      await fetchReceipt();
    };
    init();

    const interval = setInterval(pollDelta, 3000);
    return () => clearInterval(interval);
  }, [params.id]); // Added params.id as dependency

  const fetchReceipt = async () => {
    const res = await fetch(`/api/receipts/${params.id}`);
    const data = await res.json();
    setReceipt(data);
  };

  const pollDelta = async () => {
    if (!receipt) return;
    const res = await fetch(`/api/receipts/${params.id}/delta?since=${receipt.last_activity_at}`);
    if (res.ok) {
      const delta = await res.json();
      if (delta.changed) {
        setReceipt(delta.receipt);
        // Update local items if needed
      }
    }
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/receipts/${params.id}/items/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          barcode_or_sku: barcode,
          delta_good: 1,
          delta_damaged: 0,
          receipt_version: receipt.version,
          operator_id: 'user-1',
          device_id: 'browser-1',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Scan failed');
      } else {
        setReceipt(data.receipt);
        setLastItems([data.item, ...lastItems.slice(0, 4)]);
        setBarcode('');
        inputRef.current?.focus();
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (!receipt) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-[#2f3c7e] text-white p-6 rounded-2xl shadow-lg flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{t(lang, "scan.title")}</h1>
          <p className="opacity-80 font-mono text-sm">{receipt.receipt_no}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold">{receipt.progress_percent.toFixed(1)}%</div>
          <div className="text-xs opacity-70">{receipt.completed_items} / {receipt.total_items}</div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <form onSubmit={handleScan} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {t(lang, "scan.barcode")}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className="w-full p-4 text-2xl font-mono border-2 border-slate-200 rounded-xl focus:border-[#2f3c7e] focus:ring-0 transition-colors"
              autoFocus
              disabled={loading}
            />
          </div>
          {error && <div className="text-red-600 text-sm font-medium">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2f3c7e] text-white p-4 rounded-xl font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? '...' : t(lang, "scan.submit")}
          </button>
        </form>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-700">最近扫描</h2>
        <div className="space-y-2">
          {lastItems.map((item, i) => (
            <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 flex justify-between items-center animate-in fade-in slide-in-from-top-2">
              <div>
                <div className="font-bold">{lang === 'zh' ? item.name_zh : item.name_es}</div>
                <div className="text-xs text-slate-500 font-mono">{item.sku}</div>
              </div>
              <div className="text-right">
                <div className="text-emerald-600 font-bold">+{item.good_qty}</div>
                <div className="text-xs text-slate-400">{new Date(item.last_updated_at).toLocaleTimeString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
