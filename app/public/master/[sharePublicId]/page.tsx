import { prisma } from "@/lib/prisma";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { notFound } from "next/navigation";
import { ShareActions } from "./ShareActions";

type Props = Readonly<{
  params: {
    sharePublicId: string;
  };
}>;

export default async function PublicMasterPage({ params }: Props) {
  const lang = getLang();
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

  const publicPath = `/public/master/${sharePublicId}`;
  const downloadPath = `/api/public/master/${sharePublicId}/download`;

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-[#2f3c7e]">
          {t(lang, "public.master.title")}
        </h1>
        <p className="text-slate-500 font-mono">{share.master.master_no}</p>

        <ShareActions lang={lang} publicPath={publicPath} />
      </div>

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

      <div className="flex justify-center">
        <a
          href={downloadPath}
          className="bg-[#2f3c7e] text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:opacity-90 transition-opacity"
        >
          {t(lang, "public.master.downloadXlsx")}
        </a>
      </div>

      <div className="text-center text-xs text-slate-400">
        {t(lang, "public.master.noPricingNote")}
      </div>
    </div>
  );
}
