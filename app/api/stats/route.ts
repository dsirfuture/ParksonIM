import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/tenant';
import { errorResponse } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return errorResponse('FORBIDDEN', 'Auth required', 403);

  const stats = await prisma.receipt.aggregate({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    _count: { id: true },
    _sum: {
      completed_items: true,
      total_items: true,
    }
  });

  const recentReceipts = await prisma.receipt.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    orderBy: { last_activity_at: 'desc' },
    take: 5
  });

  return NextResponse.json({
    summary: {
      total_receipts: stats._count.id,
      completed_items: stats._sum.completed_items || 0,
      total_items: stats._sum.total_items || 0,
    },
    recent_receipts: recentReceipts
  });
}
