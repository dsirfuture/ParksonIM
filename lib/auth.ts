import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export const SESSION_COOKIE_NAME = "parksonim_session";

export type SessionPayload = {
  userId: string;
  tenantId: string;
  companyId: string;
  role: "admin" | "worker";
};

function getSessionSecret() {
  return process.env.SESSION_SECRET?.trim() || "parksonim-local-session-secret";
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

export function createSignedSession(payload: SessionPayload) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function readSignedSession(
  raw: string | undefined | null,
): SessionPayload | null {
  if (!raw) return null;

  const [encoded, received] = raw.split(".");
  if (!encoded || !received) return null;

  const expected = sign(encoded);
  const a = Buffer.from(received);
  const b = Buffer.from(expected);

  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as SessionPayload;

    if (
      !payload?.userId ||
      !payload?.tenantId ||
      !payload?.companyId ||
      (payload.role !== "admin" && payload.role !== "worker")
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [salt, stored] = storedHash.split(":");
  if (!salt || !stored) return false;

  const hash = scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(stored, "hex");

  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
