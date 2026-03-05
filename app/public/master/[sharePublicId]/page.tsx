import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export default async function PublicMasterPage({
  params,
}: {
  params: Promise<{ sharePublicId: string }>;
}) {
  const lang = await getLang();
  const { sharePublicId } = await params;

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-10">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-[#2f3c7e]">
          {t(lang, "public.master.title")}
        </h1>
        <p className="text-slate-500 font-mono">{sharePublicId}</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="font-semibold text-slate-700">
          {t(lang, "public.master.notReadyTitle")}
        </div>
        <p className="text-sm text-slate-500 mt-2">
          {t(lang, "public.master.notReadyDesc")}
        </p>
      </div>
    </div>
  );
}
