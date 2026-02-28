import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { syncGmail } from '@/lib/sync/gmail';
import { syncGoogleDrive } from '@/lib/sync/google-drive';
import { syncGoogleCalendar } from '@/lib/sync/google-calendar';
import { extractEntities } from '@/lib/sync/extract-entities';

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
      case 'GOOGLE_DRIVE':
        result = await syncGoogleDrive(connection.id);
        break;
      case 'GOOGLE_CALENDAR':
        result = await syncGoogleCalendar(connection.id);
        break;
      default:
        return NextResponse.json({ error: `Sync not yet supported for ${connection.provider}` }, { status: 400 });
    }

    let entitiesExtracted = 0;
    if (result.synced > 0) {
      try {
        const recentRecords = await db.knowledgeRecord.findMany({
          where: { workspaceId: connection.workspaceId },
          orderBy: { createdAt: 'desc' },
          take: result.synced,
          select: { id: true },
        });
        entitiesExtracted = await extractEntities(connection.workspaceId, recentRecords.map(r => r.id));
      } catch (entityErr: any) {
        console.error('Entity extraction error:', entityErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      synced: result.synced,
      entitiesExtracted,
      errors: result.errors,
      message: `Synced ${result.synced} records, extracted ${entitiesExtracted} entities${result.errors.length > 0 ? ` (${result.errors.length} errors)` : ''}`,
    });
  } catch (e: any) {
    console.error('Sync error:', e);
    return NextResponse.json({ error: e.message || 'Sync failed' }, { status: 500 });
  }
}
