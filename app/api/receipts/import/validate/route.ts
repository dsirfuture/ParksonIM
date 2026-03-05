import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/tenant';
import { errorResponse } from '@/lib/errors';
import * as XLSX from 'xlsx';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return errorResponse('FORBIDDEN', 'Auth required', 403);

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const receiptNo = formData.get('receipt_no') as string;

  if (!file || !receiptNo) return errorResponse('VALIDATION_FAILED', 'File and receipt_no required');

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet) as any[];

  const exceptions: any[] = [];
  const validatedRows: any[] = [];

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const sku = String(row.SKU || '');
    const barcode = String(row.barcode || '');
    const name_zh = String(row.name_zh || '');
    const name_es = String(row.name_es || '');
    const case_pack = Number(row.case_pack || 1);
    const total_qty = Number(row.total_qty || 0);
    const sell_price = row.sell_price !== undefined ? Number(row.sell_price) : null;
    const discount = row.discount !== undefined ? Number(row.discount) : null;
    const line_total = row.line_total !== undefined ? Number(row.line_total) : null;

    if (!sku) exceptions.push({ row_number: rowNum, field: 'SKU', message: 'Missing SKU' });
    if (!barcode) exceptions.push({ row_number: rowNum, field: 'barcode', message: 'Missing barcode' });
    if (isNaN(total_qty) || total_qty < 0) exceptions.push({ row_number: rowNum, field: 'total_qty', message: 'Invalid quantity' });
    if (case_pack <= 0) exceptions.push({ row_number: rowNum, field: 'case_pack', message: 'Case pack must be > 0' });
    if (discount !== null && (discount < 0 || discount > 100)) exceptions.push({ row_number: rowNum, field: 'discount', message: 'Discount must be 0-100' });
    
    validatedRows.push({
      sku,
      barcode,
      name_zh,
      name_es,
      case_pack,
      expected_qty: total_qty,
      sell_price,
      discount,
      line_total,
    });
  });

  const batch = await prisma.importBatch.create({
    data: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      receipt_no: receiptNo,
      status: exceptions.length > 0 ? 'failed' : 'validated',
      payload_json: validatedRows,
      created_by: session.userId,
      exceptions: {
        create: exceptions.map(e => ({
          tenant_id: session.tenantId,
          company_id: session.companyId,
          ...e
        }))
      }
    },
    include: { exceptions: true }
  });

  return NextResponse.json({
    batch_id: batch.id,
    preview: validatedRows.slice(0, 5),
    exceptions: batch.exceptions,
    status: batch.status
  });
}
