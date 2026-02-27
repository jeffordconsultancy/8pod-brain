import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  await db.connection.update({ where: { id: params.id }, data: { lastSyncAt: new Date() } });
  return NextResponse.json({ success: true, message: 'Sync initiated' });
}
