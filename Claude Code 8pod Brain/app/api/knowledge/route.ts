import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const wid = request.nextUrl.searchParams.get('workspace');
  if (!wid) return NextResponse.json({ error: 'Missing workspace' }, { status: 400 });

  try {
    const records = await db.knowledgeRecord.findMany({
      where: { workspaceId: wid },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ records });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch knowledge records' }, { status: 500 });
  }
}
