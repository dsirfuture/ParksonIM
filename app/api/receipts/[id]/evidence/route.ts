import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { errorResponse } from "@/lib/errors";
import { nanoid } from "nanoid";
import { requireIdempotencyKey, hashRequest, idempotencyCheck, idempotencyStore } from "@/lib/idempotency";
import { writeScanLog } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest, context: any) {
  const id = context?.params?.id as string | undefined;
  if (!id) return errorResponse("VALIDATION_FAILED", "Missing receipt id", 400);

  const session = await getSession();
  if (!session) return errorResponse("FORBIDDEN", "Auth required", 403);

  // --- Idempotency ---
  let idemKey = "";
  try {
    idemKey = requireIdempotencyKey(req);
  } catch {
    return errorResponse("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header required", 400);
  }

  // formData 不能直接 hash 文件本体（会很大），我们只 hash 元信息
  const formData = await req.formData();
  const file = formData.get("file") as unknown as File | null;
  const itemId = (formData.get("item_id") as string | null) ?? null;

  if (!file) return errorResponse("VALIDATION_FAILED", "File required", 400);

  const requestHash = hashRequest({
    receipt_id: id,
    item_id: itemId,
    name: file.name,
    size: file.size,
    type: file.type,
  });

  const route = `/api/receipts/${id}/evidence`;
  const idem = await idempotencyCheck({
    tenant_id: session.tenantId,
    company_id: session.companyId,
    route,
    key: idemKey,
    requestHash,
  });

  if (idem.kind === "replay") {
    return NextResponse.json(idem.body, { status: idem.status });
  }

  // --- Business rules (locked + evidence count 1–50) ---
  const receipt = await prisma.receipt.findFirst({
    where: {
      id,
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    select: { id: true, locked: true },
  });

  if (!receipt) return errorResponse("NOT_FOUND", "Receipt not found", 404);
  if (receipt.locked) return errorResponse("LOCKED", "Receipt is locked", 423);

  const currentCount = await prisma.evidence.count({
    where: {
      receipt_id: id,
      tenant_id: session.tenantId,
      company_id: session.companyId,
      type: "photo",
    },
  });

  if (currentCount >= 50) {
    return errorResponse("VALIDATION_FAILED", "Evidence photos limit reached (max 50)", 400);
  }

  // --- Upload placeholder (replace with R2/S3 signed upload later) ---
  const safeName = file.name.replace(/[^\w.\-()]/g, "_");
  const fileUrl = `https://storage.parksonmx.com/evidence/${nanoid()}_${safeName}`;

  // NOTE: checksum 这里先 mock；正式版应在客户端或服务器计算 sha256
  const checksum = "mock-checksum";

  // --- Transaction: create Evidence + update receipt activity + write ScanLog ---
  const result = await prisma.$transaction(async (tx) => {
    const evidence = await tx.evidence.create({
      data: {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        receipt_id: id,
        item_id: itemId,
        type: "photo",
        file_url: fileUrl,
        file_size: file.size,
        mime_type: file.type,
        checksum,
        created_by: session.userId,
      },
    });

    await tx.receipt.update({
      where: { id },
      data: { last_activity_at: new Date() },
    });

    await writeScanLog({
      tenant_id: session.tenantId,
      company_id: session.companyId,
      receipt_id: id,
      item_id: itemId,
      action_type: "EVIDENCE_UPLOAD",
      before_value: { evidence_count_before: currentCount },
      after_value: { evidence_count_after: currentCount + 1, file_url: fileUrl },
      operator_id: session.userId,
      device_id: req.headers.get("X-Device-Id") ?? null,
    });

    return evidence;
  });

  // store idempotency response
  await idempotencyStore({
    tenant_id: session.tenantId,
    company_id: session.companyId,
    route,
    key: idemKey,
    requestHash,
    status: 200,
    body: result,
  });

  return NextResponse.json(result);
}
