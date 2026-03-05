import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/tenant';
import { errorResponse } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ masterId: string }> }
) {
  const { masterId } = await params;
  const session = await getSession();
  if (!session) return errorResponse('FORBIDDEN', 'Auth required', 403);

  const master = await prisma.masterReceipt.update({
    where: { id: masterId },
    data: {
      status: 'completed',
      locked: true,
      version: { increment: 1 }
    }
  });

  return NextResponse.json(master);
}
