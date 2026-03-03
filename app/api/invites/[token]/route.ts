import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET — public endpoint to fetch invite details (no auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const invite = await db.workspaceInvite.findUnique({
      where: { token: params.token },
      include: {
        workspace: { select: { name: true } },
        createdBy: { select: { name: true, email: true } },
      },
    });

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    const expired = invite.expiresAt < new Date();
    const used = !!invite.usedAt;

    return NextResponse.json({
      workspaceName: invite.workspace.name,
      inviterName: invite.createdBy.name || invite.createdBy.email,
      email: invite.email,
      role: invite.role,
      expired,
      used,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch invite' }, { status: 500 });
  }
}
