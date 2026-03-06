import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PATCH: Enable/disable auto-sync and set interval
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { autoSyncEnabled, syncIntervalMin } = body;

  if (!params.id) {
    return NextResponse.json({ error: 'Missing connection ID' }, { status: 400 });
  }

  const connection = await db.connection.findUnique({ where: { id: params.id } });
  if (!connection) {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
  }

  const interval = syncIntervalMin || connection.syncIntervalMin || 60;
  const nextSync = autoSyncEnabled ? new Date(Date.now() + interval * 60 * 1000) : null;

  const updated = await db.connection.update({
    where: { id: params.id },
    data: {
      autoSyncEnabled: autoSyncEnabled ?? connection.autoSyncEnabled,
      syncIntervalMin: interval,
      nextSyncAt: nextSync,
    },
  });

  return NextResponse.json({ connection: updated });
}
