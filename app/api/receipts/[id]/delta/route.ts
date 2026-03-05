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

  const { searchParams } = new URL(req.url);
  const since = searchParams.get('since');

  const receipt = await prisma.receipt.findUnique({
    where: { id },
  });

  if (!receipt) return errorResponse('NOT_FOUND', 'Receipt not found', 404);

  const changed = !since || new Date(receipt.last_activity_at) > new Date(since);

  if (!changed) {
    return NextResponse.json({ changed: false });
  }

  const items = await prisma.receiptItem.findMany({
    where: {
      receipt_id: params.id,
      last_updated_at: { gt: since ? new Date(since) : new Date(0) }
    }
  });

  return NextResponse.json({
    changed: true,
    receipt,
    items
  });
}
