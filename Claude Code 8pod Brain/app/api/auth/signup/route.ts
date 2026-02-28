import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { email, name, password, workspaceName } = await request.json();
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 12);
    const slug = (workspaceName || name).toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();

    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, name, passwordHash: hash, role: 'ADMIN' } });
      const workspace = await tx.workspace.create({
        data: { name: workspaceName || `${name}'s Workspace`, slug, ownerId: user.id },
      });
      await tx.workspaceMember.create({
        data: { workspaceId: workspace.id, userId: user.id, role: 'OWNER' },
      });
      return { user, workspace };
    });

    return NextResponse.json({ success: true, user: { id: result.user.id, email, name } }, { status: 201 });
  } catch (e) {
    console.error('Signup error:', e);
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 });
  }
}
