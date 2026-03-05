import { prisma } from "@/lib/prisma";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { notFound } from "next/navigation";

export default async function PublicMasterPage({
  params,
}: {
  params: { sharePublicId: string };
}) {
  const lang = getLang(); // ✅ no await
  const sharePublicId = params.sharePublicId;

  const share = await prisma.masterShareLink.findUnique({
    where: { share_public_id: sharePublicId },
    include: {
      master: {
        include: {
          sources: { include: { receipt: true } },
        },
      },
    },
  });

  if (!share || !share.active || (share.expires_at && new Date() > share.expires_at)) {
    notFound();
  }

  const publicUrl = `/public/master/${sharePublicId}`;
  const downloadUrl = `/api/public/master/${sharePublicId}/download`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(publicUrl)}`;

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-[#2f3c7e]">
          {t(lang, "public.master.title")}
        </h1>
        <p className="text-slate-500 font-mono">{share.master.master_no}</p>

        {/* Share actions (public, no token) */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {/* Copy link */}
          <button
            type="button"
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50"
            onClick={async () => {
              // 这里是 Client 行为：用一个小技巧，避免把整个页面变成 client component
              // 通过 window.location.origin 拼成完整链接
              const full = `${window.location.origin}${publicUrl}`;
              await navigator.clipboard.writeText(full);
              alert(t(lang, "public.master.copied"));
            }}
          >
            {t(lang, "public.master.copyLink")}
          </button>

          {/* WhatsApp */}
          <a
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50"
            href={waUrl}
            target="_blank"
            rel="noreferrer"
          >
            {t(lang, "public.master.shareWhatsapp")}
          </a>

          {/* WeChat: same as copy link */}
          <button
            type="button"
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50"
            onClick={async () => {
              const full = `${window.location.origin}${publicUrl}`;
              await navigator.clipboard.writeText(full);
              alert(t(lang, "public.master.wechatHint"));
            }}
          >
            {t(lang, "public.master.shareWechat")}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 font-bold text-slate-700">
          {t(lang, "public.master.linkedReceipts")}
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase tracking-wider">
              <th className="p-4 font-semibold">{t(lang, "public.master.th.receiptNo")}</th>
              <th className="p-4 font-semibold">{t(lang, "public.master.th.supplier")}</th>
              <th className="p-4 font-semibold">{t(lang, "public.master.th.status")}</th>
            </tr>
          </thead>
          <tbody>
            {share.master.sources.map((s) => (
              <tr key={s.id} className="border-b border-slate-50">
                <td className="p-4 font-mono text-sm">{s.receipt.receipt_no}</td>
                <td className="p-4 text-sm">{s.receipt.supplier_name || "-"}</td>
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

      {/* Download */}
      <div className="flex justify-center">
        <a
          href={downloadUrl}
          className="bg-[#2f3c7e] text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:opacity-90 transition-opacity"
        >
          {t(lang, "public.master.downloadXlsx")}
        </a>
      </div>

      {/* Note: public page must not show price/discount/amount */}
      <div className="text-center text-xs text-slate-400">
        {t(lang, "public.master.noPricingNote")}
      </div>
    </div>
  );
}
