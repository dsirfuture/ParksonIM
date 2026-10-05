import { AppShell } from "@/components/app-shell";
import { getLang } from "@/lib/i18n-server";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const lang = await getLang();

  return (
    <AppShell>
      <div className="flex min-h-[70vh] items-center justify-center">
        <LoginForm lang={lang} />
      </div>
    </AppShell>
  );
}
