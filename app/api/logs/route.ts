import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/tenant';
import { errorResponse } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'admin') return errorResponse('FORBIDDEN', 'Admin required', 403);

  const logs = await prisma.scanLog.findMany({
    where: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
    },
    orderBy: { created_at: 'desc' },
    take: 500
  });

  return NextResponse.json(logs);
}
