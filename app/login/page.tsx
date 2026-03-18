import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getLang } from "@/lib/i18n-server";
import { getSession } from "@/lib/tenant";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  const lang = await getLang();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <AppShell>
      <div className="flex min-h-[70vh] items-center justify-center">
        <LoginForm lang={lang} />
      </div>
    </AppShell>
  );
}
