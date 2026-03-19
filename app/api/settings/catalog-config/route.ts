// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";
import { withPrismaRetry } from "@/lib/prisma-retry";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    const allowed = await hasPermission(session, "manageProducts");
    if (!allowed) return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });

    const row = await withPrismaRetry(() => prisma.catalogConfig.findUnique({
      where: {
        tenant_id_company_id: {
          tenant_id: session.tenantId,
          company_id: session.companyId,
        },
      },
    }));
    return NextResponse.json({
      ok: true,
      item: row
        ? {
            customer: row.customer || "",
            category: row.category || "",
            discount: row.discount || "",
            showStock: row.show_stock,
            showImage: row.show_image,
            language: row.language === "es" ? "es" : "zh",
            cover: row.cover_url || "",
            note: row.note || "",
            docHeader: row.doc_header || "",
            docFooter: row.doc_footer || "",
            docPhone: row.doc_phone || "",
            docLogoUrl: row.doc_logo_url || "",
            docLogoPosition: row.doc_logo_position || "right",
            docHeaderAlign: row.doc_header_align || "left",
            docFooterAlign: row.doc_footer_align || "right",
            docWhatsapp: row.doc_whatsapp || "",
            docWechat: row.doc_wechat || "",
            docShowWhatsapp: row.doc_show_whatsapp,
            docShowWechat: row.doc_show_wechat,
            docShowContact: row.doc_show_contact,
            docShowHeader: row.doc_show_header,
            docShowFooter: row.doc_show_footer,
            docShowLogo: row.doc_show_logo,
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "读取配置失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    const allowed = await hasPermission(session, "manageProducts");
    if (!allowed) return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });

    const body = (await request.json()) as Record<string, unknown>;
    await withPrismaRetry(() => prisma.catalogConfig.upsert({
      where: {
        tenant_id_company_id: {
          tenant_id: session.tenantId,
          company_id: session.companyId,
        },
      },
      create: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        customer: String(body.customer || "").trim() || null,
        category: String(body.category || "").trim() || null,
        discount: String(body.discount || "").trim() || null,
        show_stock: Boolean(body.showStock ?? true),
        show_image: Boolean(body.showImage ?? true),
        language: String(body.language || "zh") === "es" ? "es" : "zh",
        cover_url: String(body.cover || "").trim() || null,
        note: String(body.note || "").trim() || null,
        doc_header: String(body.docHeader || "").trim() || null,
        doc_footer: String(body.docFooter || "").trim() || null,
        doc_phone: String(body.docPhone || "").trim() || null,
        doc_logo_url: String(body.docLogoUrl || "").trim() || null,
        doc_logo_position: ["left", "right", "center", "top", "bottom"].includes(String(body.docLogoPosition || "right"))
          ? String(body.docLogoPosition)
          : "right",
        doc_header_align: ["left", "center", "right"].includes(String(body.docHeaderAlign || "left"))
          ? String(body.docHeaderAlign)
          : "left",
        doc_footer_align: ["left", "center", "right"].includes(String(body.docFooterAlign || "right"))
          ? String(body.docFooterAlign)
          : "right",
        doc_whatsapp: String(body.docWhatsapp || "").trim() || null,
        doc_wechat: String(body.docWechat || "").trim() || null,
        doc_show_whatsapp: Boolean(body.docShowWhatsapp ?? false),
        doc_show_wechat: Boolean(body.docShowWechat ?? false),
        doc_show_contact: Boolean(body.docShowContact ?? true),
        doc_show_header: Boolean(body.docShowHeader ?? true),
        doc_show_footer: Boolean(body.docShowFooter ?? true),
        doc_show_logo: Boolean(body.docShowLogo ?? false),
      },
      update: {
        customer: String(body.customer || "").trim() || null,
        category: String(body.category || "").trim() || null,
        discount: String(body.discount || "").trim() || null,
        show_stock: Boolean(body.showStock ?? true),
        show_image: Boolean(body.showImage ?? true),
        language: String(body.language || "zh") === "es" ? "es" : "zh",
        cover_url: String(body.cover || "").trim() || null,
        note: String(body.note || "").trim() || null,
        doc_header: String(body.docHeader || "").trim() || null,
        doc_footer: String(body.docFooter || "").trim() || null,
        doc_phone: String(body.docPhone || "").trim() || null,
        doc_logo_url: String(body.docLogoUrl || "").trim() || null,
        doc_logo_position: ["left", "right", "center", "top", "bottom"].includes(String(body.docLogoPosition || "right"))
          ? String(body.docLogoPosition)
          : "right",
        doc_header_align: ["left", "center", "right"].includes(String(body.docHeaderAlign || "left"))
          ? String(body.docHeaderAlign)
          : "left",
        doc_footer_align: ["left", "center", "right"].includes(String(body.docFooterAlign || "right"))
          ? String(body.docFooterAlign)
          : "right",
        doc_whatsapp: String(body.docWhatsapp || "").trim() || null,
        doc_wechat: String(body.docWechat || "").trim() || null,
        doc_show_whatsapp: Boolean(body.docShowWhatsapp ?? false),
        doc_show_wechat: Boolean(body.docShowWechat ?? false),
        doc_show_contact: Boolean(body.docShowContact ?? true),
        doc_show_header: Boolean(body.docShowHeader ?? true),
        doc_show_footer: Boolean(body.docShowFooter ?? true),
        doc_show_logo: Boolean(body.docShowLogo ?? false),
      },
    }));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "保存配置失败" }, { status: 500 });
  }
}
