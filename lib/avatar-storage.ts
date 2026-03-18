import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const AVATAR_STORAGE_DIR = process.env.AVATAR_STORAGE_DIR || "/data/avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function parseAvatarDataUrl(dataUrl: string) {
  const matched = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!matched) {
    throw new Error("INVALID_AVATAR_FORMAT");
  }

  const [, mimeType, encoded] = matched;
  const ext = MIME_TO_EXT[mimeType];
  if (!ext) {
    throw new Error("INVALID_AVATAR_TYPE");
  }

  const buffer = Buffer.from(encoded, "base64");
  if (!buffer.length || buffer.length > MAX_AVATAR_BYTES) {
    throw new Error("AVATAR_TOO_LARGE");
  }

  return { buffer, ext };
}

export function isInlineAvatarUrl(value: string | null | undefined) {
  return String(value || "").startsWith("data:image/");
}

export function sanitizeAvatarUrl(value: string | null | undefined) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  if (isInlineAvatarUrl(normalized)) return null;
  return normalized;
}

export function getAvatarMaxBytes() {
  return MAX_AVATAR_BYTES;
}

export function getStoredAvatarFilename(avatarUrl: string | null | undefined) {
  const normalized = String(avatarUrl || "").trim();
  const prefix = "/api/account/avatar/";

  if (!normalized.startsWith(prefix)) return null;

  const filename = normalized.slice(prefix.length);
  return /^[a-f0-9-]+\.(jpg|jpeg|png|webp|gif)$/i.test(filename)
    ? filename
    : null;
}

export function getAvatarFilePath(filename: string) {
  return path.join(AVATAR_STORAGE_DIR, filename);
}

export function getAvatarContentType(filename: string) {
  const ext = path.extname(filename).replace(".", "").toLowerCase();
  return EXT_TO_MIME[ext] || "application/octet-stream";
}

export async function deleteStoredAvatar(avatarUrl: string | null | undefined) {
  const filename = getStoredAvatarFilename(avatarUrl);
  if (!filename) return;

  try {
    await fs.unlink(getAvatarFilePath(filename));
  } catch (error: any) {
    if (error?.code !== "ENOENT") {
      console.error("[avatar-storage] failed to delete avatar:", error);
    }
  }
}

export async function storeAvatarDataUrl(
  dataUrl: string,
  userId: string,
  previousAvatarUrl?: string | null,
) {
  const { buffer, ext } = parseAvatarDataUrl(dataUrl);
  await fs.mkdir(AVATAR_STORAGE_DIR, { recursive: true });

  const filename = `${userId}-${crypto.randomUUID()}.${ext}`;
  const fullPath = getAvatarFilePath(filename);
  await fs.writeFile(fullPath, buffer);

  if (previousAvatarUrl) {
    await deleteStoredAvatar(previousAvatarUrl);
  }

  return `/api/account/avatar/${filename}`;
}
