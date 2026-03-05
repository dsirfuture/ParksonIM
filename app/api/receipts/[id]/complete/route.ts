import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/tenant';
import { checkIdempotency, saveIdempotency } from '@/lib/idempotency';
import { errorResponse } from '@/lib/errors';
import { logScan } from '@/lib/audit';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return errorResponse('FORBIDDEN', 'Auth required', 403);

  const idempotencyKey = req.headers.get('Idempotency-Key');
  const idemp = await checkIdempotency(session.tenantId, session.companyId, idempotencyKey, `complete-${id}`);
  if (idemp.error) return errorResponse('IDEMPOTENCY_KEY_REQUIRED', 'Missing Idempotency-Key', 400);
  if (idemp.response) return idemp.response;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.findUnique({
        where: { id: params.id },
        include: { evidences: true }
      });

      if (!receipt) throw new Error('NOT_FOUND');
      if (receipt.locked) throw new Error('LOCKED');

      const photoCount = receipt.evidences.filter(e => e.type === 'photo').length;
      if (photoCount < receipt.evidence_required_min || photoCount > receipt.evidence_required_max) {
        throw new Error('VALIDATION_FAILED: Evidence count out of range');
      }

      const updatedReceipt = await tx.receipt.update({
        where: { id: receipt.id },
        data: {
          status: 'completed',
          locked: true,
          version: { increment: 1 },
          last_activity_at: new Date(),
        }
      });

      // Lock all items as well
      await tx.receiptItem.updateMany({
        where: { receipt_id: receipt.id },
        data: { locked: true }
      });

      await logScan(tx, {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        receipt_id: receipt.id,
        action_type: 'COMPLETE_RECEIPT',
        before_value: receipt,
        after_value: updatedReceipt,
        operator_id: session.userId,
        device_id: 'admin-panel',
      });

      return updatedReceipt;
    });

    if (idempotencyKey) {
      await saveIdempotency(session.tenantId, session.companyId, idempotencyKey, `complete-${params.id}`, result, 200);
    }

    return NextResponse.json(result);
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') return errorResponse('NOT_FOUND', 'Receipt not found', 404);
    if (err.message === 'LOCKED') return errorResponse('LOCKED', 'Receipt is already locked', 423);
    if (err.message.startsWith('VALIDATION_FAILED')) return errorResponse('VALIDATION_FAILED', err.message, 400);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}
