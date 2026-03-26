import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { hasPermission } from "@/lib/permissions";
import { getSession } from "@/lib/tenant";

function sanitizeSegment(value: string) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function buildTargetDir(input: {
  tenantId: string;
  companyId: string;
  sourceType: string;
  orderNo?: string;
  recordId?: string;
}) {
  const key = sanitizeSegment(input.recordId || input.orderNo || "unknown");
  return path.join(
    process.cwd(),
    "public",
    "uploads",
    "payment-evidences",
    sanitizeSegment(input.tenantId),
    sanitizeSegment(input.companyId),
    sanitizeSegment(input.sourceType || "manual"),
    key || "unknown",
  );
}

async function ensureAccess() {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  }
  const allowed = await hasPermission(session, "manageCustomers");
  if (!allowed) {
    return { error: NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 }) };
  }
  return { session };
}

async function listEvidenceItems(dirPath: string, publicPrefix: string) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          const fullPath = path.join(dirPath, entry.name);
          const stat = await fs.stat(fullPath);
          return {
            name: entry.name,
            url: `${publicPrefix}/${encodeURIComponent(entry.name)}`,
            sizeBytes: stat.size,
            uploadedAt: stat.mtime.toISOString(),
          };
        }),
    );
    return files.sort((left, right) => String(right.uploadedAt).localeCompare(String(left.uploadedAt)));
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const access = await ensureAccess();
  if (access.error) return access.error;

  const { searchParams } = new URL(request.url);
  const sourceType = String(searchParams.get("sourceType") || "").trim();
  const orderNo = String(searchParams.get("orderNo") || "").trim();
  const recordId = String(searchParams.get("recordId") || "").trim();
  const session = access.session!;
  const dirPath = buildTargetDir({
    tenantId: session.tenantId,
    companyId: session.companyId,
    sourceType,
    orderNo,
    recordId,
  });
  const publicPrefix = `/uploads/payment-evidences/${sanitizeSegment(session.tenantId)}/${sanitizeSegment(session.companyId)}/${sanitizeSegment(sourceType || "manual")}/${sanitizeSegment(recordId || orderNo || "unknown") || "unknown"}`;
  const items = await listEvidenceItems(dirPath, publicPrefix);
  return NextResponse.json({ ok: true, items });
}

export async function POST(request: Request) {
  const access = await ensureAccess();
  if (access.error) return access.error;

  const formData = await request.formData();
  const sourceType = String(formData.get("sourceType") || "").trim();
  const orderNo = String(formData.get("orderNo") || "").trim();
  const recordId = String(formData.get("recordId") || "").trim();
  const files = formData
    .getAll("files")
    .filter((item): item is File => item instanceof File)
    .filter((file) => file.size > 0);

  if (files.length === 0) {
    return NextResponse.json({ ok: false, error: "files_required" }, { status: 400 });
  }

  const session = access.session!;
  const dirPath = buildTargetDir({
    tenantId: session.tenantId,
    companyId: session.companyId,
    sourceType,
    orderNo,
    recordId,
  });
  await fs.mkdir(dirPath, { recursive: true });

  for (const file of files) {
    const ext = path.extname(file.name || "");
    const base = sanitizeSegment(path.basename(file.name || "evidence", ext)) || "evidence";
    const storedName = `${Date.now()}_${base}${ext.slice(0, 16)}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(dirPath, storedName), buffer);
  }

  const publicPrefix = `/uploads/payment-evidences/${sanitizeSegment(session.tenantId)}/${sanitizeSegment(session.companyId)}/${sanitizeSegment(sourceType || "manual")}/${sanitizeSegment(recordId || orderNo || "unknown") || "unknown"}`;
  const items = await listEvidenceItems(dirPath, publicPrefix);
  return NextResponse.json({ ok: true, items });
}
