import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const wid = request.nextUrl.searchParams.get('workspace');
  if (!wid) {
    return NextResponse.json({ error: 'Missing workspace' }, { status: 400 });
  }

  try {
    const members = await db.workspaceMember.findMany({
      where: { workspaceId: wid },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return NextResponse.json({ members });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 });
  }
}
