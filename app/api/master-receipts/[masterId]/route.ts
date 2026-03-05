import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/tenant';
import { errorResponse } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ masterId: string }> }
) {
  const { masterId } = await params;
  const session = await getSession();
  if (!session) return errorResponse('FORBIDDEN', 'Auth required', 403);

  const master = await prisma.masterReceipt.findUnique({
    where: { id: masterId },
    include: {
      sources: { include: { receipt: true } },
      shares: true
    }
  });

  if (!master) return errorResponse('NOT_FOUND', 'Master receipt not found', 404);

  return NextResponse.json(master);
}
