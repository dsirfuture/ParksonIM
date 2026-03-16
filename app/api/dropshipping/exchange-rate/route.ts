import { NextResponse } from "next/server";
import { getExchangeRatePayload } from "@/lib/dropshipping";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    if (!(await hasPermission(session, "viewReports"))) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const item = await getExchangeRatePayload(session);
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "读取汇率失败" },
      { status: 500 },
    );
  }
}
