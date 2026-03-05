import { getSession } from "@/lib/tenant";
import { getLang } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export default async function BillingPage() {
  const session = await getSession();
  const lang = await getLang();

  if (!session) return <div>Access Denied</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#2f3c7e]">{t(lang, "billing.title")}</h1>
        <p className="text-slate-500">{t(lang, "billing.subtitle")}</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="font-semibold text-slate-700">{t(lang, "billing.notReadyTitle")}</div>
        <p className="text-sm text-slate-500 mt-2">{t(lang, "billing.notReadyDesc")}</p>
      </div>
    </div>
  );
}
