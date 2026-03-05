import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/tenant';
import { errorResponse } from '@/lib/errors';
import { nanoid } from 'nanoid';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return errorResponse('FORBIDDEN', 'Auth required', 403);

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const itemId = formData.get('item_id') as string | null;

  if (!file) return errorResponse('VALIDATION_FAILED', 'File required');

  // In a real app, upload to S3/GCS
  const fileUrl = `https://storage.parksonmx.com/evidence/${nanoid()}_${file.name}`;

  const evidence = await prisma.evidence.create({
    data: {
      tenant_id: session.tenantId,
      company_id: session.companyId,
      receipt_id: id,
      item_id: itemId,
      type: 'photo',
      file_url: fileUrl,
      file_size: file.size,
      mime_type: file.type,
      checksum: 'mock-checksum',
      created_by: session.userId,
    }
  });

  return NextResponse.json(evidence);
}
