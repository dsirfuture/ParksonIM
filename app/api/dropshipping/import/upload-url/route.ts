import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/permissions";
import { createR2PresignedUpload } from "@/lib/r2-upload";
import { getSession } from "@/lib/tenant";

export const runtime = "nodejs";

function sanitizeKeyPart(value: string) {
  return String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    if (!(await hasPermission(session, "viewReports"))) {
      return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });
    }

    const body = (await request.json()) as {
      fileName?: string;
      fileType?: string;
    };

    const fileName = String(body.fileName || "").trim();
    if (!fileName || !fileName.toLowerCase().endsWith(".zip")) {
      return NextResponse.json({ ok: false, error: "请上传 zip 历史迁移包" }, { status: 400 });
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const key = `dropshipping/imports/${session.tenantId}/${stamp}-${sanitizeKeyPart(fileName) || "legacy-import.zip"}`;
    const upload = await createR2PresignedUpload({
      key,
      contentType: body.fileType || "application/zip",
      expiresIn: 900,
    });

    return NextResponse.json({
      ok: true,
      upload,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "创建上传链接失败" },
      { status: 500 },
    );
  }
}
