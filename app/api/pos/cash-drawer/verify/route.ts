import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth";
import { requirePosSession } from "@/lib/pos/server/pos-route";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const auth = await requirePosSession("pos.sale.checkout");
  if (!auth.ok) return auth.response;

  const payload = (await request.json().catch(() => ({}))) as { password?: unknown };
  const password = typeof payload.password === "string" ? payload.password.trim() : "";
  if (!password) {
    return NextResponse.json({ ok: false, error: "PASSWORD_REQUIRED" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: {
      id: auth.session.userId,
      tenant_id: auth.scope.tenantId,
      company_id: auth.scope.companyId,
      active: true,
    },
    select: {
      password_hash: true,
    },
  });

  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ ok: false, error: "PASSWORD_INVALID" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
