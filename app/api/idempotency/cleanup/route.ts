import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  // Simple cleanup: delete records older than 24 hours
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const deleted = await prisma.idempotencyRecord.deleteMany({
    where: {
      created_at: { lt: yesterday }
    }
  });

  return NextResponse.json({ deleted_count: deleted.count });
}
