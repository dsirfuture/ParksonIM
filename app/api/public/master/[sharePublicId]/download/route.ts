import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/lib/errors';
import * as XLSX from 'xlsx';

export async function GET(
  req: NextRequest,
  { params }: { params: { sharePublicId: string } }
) {
  const share = await prisma.masterShareLink.findUnique({
    where: { share_public_id: params.sharePublicId },
    include: {
      master: {
        include: {
          sources: { include: { receipt: { include: { items: true } } } }
        }
      }
    }
  });

  if (!share || !share.active || (share.expires_at && new Date() > share.expires_at)) {
    return errorResponse('NOT_FOUND', 'Link invalid or expired', 404);
  }

  const allItems: any[] = [];
  share.master.sources.forEach(source => {
    source.receipt.items.forEach(item => {
      allItems.push({
        '来源单号': source.receipt.receipt_no,
        '供应商': source.receipt.supplier_name || '',
        'SKU': item.sku,
        '条码': item.barcode,
        '中文名': item.name_zh,
        '西文名': item.name_es,
        '预期数量': item.expected_qty,
        '良品数量': item.good_qty,
        '不良数量': item.damaged_qty,
        '单价': item.sell_price?.toString() || '',
        '折扣': item.discount?.toString() || '',
        '总计': item.line_total?.toString() || '',
      });
    });
  });

  const worksheet = XLSX.utils.json_to_sheet(allItems);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'MasterData');
  
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="master_${share.master.master_no}.xlsx"`,
    },
  });
}
