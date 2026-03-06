import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PATCH: Toggle confidentiality on a knowledge record
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { userId, isConfidential } = body;

  if (!params.id || !userId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  // Verify the record exists and the user is the contributor
  const record = await db.knowledgeRecord.findUnique({ where: { id: params.id } });
  if (!record) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 });
  }
  if (record.contributedById !== userId) {
    return NextResponse.json({ error: 'Only the contributor can change confidentiality' }, { status: 403 });
  }

  const updated = await db.knowledgeRecord.update({
    where: { id: params.id },
    data: {
      isConfidential: isConfidential ?? !record.isConfidential,
      confidentialSetAt: isConfidential ? new Date() : null,
      confidentialSetBy: isConfidential ? userId : null,
    },
  });

  return NextResponse.json({ record: updated });
}
