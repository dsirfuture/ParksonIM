import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";

export const SESSION_COOKIE_NAME = "parksonim_session";
export const RECENT_SESSIONS_COOKIE_NAME = "parksonim_recent_sessions";

export type SessionPayload = {
  userId: string;
  tenantId: string;
  companyId: string;
  role: "admin" | "worker";
  userType?: "staff" | "dropshipping_customer";
  defaultPath?: string | null;
};

function isValidSessionPayload(payload: unknown): payload is SessionPayload {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as Record<string, unknown>;
  return Boolean(
    value.userId &&
      value.tenantId &&
      value.companyId &&
      (value.role === "admin" || value.role === "worker") &&
      (value.userType === undefined ||
        value.userType === "staff" ||
        value.userType === "dropshipping_customer") &&
      (value.defaultPath === undefined ||
        value.defaultPath === null ||
        typeof value.defaultPath === "string"),
  );
}

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

    if (!isValidSessionPayload(payload)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function createSignedRecentSessions(payloads: SessionPayload[]) {
  const safePayloads = payloads.filter(isValidSessionPayload).slice(0, 5);
  const encoded = Buffer.from(JSON.stringify(safePayloads), "utf8").toString(
    "base64url",
  );
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function readSignedRecentSessions(
  raw: string | undefined | null,
): SessionPayload[] {
  if (!raw) return [];

  const [encoded, received] = raw.split(".");
  if (!encoded || !received) return [];

  const expected = sign(encoded);
  const a = Buffer.from(received);
  const b = Buffer.from(expected);

  if (a.length !== b.length) return [];
  if (!timingSafeEqual(a, b)) return [];

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    );
    if (!Array.isArray(payload)) return [];
    return payload.filter(isValidSessionPayload);
  } catch {
    return [];
  }
}

export function mergeRecentSessions(
  existing: SessionPayload[],
  current: SessionPayload,
  maxItems = 5,
) {
  const next = [
    current,
    ...existing.filter(
      (item) =>
        !(
          item.userId === current.userId &&
          item.tenantId === current.tenantId &&
          item.companyId === current.companyId
        ),
    ),
  ];
  return next.filter(isValidSessionPayload).slice(0, maxItems);
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
