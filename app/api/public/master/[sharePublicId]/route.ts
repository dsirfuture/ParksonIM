import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sharePublicId: string }> }
) {
  const { sharePublicId } = await params;
  const share = await prisma.masterShareLink.findUnique({
    where: { share_public_id: sharePublicId },
    include: {
      master: {
        include: {
          sources: {
            include: {
              receipt: {
                select: {
                  receipt_no: true,
                  supplier_name: true,
                  status: true,
                }
              }
            }
          }
        }
      }
    }
  });

  if (!share || !share.active || (share.expires_at && new Date() > share.expires_at)) {
    return errorResponse('NOT_FOUND', 'Link invalid or expired', 404);
  }

  return NextResponse.json(share);
}
