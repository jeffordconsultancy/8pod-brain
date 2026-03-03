import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const wid = request.nextUrl.searchParams.get('workspace');
  const scope = request.nextUrl.searchParams.get('scope') || 'mine';
  const userId = request.nextUrl.searchParams.get('userId');

  if (!wid) {
    return NextResponse.json(
      { error: 'Missing workspace' },
      { status: 400 }
    );
  }

  try {
    const where: any = { workspaceId: wid };
    if (scope === 'mine' && userId) {
      where.contributedById = userId;
    }

    const records = await db.knowledgeRecord.findMany({
      where,
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        contributedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ records });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch knowledge records' },
      { status: 500 }
    );
  }
}
