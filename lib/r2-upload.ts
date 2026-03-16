import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const publicBaseUrl = (process.env.NEXT_PUBLIC_PRODUCT_IMAGE_BASE_URL || "").trim().replace(/\/+$/, "");
const bucketName = (process.env.CLOUDFLARE_R2_BUCKET || "parkson-products").trim();
const accountId = (process.env.CLOUDFLARE_R2_ACCOUNT_ID || "").trim();
const accessKeyId = (process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "").trim();
const secretAccessKey = (process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "").trim();

let client: S3Client | null = null;

function getClient() {
  if (client) return client;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials are not configured");
  }

  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
  return client;
}

export function getR2BucketName() {
  return bucketName;
}

function encodeKeyForUrl(key: string) {
  return key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export function buildR2PublicUrl(key: string) {
  if (!publicBaseUrl) {
    throw new Error("NEXT_PUBLIC_PRODUCT_IMAGE_BASE_URL is not configured");
  }
  return `${publicBaseUrl}/${encodeKeyForUrl(key)}`;
}

export async function uploadR2Object(input: {
  key: string;
  body: Uint8Array;
  contentType?: string;
}) {
  const s3 = getClient();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType || "application/octet-stream",
    }),
  );

  return {
    bucket: bucketName,
    key: input.key,
    url: buildR2PublicUrl(input.key),
  };
}

export async function createR2PresignedUpload(input: {
  key: string;
  contentType?: string;
  expiresIn?: number;
}) {
  const s3 = getClient();
  const contentType = input.contentType || "application/octet-stream";
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: input.key,
    ContentType: contentType,
  });
  const url = await getSignedUrl(s3, command, {
    expiresIn: input.expiresIn ?? 900,
  });

  return {
    bucket: bucketName,
    key: input.key,
    url,
    headers: {
      "Content-Type": contentType,
    },
  };
}

async function streamToUint8Array(stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream | Blob) {
  if (stream instanceof Blob) {
    return new Uint8Array(await stream.arrayBuffer());
  }

  if ("getReader" in stream && typeof stream.getReader === "function") {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      chunks.push(value);
      total += value.length;
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return merged;
  }

  const nodeStream = stream as NodeJS.ReadableStream;
  const chunks: Uint8Array[] = [];
  for await (const chunk of nodeStream) {
    if (chunk instanceof Uint8Array) {
      chunks.push(chunk);
    } else if (typeof chunk === "string") {
      chunks.push(new TextEncoder().encode(chunk));
    } else {
      chunks.push(new Uint8Array(chunk));
    }
  }
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

export async function downloadR2Object(key: string) {
  const s3 = getClient();
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );

  if (!result.Body) {
    throw new Error("R2 object body is empty");
  }

  return {
    key,
    body: await streamToUint8Array(result.Body),
    contentType: result.ContentType || "application/octet-stream",
  };
}

export async function deleteR2Object(key: string) {
  const s3 = getClient();
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    }),
  );
}
