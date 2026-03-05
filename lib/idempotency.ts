// lib/idempotency.ts
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/errors";
import { NextRequest } from "next/server";
import crypto from "crypto";

export type IdempotencyResult =
  | { kind: "replay"; status: number; body: any }
  | { kind: "proceed"; requestHash: string };

export function requireIdempotencyKey(req: NextRequest): string {
  const key = req.headers.get("Idempotency-Key");
  if (!key) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  return key;
}

export function hashRequest(payload: unknown): string {
  const raw = JSON.stringify(payload ?? {});
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Check if we have a stored response for (tenant/company, key, route).
 * If request hash differs, treat as conflict (client re-used key for different payload).
 */
export async function idempotencyCheck(params: {
  tenant_id: string;
  company_id: string;
  route: string;
  key: string;
  requestHash: string;
}): Promise<IdempotencyResult> {
  const existing = await prisma.idempotencyRecord.findFirst({
    where: {
      tenant_id: params.tenant_id,
      company_id: params.company_id,
      route: params.route,
      key: params.key,
    },
  });

  if (!existing) return { kind: "proceed", requestHash: params.requestHash };

  if (existing.request_hash !== params.requestHash) {
    // same key, different payload => reject
    return {
      kind: "replay",
      status: 409,
      body: apiError(
        "VERSION_CONFLICT",
        "Idempotency-Key reused with different request payload."
      ),
    };
  }

  return {
    kind: "replay",
    status: existing.status_code,
    body: existing.response_body,
  };
}

export async function idempotencyStore(params: {
  tenant_id: string;
  company_id: string;
  route: string;
  key: string;
  requestHash: string;
  status: number;
  body: any;
}): Promise<void> {
  await prisma.idempotencyRecord.create({
    data: {
      tenant_id: params.tenant_id,
      company_id: params.company_id,
      route: params.route,
      key: params.key,
      request_hash: params.requestHash,
      status_code: params.status,
      response_body: params.body,
    },
  });
}
