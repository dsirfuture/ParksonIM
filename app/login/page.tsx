import { getLang } from '@/lib/i18n-server';
import { t } from '@/lib/i18n';
import { BRAND } from '@/lib/brand';

export default async function LoginPage() {
  const lang = await getLang();

  return (
    <div className="max-w-md mx-auto mt-20 space-y-8">
      <div className="text-center space-y-2">
        <div className="text-4xl font-black text-[#2f3c7e] tracking-tighter">{BRAND.name}</div>
        <h1 className="text-xl font-medium text-slate-600">{t(lang, "login.title")}</h1>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
              {t(lang, "login.username")}
            </label>
            <input
              type="text"
              className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-[#2f3c7e] outline-none transition-all"
              placeholder="admin"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
              {t(lang, "login.password")}
            </label>
            <input
              type="password"
              className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-[#2f3c7e] outline-none transition-all"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button className="w-full bg-[#2f3c7e] text-white p-4 rounded-2xl font-bold shadow-lg hover:opacity-90 transition-opacity">
          {t(lang, "login.submit")}
        </button>
      </div>

      <p className="text-center text-xs text-slate-400">
        {BRAND.legalName}
      </p>
    </div>
  );
}
