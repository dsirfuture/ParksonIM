import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/tenant';
import { checkIdempotency, saveIdempotency } from '@/lib/idempotency';
import { errorResponse } from '@/lib/errors';
import { logScan } from '@/lib/audit';
import { nanoid } from 'nanoid';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return errorResponse('FORBIDDEN', 'Auth required', 403);

  const body = await req.json();
  const { barcode_or_sku, delta_good, delta_damaged, receipt_version, operator_id, device_id } = body;
  const idempotencyKey = req.headers.get('Idempotency-Key');

  const idemp = await checkIdempotency(session.tenantId, session.companyId, idempotencyKey, `scan-${id}`);
  if (idemp.error) return errorResponse('IDEMPOTENCY_KEY_REQUIRED', 'Missing Idempotency-Key', 400);
  if (idemp.response) return idemp.response;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const receipt = await tx.receipt.findUnique({
        where: { id: params.id },
        include: { items: true }
      });

      if (!receipt) throw new Error('NOT_FOUND');
      if (receipt.locked) throw new Error('LOCKED');
      if (receipt.version !== receipt_version) throw new Error('VERSION_CONFLICT');

      let item = receipt.items.find(i => i.barcode === barcode_or_sku || i.sku === barcode_or_sku);

      const beforeReceipt = { ...receipt, items: undefined };
      let beforeItem = item ? { ...item } : null;

      if (!item) {
        // Create unexpected item
        item = await tx.receiptItem.create({
          data: {
            tenant_id: session.tenantId,
            company_id: session.companyId,
            receipt_id: receipt.id,
            sku: barcode_or_sku,
            barcode: barcode_or_sku,
            name_zh: `未匹配: ${barcode_or_sku}`,
            name_es: `Inesperado: ${barcode_or_sku}`,
            expected_qty: 0,
            good_qty: delta_good,
            damaged_qty: delta_damaged,
            status: 'in_progress',
            unexpected: true,
            last_updated_by: session.userId,
            version: 1,
          }
        });
      } else {
        if (item.locked) throw new Error('LOCKED');
        
        item = await tx.receiptItem.update({
          where: { id: item.id },
          data: {
            good_qty: { increment: delta_good },
            damaged_qty: { increment: delta_damaged },
            status: 'in_progress',
            version: { increment: 1 },
            last_updated_at: new Date(),
            last_updated_by: session.userId,
          }
        });
      }

      // Update receipt progress
      const allItems = await tx.receiptItem.findMany({ where: { receipt_id: receipt.id } });
      const completedItems = allItems.filter(i => i.good_qty + i.damaged_qty >= i.expected_qty).length;
      const progress = (completedItems / allItems.length) * 100;

      const updatedReceipt = await tx.receipt.update({
        where: { id: receipt.id },
        data: {
          completed_items: completedItems,
          progress_percent: progress,
          version: { increment: 1 },
          last_activity_at: new Date(),
        }
      });

      await logScan(tx, {
        tenant_id: session.tenantId,
        company_id: session.companyId,
        receipt_id: receipt.id,
        item_id: item.id,
        action_type: 'SCAN',
        before_value: { receipt: beforeReceipt, item: beforeItem },
        after_value: { receipt: updatedReceipt, item },
        operator_id: session.userId,
        device_id: device_id || 'unknown',
      });

      return { item, receipt: updatedReceipt };
    });

    if (idempotencyKey) {
      await saveIdempotency(session.tenantId, session.companyId, idempotencyKey, `scan-${params.id}`, result, 200);
    }

    return NextResponse.json(result);
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') return errorResponse('NOT_FOUND', 'Receipt not found', 404);
    if (err.message === 'LOCKED') return errorResponse('LOCKED', 'Receipt is locked', 423);
    if (err.message === 'VERSION_CONFLICT') return errorResponse('VERSION_CONFLICT', 'Version mismatch', 409);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}
