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

  const items = await prisma.receiptItem.findMany({
    where: { receipt_id: id },
    orderBy: { sku: 'asc' }
  });

  return NextResponse.json(items);
}
