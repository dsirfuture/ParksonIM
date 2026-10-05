import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readCatalogShareByCode, readCatalogShareToken } from "@/lib/catalog-share";

const SHARE_BRAND_NAME = "PARKSONMX";
const SHARE_BRAND_SUBTITLE = "百盛供应链";

const SPANISH_MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

type Props = {
  params: Promise<{ token: string }>;
};

async function loadShare(token: string) {
  const payload = token.includes(".")
    ? readCatalogShareToken(token)
    : await readCatalogShareByCode(token);
  if (!payload) return null;
  const cfg = await prisma.catalogConfig.findUnique({
    where: {
      tenant_id_company_id: {
        tenant_id: payload.tenantId,
        company_id: payload.companyId,
      },
    },
    select: {
      doc_logo_url: true,
      doc_header: true,
    },
  });
  return {
    payload,
    logoUrl: cfg?.doc_logo_url || "/BSLOGO.png",
    brandName: SHARE_BRAND_NAME,
  };
}

function formatShareUpdateDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = SPANISH_MONTHS[date.getMonth()] || "";
  const year = date.getFullYear();
  return `${day} de ${month} de ${year} - Actualizacion de productos`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const share = await loadShare(token);
  if (!share) {
    return { title: SHARE_BRAND_NAME, description: SHARE_BRAND_SUBTITLE };
  }
  return {
    title: SHARE_BRAND_NAME,
    description: SHARE_BRAND_SUBTITLE,
    openGraph: {
      title: SHARE_BRAND_NAME,
      description: SHARE_BRAND_SUBTITLE,
      siteName: SHARE_BRAND_NAME,
      images: [{ url: `/api/public/catalog/${token}/og`, width: 1200, height: 630 }],
    },
    icons: {
      icon: "/BSLOGO.png",
      shortcut: "/BSLOGO.png",
      apple: "/BSLOGO.png",
    },
  };
}

export default async function PublicCatalogPage({ params }: Props) {
  const { token } = await params;
  const share = await loadShare(token);
  if (!share) notFound();

  const titleZh = share.payload.categoryZh || "产品清单";
  const titleEs = share.payload.categoryEs || titleZh;
  const downloadPath = `/api/public/catalog/${token}/download`;
  const formatLabel = share.payload.format === "pdf" ? "PDF" : "XLSX";
  const updateDateText = formatShareUpdateDate(new Date());

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-10">
      <div className="mx-auto max-w-2xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <div className="border-b border-slate-100 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_55%,#eef2ff_100%)] px-8 py-8">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {share.logoUrl ? (
                <Image src={share.logoUrl} alt={share.brandName} width={64} height={64} className="h-full w-full object-contain" unoptimized />
              ) : (
                <div className="text-xs font-bold text-slate-500">{share.brandName}</div>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">{share.brandName}</p>
              <h1 className="mt-2 text-3xl font-black tracking-[0.08em] text-slate-900">{titleZh}</h1>
              <p className="mt-1 text-sm text-slate-500">{titleEs}</p>
            </div>
          </div>
        </div>

        <div className="space-y-6 px-8 py-8">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <div className="text-sm font-semibold text-slate-700">分享文件</div>
            <div className="mt-2 text-lg font-bold text-slate-900">{`PARKSONMX-${titleZh}.${share.payload.format}`}</div>
            <div className="mt-1 text-sm text-slate-500">{updateDateText}</div>
          </div>

          <a
            href={downloadPath}
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#2f3c7e] px-6 text-base font-bold text-white transition hover:opacity-95"
          >
            {`下载 ${formatLabel}`}
          </a>
        </div>
      </div>
    </main>
  );
}
