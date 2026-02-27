import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const wid = request.nextUrl.searchParams.get('workspace');

  if (!wid) {
    return NextResponse.json(
      { error: 'Missing workspace' },
      { status: 400 }
    );
  }

  try {
    const entities = await db.entity.findMany({
      where: { workspaceId: wid },
      orderBy: { mentionCount: 'desc' },
      take: 50,
    });

    return NextResponse.json({ entities });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch entities' },
      { status: 500 }
    );
  }
}
