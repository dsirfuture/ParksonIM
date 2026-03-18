import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/prisma";
import { getLang } from "@/lib/i18n-server";
import { getSession } from "@/lib/tenant";
import { sanitizeAvatarUrl } from "@/lib/avatar-storage";
import { ProfileForm } from "./ProfileForm";

export default async function AccountPage() {
  const lang = await getLang();
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      avatar_url: true,
      role: true,
      active: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[880px]">
        <ProfileForm
          lang={lang}
          initialUser={{
            ...user,
            avatar_url: sanitizeAvatarUrl(user.avatar_url),
          }}
        />
      </div>
    </AppShell>
  );
}
