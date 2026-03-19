// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { normalizePhone } from "@/lib/user-account";

export async function POST(req: NextRequest) {
  try {
    const existingCount = await prisma.user.count();

    if (existingCount > 0) {
      return NextResponse.json(
        { ok: false, error: "系统已存在用户 当前不允许再次初始化" },
        { status: 400 },
      );
    }

    const body = await req.json();

    const tenantName =
      String(body?.tenantName || "").trim() || "Parkson Tenant";
    const companyName =
      String(body?.companyName || "").trim() || "Parkson Company";
    const userId = String(body?.userId || "").trim() || "admin";
    const name = String(body?.name || "").trim() || "System Admin";
    const password = String(body?.password || "").trim() || "Admin123456";
    const phone = normalizePhone(
      String(body?.phone || "").trim() || "5512345678",
    );
    const email = String(body?.email || "").trim() || "admin@parksonim.local";

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: tenantName },
      });

      const company = await tx.company.create({
        data: {
          tenant_id: tenant.id,
          name: companyName,
        },
      });

      const user = await tx.user.create({
        data: {
          tenant_id: tenant.id,
          company_id: company.id,
          user_id: userId,
          name,
          phone,
          email,
          avatar_url: null,
          password_hash: hashPassword(password),
          role: "admin",
          active: true,
        },
      });

      return { tenant, company, user };
    });

    return NextResponse.json({
      ok: true,
      tenantId: result.tenant.id,
      companyId: result.company.id,
      userId: result.user.user_id,
      name: result.user.name,
      phone: result.user.phone,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "当前未能完成初始化 请稍后再试" },
      { status: 500 },
    );
  }
}
