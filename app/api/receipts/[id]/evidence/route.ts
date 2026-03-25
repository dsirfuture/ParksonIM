import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/tenant";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";

const MAX_FILE_COUNT = 20;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const EvidenceFileSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(100),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE),
  dataUrl: z.string().trim().min(1),
});

const BodySchema = z.object({
  files: z.array(EvidenceFileSchema).min(1).max(MAX_FILE_COUNT),
});

function getEvidenceDelegate() {
  const delegate = (prisma as any).receiptEvidence;

  if (!delegate) {
    throw new Error(
      "Prisma Client 未识别 ReceiptEvidence，请先执行 prisma generate，并同步数据库后重启开发服务",
    );
  }

  return delegate;
}

function mapEvidenceRow(row: {
  id: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  image_data: string;
  created_at: Date;
}) {
  return {
    id: row.id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    dataUrl: row.image_data,
    createdAt: row.created_at.toISOString(),
  };
}

async function ensureReceipt(
  receiptId: string,
  tenantId: string,
  companyId: string,
) {
  return prisma.receipt.findFirst({
    where: {
      id: receiptId,
      tenant_id: tenantId,
      company_id: companyId,
    },
    select: {
      id: true,
      locked: true,
      status: true,
    },
  });
}

export async function GET(_req: Request, ctx: any) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId) {
      return errorResponse("FORBIDDEN", "Auth required", 403);
    }

    const receiptId = (ctx?.params?.id as string | undefined)?.trim();
    if (!receiptId) {
      return errorResponse("VALIDATION_FAILED", "id required", 400);
    }

    const receipt = await ensureReceipt(
      receiptId,
      session.tenantId,
      session.companyId,
    );

    if (!receipt) {
      return errorResponse("NOT_FOUND", "Receipt not found", 404);
    }

    const receiptEvidence = getEvidenceDelegate();

    const items = await receiptEvidence.findMany({
      where: {
        receipt_id: receiptId,
      },
      orderBy: {
        created_at: "desc",
      },
      select: {
        id: true,
        file_name: true,
        mime_type: true,
        file_size: true,
        image_data: true,
        created_at: true,
      },
    });

    return NextResponse.json({
      ok: true,
      items: items.map(mapEvidenceRow),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "暂时无法读取证据图片",
      },
      { status: 500 },
    );
  }
}

export async function POST(req: Request, ctx: any) {
  try {
    const session = await getSession();
    if (!session?.tenantId || !session?.companyId || !session.userId) {
      return errorResponse("FORBIDDEN", "Auth required", 403);
    }

    const receiptId = (ctx?.params?.id as string | undefined)?.trim();
    if (!receiptId) {
      return errorResponse("VALIDATION_FAILED", "id required", 400);
    }

    const receipt = await ensureReceipt(
      receiptId,
      session.tenantId,
      session.companyId,
    );

    if (!receipt) {
      return errorResponse("NOT_FOUND", "Receipt not found", 404);
    }

    if (receipt.locked || receipt.status === "completed") {
      return NextResponse.json(
        { ok: false, error: "验货单已完成并锁定，不能再修改" },
        { status: 409 },
      );
    }

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "提交内容格式不正确" },
        { status: 400 },
      );
    }

    for (const file of parsed.data.files) {
      if (!file.mimeType.startsWith("image/")) {
        return NextResponse.json(
          { ok: false, error: "只能上传图片文件" },
          { status: 400 },
        );
      }

      if (!file.dataUrl.startsWith(`data:${file.mimeType};base64,`)) {
        return NextResponse.json(
          { ok: false, error: "图片内容格式不正确" },
          { status: 400 },
        );
      }
    }

    const receiptEvidence = getEvidenceDelegate();

    const currentCount = await receiptEvidence.count({
      where: {
        receipt_id: receiptId,
      },
    });

    if (currentCount + parsed.data.files.length > MAX_FILE_COUNT) {
      return NextResponse.json(
        { ok: false, error: "最多只能上传 20 张图片" },
        { status: 400 },
      );
    }

    await prisma.$transaction(
      parsed.data.files.map((file) =>
        receiptEvidence.create({
          data: {
            receipt_id: receiptId,
            file_name: file.fileName,
            mime_type: file.mimeType,
            file_size: file.fileSize,
            image_data: file.dataUrl,
          },
        }),
      ),
    );

    const items = await receiptEvidence.findMany({
      where: {
        receipt_id: receiptId,
      },
      orderBy: {
        created_at: "desc",
      },
      select: {
        id: true,
        file_name: true,
        mime_type: true,
        file_size: true,
        image_data: true,
        created_at: true,
      },
    });

    return NextResponse.json({
      ok: true,
      items: items.map(mapEvidenceRow),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "暂时无法保存证据图片",
      },
      { status: 500 },
    );
  }
}
