import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST — accept an invite (join the workspace)
export async function POST(request: NextRequest) {
  try {
    const { token, userId } = await request.json();
    if (!token || !userId) {
      return NextResponse.json({ error: 'Missing token or userId' }, { status: 400 });
    }

    const invite = await db.workspaceInvite.findUnique({
      where: { token },
    });

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }
    if (invite.usedAt) {
      return NextResponse.json({ error: 'Invite already used' }, { status: 400 });
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invite expired' }, { status: 400 });
    }

    // Check if user is already a member
    const existing = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId } },
    });

    if (existing) {
      // Already a member — mark invite used and return success
      await db.workspaceInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });
      return NextResponse.json({ workspaceId: invite.workspaceId, alreadyMember: true });
    }

    // Add user to workspace and mark invite used
    await db.$transaction([
      db.workspaceMember.create({
        data: {
          workspaceId: invite.workspaceId,
          userId,
          role: invite.role,
        },
      }),
      db.workspaceInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return NextResponse.json({ workspaceId: invite.workspaceId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to accept invite' }, { status: 500 });
  }
}
