import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get('workspace');
  if (!workspaceId) return NextResponse.json({ error: 'Missing workspace' }, { status: 400 });

  const connections = await db.connection.findMany({
    where: { workspaceId },
    select: {
      id: true,
      provider: true,
      status: true,
      accountEmail: true,
      lastSyncAt: true,
      recordsSynced: true,
      errorMessage: true,
      createdAt: true,
      createdById: true,
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
  return NextResponse.json(connections);
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await db.connection.update({ where: { id }, data: { status: 'DISCONNECTED', accessToken: null, refreshToken: null } });
  return NextResponse.json({ success: true });
}
