import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/tenant';
import { errorResponse } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return errorResponse('FORBIDDEN', 'Auth required', 403);

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: { items: true }
  });

  if (!receipt) return errorResponse('NOT_FOUND', 'Receipt not found', 404);

  return NextResponse.json(receipt);
}
