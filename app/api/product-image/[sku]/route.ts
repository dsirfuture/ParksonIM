import { NextRequest, NextResponse } from "next/server";
import { findLocalProductImageFileName } from "@/lib/local-product-image";
import { normalizeProductCode } from "@/lib/product-code";

function normalizeSku(value: string) {
  return normalizeProductCode(value);
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

  try {
    const matched = findLocalProductImageFileName(normalizedSku, ext);
    if (!matched) {
      return new NextResponse(null, { status: 404 });
    }

    const targetUrl = new URL(`/products/${encodeURIComponent(matched)}`, request.url);
    return NextResponse.redirect(targetUrl, 307);
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
