import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { getLang } from "@/lib/i18n-server";
import { AppShell } from "@/components/app-shell";
import { AdminUsersClient } from "./AdminUsersClient";

export default async function AdminUsersPage() {
  const session = await getSession();
  const lang = await getLang();

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "admin") {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    orderBy: [{ role: "asc" }, { created_at: "asc" }],
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      avatar_url: true,
      role: true,
      active: true,
      created_at: true,
    },
  });

  const text =
    lang === "zh"
      ? {
          title: "用户管理",
          desc: "管理员可统一编辑注册用户资料",
        }
      : {
          title: "Usuarios",
          desc: "El administrador puede editar los datos de los usuarios registrados",
        };

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl">
        <section className="overflow-hidden rounded-xl bg-white shadow-soft">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
              <h1 className="shrink-0 whitespace-nowrap text-[18px] font-bold tracking-tight text-slate-900">
                {text.title}
              </h1>
              <p className="min-w-0 whitespace-nowrap text-sm text-slate-500">
                {text.desc}
              </p>
            </div>
          </div>

          <AdminUsersClient
            lang={lang}
            initialUsers={users.map((user) => ({
              ...user,
              email: user.email ?? null,
              avatar_url: user.avatar_url ?? null,
              created_at: user.created_at.toISOString(),
            }))}
          />
        </section>
      </div>
    </AppShell>
  );
}
