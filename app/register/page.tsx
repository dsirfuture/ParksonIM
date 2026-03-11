import { AppShell } from "@/components/app-shell";
import { getLang } from "@/lib/i18n-server";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  const lang = await getLang();

  return (
    <AppShell>
      <div className="flex min-h-[70vh] items-center justify-center">
        <RegisterForm lang={lang} />
      </div>
    </AppShell>
  );
}
