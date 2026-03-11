import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";

function getEvidenceDelegate() {
  const delegate = (prisma as any).receiptEvidence;

  if (!delegate) {
    throw new Error(
      "Prisma Client 未识别 ReceiptEvidence，请先执行 prisma generate，并同步数据库后重启开发服务",
    );
  }

  return delegate;
}

export async function DELETE(_req: Request, ctx: any) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return errorResponse("FORBIDDEN", "Auth required", 403);
    }

    const receiptId = (ctx?.params?.id as string | undefined)?.trim();
    const evidenceId = (ctx?.params?.evidenceId as string | undefined)?.trim();

    if (!receiptId || !evidenceId) {
      return errorResponse("VALIDATION_FAILED", "id required", 400);
    }

    const receipt = await prisma.receipt.findFirst({
      where: {
        id: receiptId,
        tenant_id: session.tenantId,
        company_id: session.companyId,
      },
      select: {
        id: true,
      },
    });

    if (!receipt) {
      return errorResponse("NOT_FOUND", "Receipt not found", 404);
    }

    const receiptEvidence = getEvidenceDelegate();

    const evidence = await receiptEvidence.findFirst({
      where: {
        id: evidenceId,
        receipt_id: receiptId,
      },
      select: {
        id: true,
      },
    });

    if (!evidence) {
      return errorResponse("NOT_FOUND", "Evidence not found", 404);
    }

    await receiptEvidence.delete({
      where: {
        id: evidenceId,
      },
    });

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "暂时无法删除证据图片",
      },
      { status: 500 },
    );
  }
}
