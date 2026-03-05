import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/tenant';
import { errorResponse } from '@/lib/errors';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  const { shareId } = await params;
  const session = await getSession();
  if (!session) return errorResponse('FORBIDDEN', 'Auth required', 403);

  const { active } = await req.json();

  const share = await prisma.masterShareLink.update({
    where: { id: shareId },
    data: { active }
  });

  return NextResponse.json(share);
}
