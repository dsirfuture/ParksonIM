import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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
