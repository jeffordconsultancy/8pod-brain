import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST — create an invite link
export async function POST(request: NextRequest) {
  try {
    const { workspaceId, email, role, userId } = await request.json();
    if (!workspaceId || !userId) {
      return NextResponse.json({ error: 'Missing workspaceId or userId' }, { status: 400 });
    }

    // Verify caller is OWNER or ADMIN of the workspace
    const membership = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json({ error: 'Only workspace owners and admins can create invites' }, { status: 403 });
    }

    const invite = await db.workspaceInvite.create({
      data: {
        workspaceId,
        email: email || null,
        role: role || 'MEMBER',
        createdById: userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return NextResponse.json({
      invite: {
        id: invite.id,
        token: invite.token,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create invite' }, { status: 500 });
  }
}

// GET — list pending invites for a workspace
export async function GET(request: NextRequest) {
  const wid = request.nextUrl.searchParams.get('workspace');
  if (!wid) {
    return NextResponse.json({ error: 'Missing workspace' }, { status: 400 });
  }

  try {
    const invites = await db.workspaceInvite.findMany({
      where: {
        workspaceId: wid,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        createdBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ invites });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch invites' }, { status: 500 });
  }
}
