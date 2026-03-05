import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/tenant';
import { errorResponse } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return errorResponse('FORBIDDEN', 'Auth required', 403);

  const receipts = await prisma.receipt.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    orderBy: { created_at: 'desc' },
  });

  return NextResponse.json(receipts);
}
