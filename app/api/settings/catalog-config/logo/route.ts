import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { getSession } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

const MAX_SIZE = 5 * 1024 * 1024;

function extFromType(type: string) {
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  return "jpg";
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
    const allowed = await hasPermission(session, "manageProducts");
    if (!allowed) return NextResponse.json({ ok: false, error: "无权限" }, { status: 403 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "请选择图片文件" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "仅支持图片格式" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ ok: false, error: "图片不能超过 5MB" }, { status: 400 });
    }

    const ext = extFromType(file.type);
    const fileName = `doc-logo-${session.tenantId}-${session.companyId}-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    const folder = path.join(process.cwd(), "public", "logos");
    const fullPath = path.join(folder, fileName);
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(fullPath, Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({ ok: true, url: `/logos/${fileName}` });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "上传失败" },
      { status: 500 },
    );
  }
}
