import { promises as fs } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";

type RouteParams = {
  params: Promise<{
    filename: string;
  }>;
};

const PERSISTENT_SUPPLIER_LOGO_DIR = path.join("/data", "supplier-logos");

function getSupplierLogoPaths(filename: string) {
  return [
    path.join(PERSISTENT_SUPPLIER_LOGO_DIR, filename),
    path.join(process.cwd(), "public", "supplier-logos", filename),
  ];
}

function getContentType(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { filename } = await params;
  if (!/^supplier-logo-[a-f0-9-]+-\d+-[a-f0-9]+\.(jpg|jpeg|png|webp|gif)$/i.test(filename)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    let file: Buffer | null = null;
    for (const candidate of getSupplierLogoPaths(filename)) {
      try {
        file = await fs.readFile(candidate);
        break;
      } catch (error: any) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    if (!file) {
      return new NextResponse("Not Found", { status: 404 });
    }
    return new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": getContentType(filename),
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return new NextResponse("Not Found", { status: 404 });
    }
    console.error("[settings/suppliers/logo] failed to serve supplier logo:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
