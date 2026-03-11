import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";

export default function HomePage() {
  return (
    <AppShell>
      <PageHeader
        badge="Welcome"
        title="ParksonIM 平台首页"
        description="统一管理验货单、扫描进度、导入任务与公共分享链接。"
        actions={
          <>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:opacity-95"
            >
              进入 Dashboard
            </Link>
            <Link
              href="/receipts"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              查看验货单
            </Link>
          </>
        }
      />

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <StatCard label="核心模块" value="Receipts" hint="验货单管理与追踪" />
        <StatCard
          label="业务动作"
          value="Import / Scan"
          hint="导入、扫描、核验闭环"
        />
        <StatCard
          label="平台状态"
          value="Online"
          hint="本地开发环境已启动"
          valueClassName="text-emerald-600"
        />
      </section>
    </AppShell>
  );
}
