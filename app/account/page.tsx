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
      phone_country: true,
      company_name: true,
      email: true,
      avatar_url: true,
      role: true,
      user_type: true,
      customer_org_role: true,
      dropshipping_customer_id: true,
      active: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-[880px] space-y-5">
        <ProfileForm
          lang={lang}
          initialUser={{
            id: user.id,
            name: user.name,
            phone: user.phone,
            phone_country: user.phone_country,
            company_name: user.company_name,
            email: user.email,
            avatar_url: sanitizeAvatarUrl(user.avatar_url),
            role: user.role,
            active: user.active,
          }}
        />
      </div>
    </AppShell>
  );
}
