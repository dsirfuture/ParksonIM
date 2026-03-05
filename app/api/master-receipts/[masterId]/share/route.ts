import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/tenant';
import { errorResponse } from '@/lib/errors';
import { nanoid } from 'nanoid';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ masterId: string }> }
) {
  const { masterId } = await params;
  const session = await getSession();
  if (!session) return errorResponse('FORBIDDEN', 'Auth required', 403);

  const share = await prisma.masterShareLink.create({
    data: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      master_receipt_id: masterId,
      share_public_id: nanoid(16),
      created_by: session.userId,
    }
  });

  return NextResponse.json(share);
}
