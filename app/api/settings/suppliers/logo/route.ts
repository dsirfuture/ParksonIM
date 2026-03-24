import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { getSession } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

const MAX_SIZE = 5 * 1024 * 1024;
const PERSISTENT_SUPPLIER_LOGO_DIR = path.join("/data", "supplier-logos");

function extFromType(type: string) {
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("gif")) return "gif";
  return "jpg";
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const allowed = await hasPermission(session, "manageSuppliers");
    if (!allowed) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file selected" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ ok: false, error: "Only image files are supported" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ ok: false, error: "Image must be <= 5MB" }, { status: 400 });
    }

    const ext = extFromType(file.type);
    const fileName = `supplier-logo-${session.tenantId}-${session.companyId}-${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
    const folder = PERSISTENT_SUPPLIER_LOGO_DIR;
    const fullPath = path.join(folder, fileName);
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(fullPath, Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({ ok: true, url: `/api/settings/suppliers/logo/${fileName}` });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 },
    );
  }
}
