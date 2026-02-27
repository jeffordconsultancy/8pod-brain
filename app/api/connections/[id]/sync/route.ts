import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { syncGmail } from '@/lib/sync/gmail';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const connection = await db.connection.findUnique({ where: { id: params.id } });
    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    let result;
    switch (connection.provider) {
      case 'GMAIL':
        result = await syncGmail(connection.id);
        break;
      default:
        return NextResponse.json({ error: `Sync not yet supported for ${connection.provider}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      synced: result.synced,
      errors: result.errors,
      message: `Synced ${result.synced} records${result.errors.length > 0 ? ` with ${result.errors.length} errors` : ''}`,
    });
  } catch (e: any) {
    console.error('Sync error:', e);
    return NextResponse.json({ error: e.message || 'Sync failed' }, { status: 500 });
  }
}
