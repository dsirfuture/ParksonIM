import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/tenant';
import { errorResponse } from '@/lib/errors';
import { checkIdempotency, saveIdempotency } from '@/lib/idempotency';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return errorResponse('FORBIDDEN', 'Auth required', 403);

  const { master_no, receipt_ids } = await req.json();
  const idempotencyKey = req.headers.get('Idempotency-Key');

  const idemp = await checkIdempotency(session.tenantId, session.companyId, idempotencyKey, 'create-master');
  if (idemp.error) return errorResponse('IDEMPOTENCY_KEY_REQUIRED', 'Missing Idempotency-Key', 400);
  if (idemp.response) return idemp.response;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const master = await tx.masterReceipt.create({
        data: {
          tenant_id: session.tenantId,
          company_id: session.companyId,
          master_no,
          created_by: session.userId,
          sources: {
            create: receipt_ids.map((rid: string) => ({
              tenant_id: session.tenantId,
              company_id: session.companyId,
              receipt_id: rid,
            }))
          }
        },
        include: { sources: true }
      });
      return master;
    });

    if (idempotencyKey) {
      await saveIdempotency(session.tenantId, session.companyId, idempotencyKey, 'create-master', result, 200);
    }

    return NextResponse.json(result);
  } catch (err: any) {
    if (err.code === 'P2002') return errorResponse('VALIDATION_FAILED', 'Master number already exists', 400);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}
