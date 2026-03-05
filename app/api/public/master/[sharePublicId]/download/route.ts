import { NextResponse } from "next/server";

/**
 * Temporary no-op public master download endpoint.
 * Reason: Prisma schema/client does not expose MasterShareLink/MasterReceipt models yet.
 * We'll implement real XLSX export after migrations are aligned.
 */
export async function GET(_req: Request, ctx: any) {
  const sharePublicId = (ctx?.params?.sharePublicId as string | undefined)?.trim();

  // Return a tiny text file so browser still downloads something
  const content = `Not ready yet.\nsharePublicId=${sharePublicId || ""}\n`;
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="master_${sharePublicId || "unknown"}.txt"`,
    },
  });
}
