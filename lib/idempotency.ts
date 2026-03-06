import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { errorResponse } from "@/lib/errors";

export function hashJson(input: unknown): string {
  const s = typeof input === "string" ? input : JSON.stringify(input ?? null);
  return crypto.createHash("sha256").update(s).digest("hex");
}

/**
 * ✅ 兼容你现在的调用方式：checkIdempotency(tenantId, companyId, key, requestHash)
 */
export async function checkIdempotency(
  tenantId: string,
  companyId: string,
  key: string | null,
  requestHash: string
): Promise<{ error?: NextResponse; response?: NextResponse }> {
  if (!key) {
    return { error: errorResponse("IDEMPOTENCY_KEY_REQUIRED", "Missing Idempotency-Key", 400) };
  }

  const existing = await prisma.idempotencyRecord.findFirst({
    where: {
      tenant_id: tenantId,
      company_id: companyId,
      key,
      request_hash: requestHash,
    },
    orderBy: { created_at: "desc" },
  });

  if (!existing) return {};

  if (existing.response_json) {
    return {
      response: new NextResponse(existing.response_json, {
        status: existing.status_code ?? 200,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  return {};
}

export async function saveIdempotency(params: {
  tenantId: string;
  companyId: string;
  key: string;
  requestHash: string;
  statusCode: number;
  responseBody: unknown;
}) {
  const { tenantId, companyId, key, requestHash, statusCode, responseBody } = params;

  await prisma.idempotencyRecord.create({
    data: {
      tenant_id: tenantId,
      company_id: companyId,
      key,
      request_hash: requestHash,
      status_code: statusCode,
      response_json: JSON.stringify(responseBody ?? null),
    },
  });
}
