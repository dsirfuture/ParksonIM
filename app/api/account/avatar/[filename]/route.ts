import { promises as fs } from "fs";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/tenant";
import { getAvatarContentType, getAvatarFilePath } from "@/lib/avatar-storage";

type RouteParams = {
  params: Promise<{
    filename: string;
  }>;
};

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await getSession();

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { filename } = await params;
  if (!/^[a-f0-9-]+\.(jpg|jpeg|png|webp|gif)$/i.test(filename)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const file = await fs.readFile(getAvatarFilePath(filename));
    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": getAvatarContentType(filename),
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      return new NextResponse("Not Found", { status: 404 });
    }

    console.error("[account/avatar] failed to serve avatar:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
