import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/tenant';
import { errorResponse } from '@/lib/errors';
import * as XLSX from 'xlsx';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) return errorResponse('FORBIDDEN', 'Auth required', 403);

  const receipt = await prisma.receipt.findUnique({
    where: { id: params.id },
    include: { items: true }
  });

  if (!receipt) return errorResponse('NOT_FOUND', 'Receipt not found', 404);

  const data = receipt.items.map(item => ({
    'SKU': item.sku,
    '条码': item.barcode,
    '中文名': item.name_zh,
    '西文名': item.name_es,
    '预期数量': item.expected_qty,
    '良品数量': item.good_qty,
    '不良数量': item.damaged_qty,
    '差异': item.expected_qty - (item.good_qty + item.damaged_qty),
    '单价': item.sell_price?.toString() || '',
    '折扣': item.discount?.toString() || '',
    '总计': item.line_total?.toString() || '',
    '状态': item.status,
    '意外': item.unexpected ? '是' : '否'
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Items');
  
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="receipt_${receipt.receipt_no}.xlsx"`,
    },
  });
}
