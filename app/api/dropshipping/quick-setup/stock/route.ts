import { NextRequest, NextResponse } from "next/server";
import { hasAppPermission } from "@/lib/permissions";
import { saveQuickSetupStockSelections } from "@/lib/dropshipping";
import { getSession } from "@/lib/tenant";

async function getQuickSetupSession(permissionKey: string) {
  const session = await getSession();
  if (!session) {
    return { session: null, error: NextResponse.json({ ok: false, error: "未登录" }, { status: 401 }) };
  }
  if (!(await hasAppPermission(session, permissionKey as any))) {
    return { session, error: NextResponse.json({ ok: false, error: "您暂无执行此操作的权限" }, { status: 403 }) };
  }
  return { session, error: null };
}

export async function POST(req: NextRequest) {
  const { session, error } = await getQuickSetupSession("dropshipping.quick_setup.edit");
  if (error) return error;

  try {
    const body = await req.json().catch(() => ({}));
    const items = Array.isArray(body?.items) ? body.items : [];
    const result = await saveQuickSetupStockSelections(session, items);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "save_stock_failed" },
      { status: 500 },
    );
  }
}
