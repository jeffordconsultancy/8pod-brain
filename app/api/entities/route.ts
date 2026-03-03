import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const wid = request.nextUrl.searchParams.get('workspace');
  const scope = request.nextUrl.searchParams.get('scope') || 'team';
  const userId = request.nextUrl.searchParams.get('userId');

  if (!wid) {
    return NextResponse.json(
      { error: 'Missing workspace' },
      { status: 400 }
    );
  }

  try {
    const where: any = { workspaceId: wid };

    // When scope is 'mine', only show entities that appear in the user's knowledge records
    if (scope === 'mine' && userId) {
      where.mentions = {
        some: {
          record: { contributedById: userId },
        },
      };
    }

    const entities = await db.entity.findMany({
      where,
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
