import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

function normalizeSku(value: string) {
  return String(value || "").trim();
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sku: string }> },
) {
  const { sku } = await context.params;
  const normalizedSku = normalizeSku(decodeURIComponent(sku));
  if (!normalizedSku) {
    return new NextResponse(null, { status: 404 });
  }

  const ext = String(request.nextUrl.searchParams.get("ext") || "jpg")
    .trim()
    .replace(/^\.+/, "")
    .toLowerCase();

  const productsDir = path.join(process.cwd(), "public", "products");

  try {
    const fileNames = await fs.readdir(productsDir);
    const targetBase = normalizedSku.toLowerCase();
    const targetExt = `.${ext}`;
    const matched = fileNames.find((fileName) => {
      const parsed = path.parse(fileName);
      return parsed.name.toLowerCase() === targetBase && parsed.ext.toLowerCase() === targetExt;
    });

    if (!matched) {
      return new NextResponse(null, { status: 404 });
    }

    const targetUrl = new URL(`/products/${encodeURIComponent(matched)}`, request.url);
    return NextResponse.redirect(targetUrl, 307);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
