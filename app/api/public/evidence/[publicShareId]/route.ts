import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ publicShareId: string }> }
) {
  const { publicShareId } = await params;
  const receipt = await prisma.receipt.findUnique({
    where: { public_share_id: publicShareId },
    select: {
      receipt_no: true,
      supplier_name: true,
      created_at: true,
      public_evidence_enabled: true,
      evidences: {
        where: { type: 'photo' },
        select: {
          file_url: true,
          created_at: true,
        }
      }
    }
  });

  if (!receipt) return errorResponse('NOT_FOUND', 'Evidence not found', 404);
  if (!receipt.public_evidence_enabled) return errorResponse('FORBIDDEN', 'Sharing disabled', 403);

  return NextResponse.json(receipt);
}
