import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/tenant';
import { checkIdempotency, saveIdempotency } from '@/lib/idempotency';
import { errorResponse } from '@/lib/errors';
import { logScan } from '@/lib/audit';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string, itemId: string }> }
) {
  const { id, itemId } = await params;
  const session = await getSession();
  if (!session) return errorResponse('FORBIDDEN', 'Auth required', 403);

  const body = await req.json();
  const { sku, barcode, case_pack, sell_price, item_version } = body;
  const idempotencyKey = req.headers.get('Idempotency-Key');

  const idemp = await checkIdempotency(session.tenantId, session.companyId, idempotencyKey, `edit-item-${itemId}`);
  if (idemp.error) return errorResponse('IDEMPOTENCY_KEY_REQUIRED', 'Missing Idempotency-Key', 400);
  if (idemp.response) return idemp.response;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.receiptItem.findUnique({
        where: { id: params.itemId },
        include: { receipt: true }
      });

      if (!item) throw new Error('NOT_FOUND');
      if (item.receipt.locked || item.locked) throw new Error('LOCKED');
      if (item.version !== item_version) throw new Error('VERSION_CONFLICT');

      const beforeItem = { ...item, receipt: undefined };

      const updatedItem = await tx.receiptItem.update({
        where: { id: item.id },
        data: {
          sku: sku !== undefined ? sku : item.sku,
          barcode: barcode !== undefined ? barcode : item.barcode,
          case_pack: case_pack !== undefined ? case_pack : item.case_pack,
          sell_price: sell_price !== undefined ? sell_price : item.sell_price,
          version: { increment: 1 },
          last_updated_at: new Date(),
          last_updated_by: session.userId,
        }
      });

      await logScan(tx, {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        receipt_id: item.receipt_id,
        item_id: item.id,
        action_type: 'EDIT_ITEM',
        before_value: beforeItem,
        after_value: updatedItem,
        operator_id: session.userId,
        device_id: 'admin-panel',
      });

      return updatedItem;
    });

    if (idempotencyKey) {
      await saveIdempotency(session.tenantId, session.companyId, idempotencyKey, `edit-item-${params.itemId}`, result, 200);
    }

    return NextResponse.json(result);
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') return errorResponse('NOT_FOUND', 'Item not found', 404);
    if (err.message === 'LOCKED') return errorResponse('LOCKED', 'Item is locked', 423);
    if (err.message === 'VERSION_CONFLICT') return errorResponse('VERSION_CONFLICT', 'Version mismatch', 409);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}
