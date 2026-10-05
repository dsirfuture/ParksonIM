import { createHmac, timingSafeEqual } from "crypto";
import { deflateRawSync, inflateRawSync } from "zlib";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { withPrismaRetry } from "@/lib/prisma-retry";
import { hashJson } from "@/lib/idempotency";

export type CatalogSharePayload = {
  tenantId: string;
  companyId: string;
  format: "pdf" | "xlsx";
  lang: "zh" | "es";
  category: string;
  keyword: string;
  categoryZh: string;
  categoryEs: string;
};

function randomShareCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(6);
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function getShareSecret() {
  return process.env.SESSION_SECRET?.trim() || "parksonim-local-session-secret";
}

function sign(value: string) {
  return createHmac("sha256", getShareSecret()).update(value).digest("base64url");
}

export function createCatalogShareToken(payload: CatalogSharePayload) {
  const compressed = deflateRawSync(Buffer.from(JSON.stringify(payload), "utf8")).toString("base64url");
  const signature = sign(compressed);
  return `${compressed}.${signature}`;
}

export function readCatalogShareToken(raw: string | null | undefined): CatalogSharePayload | null {
  if (!raw) return null;
  const [compressed, received] = String(raw).split(".");
  if (!compressed || !received) return null;
  const expected = sign(compressed);
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const json = inflateRawSync(Buffer.from(compressed, "base64url")).toString("utf8");
    const payload = JSON.parse(json) as CatalogSharePayload;
    if (!payload?.tenantId || !payload?.companyId) return null;
    if (payload.format !== "pdf" && payload.format !== "xlsx") return null;
    if (payload.lang !== "zh" && payload.lang !== "es") return null;
    return {
      tenantId: payload.tenantId,
      companyId: payload.companyId,
      format: payload.format,
      lang: payload.lang,
      category: String(payload.category || "all"),
      keyword: String(payload.keyword || ""),
      categoryZh: String(payload.categoryZh || ""),
      categoryEs: String(payload.categoryEs || ""),
    };
  } catch {
    return null;
  }
}

export async function createCatalogShareCode(payload: CatalogSharePayload) {
  const requestHash = hashJson(payload);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = randomShareCode();
    try {
      await withPrismaRetry(() =>
        prisma.idempotencyRecord.create({
          data: {
            tenant_id: payload.tenantId,
            company_id: payload.companyId,
            key: `catalog_share:${code}`,
            request_hash: requestHash,
            status_code: 200,
            response_json: JSON.stringify(payload),
          },
        }),
      );
      return code;
    } catch {
      // retry on collision
    }
  }
  throw new Error("生成短分享链接失败");
}

export async function readCatalogShareByCode(code: string | null | undefined): Promise<CatalogSharePayload | null> {
  const shortCode = String(code || "").trim();
  if (!shortCode) return null;
  const record = await withPrismaRetry(() =>
    prisma.idempotencyRecord.findFirst({
      where: { key: `catalog_share:${shortCode}` },
      orderBy: { created_at: "desc" },
      select: {
        response_json: true,
      },
    }),
  );
  if (!record?.response_json) return null;
  try {
    const payload = JSON.parse(record.response_json) as CatalogSharePayload;
    if (!payload?.tenantId || !payload?.companyId) return null;
    if (payload.format !== "pdf" && payload.format !== "xlsx") return null;
    if (payload.lang !== "zh" && payload.lang !== "es") return null;
    return payload;
  } catch {
    return null;
  }
}
