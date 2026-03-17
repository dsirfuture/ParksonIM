import { NextResponse } from "next/server";
import { replaceOrderAttachments } from "@/lib/dropshipping";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    if (!(await hasPermission(session, "viewReports"))) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const { id } = await context.params;
    const formData = await request.formData();
    const type = String(formData.get("type") || "").trim() as "label" | "proof";
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);

    if (!id || (type !== "label" && type !== "proof")) {
      return NextResponse.json({ ok: false, error: "参数错误" }, { status: 400 });
    }

    await replaceOrderAttachments(session, {
      orderId: id,
      type,
      assets: await Promise.all(
        files.map(async (file) => ({
          displayName: file.name,
          bytes: new Uint8Array(await file.arrayBuffer()),
          mimeType: file.type || undefined,
        })),
      ),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "附件上传失败" },
      { status: 500 },
    );
  }
}
