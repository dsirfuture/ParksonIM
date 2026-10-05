import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getMobileReceiptI18n, resolveLang } from "@/lib/mobile-receipt-i18n";

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

function getEvidenceDelegate(errorText: string) {
  const delegate = (prisma as any).receiptEvidence;
  if (!delegate) {
    throw new Error(errorText);
  }
  return delegate;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ publicShareId: string }> },
) {
  const lang = resolveLang(new URL(request.url).searchParams.get("lang"));
  const i18n = getMobileReceiptI18n(lang);
  try {
    const { publicShareId } = await context.params;
    const body = await request.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: i18n.server.invalidBody }, { status: 400 });
    }

    const receipt = await prisma.receipt.findFirst({
      where: { public_share_id: publicShareId },
      select: {
        id: true,
        locked: true,
        status: true,
      },
    });

    if (!receipt) {
      return NextResponse.json({ ok: false, error: i18n.server.receiptNotFound }, { status: 404 });
    }

    if (receipt.locked || receipt.status === "completed") {
      return NextResponse.json(
        { ok: false, error: i18n.server.receiptLocked },
        { status: 409 },
      );
    }

    for (const file of parsed.data.files) {
      if (!file.mimeType.startsWith("image/")) {
        return NextResponse.json({ ok: false, error: i18n.server.imageOnly }, { status: 400 });
      }
      if (!file.dataUrl.startsWith(`data:${file.mimeType};base64,`)) {
        return NextResponse.json({ ok: false, error: i18n.server.invalidImage }, { status: 400 });
      }
    }

    const receiptEvidence = getEvidenceDelegate(i18n.server.prismaEvidenceMissing);
    const currentCount = await receiptEvidence.count({
      where: { receipt_id: receipt.id },
    });

    if (currentCount + parsed.data.files.length > MAX_FILE_COUNT) {
      return NextResponse.json({ ok: false, error: i18n.server.tooManyImages }, { status: 400 });
    }

    await prisma.$transaction(
      parsed.data.files.map((file) =>
        receiptEvidence.create({
          data: {
            receipt_id: receipt.id,
            file_name: file.fileName,
            mime_type: file.mimeType,
            file_size: file.fileSize,
            image_data: file.dataUrl,
          },
        }),
      ),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : i18n.server.saveEvidenceFailed,
      },
      { status: 500 },
    );
  }
}
