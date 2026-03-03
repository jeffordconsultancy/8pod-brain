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
      include: {
        mentions: {
          select: {
            record: {
              select: {
                contributedBy: { select: { id: true, name: true } },
              },
            },
          },
          take: 10,
        },
      },
    });

    // Derive unique contributors per entity
    const entitiesWithContributors = entities.map(e => {
      const contributorMap = new Map<string, string>();
      for (const m of (e as any).mentions || []) {
        const user = m.record?.contributedBy;
        if (user) contributorMap.set(user.id, user.name || 'Unknown');
      }
      const { mentions, ...rest } = e as any;
      return { ...rest, contributors: Array.from(contributorMap.values()) };
    });

    return NextResponse.json({ entities: entitiesWithContributors });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch entities' },
      { status: 500 }
    );
  }
}
