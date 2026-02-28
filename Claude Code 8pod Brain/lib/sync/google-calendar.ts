import { google } from 'googleapis';
import { db } from '../db';
import { decryptToken, encryptToken } from '../crypto';

function getClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/oauth/callback`
  );
}

export async function syncGoogleCalendar(connectionId: string): Promise<{ synced: number; errors: string[] }> {
  const connection = await db.connection.findUnique({ where: { id: connectionId } });
  if (!connection?.accessToken) throw new Error('No access token');

  const client = getClient();
  client.setCredentials({
    access_token: decryptToken(connection.accessToken),
    refresh_token: connection.refreshToken ? decryptToken(connection.refreshToken) : undefined,
  });

  client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await db.connection.update({
        where: { id: connectionId },
        data: {
          accessToken: encryptToken(tokens.access_token),
          ...(tokens.refresh_token ? { refreshToken: encryptToken(tokens.refresh_token) } : {}),
          tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        },
      });
    }
  });

  const calendar = google.calendar({ version: 'v3', auth: client });
  const errors: string[] = [];
  let synced = 0;

  const log = await db.ingestionLog.create({
    data: { workspaceId: connection.workspaceId, sourceSystem: 'google-calendar', status: 'running' },
  });

  try {
    // Fetch events: past 7 days + next 14 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAhead = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const eventsRes = await calendar.events.list({
      calendarId: 'primary',
      timeMin: sevenDaysAgo,
      timeMax: fourteenDaysAhead,
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = eventsRes.data.items || [];
    let processed = 0;

    for (const event of events) {
      processed++;
      try {
        if (!event.id) continue;

        const existing = await db.knowledgeRecord.findFirst({
          where: { workspaceId: connection.workspaceId, sourceSystem: 'google-calendar', sourceId: event.id },
        });
        if (existing) continue;

        const attendees = (event.attendees || []).map(a => `${a.displayName || a.email} (${a.responseStatus})`).join(', ');
        const start = event.start?.dateTime || event.start?.date || 'Unknown';
        const end = event.end?.dateTime || event.end?.date || 'Unknown';
        const organizer = event.organizer?.displayName || event.organizer?.email || 'Unknown';

        const rawContent = [
          `Event: ${event.summary || '(No title)'}`,
          `Organizer: ${organizer}`,
          `Start: ${start}`,
          `End: ${end}`,
          event.location ? `Location: ${event.location}` : null,
          attendees ? `Attendees: ${attendees}` : null,
          event.description ? `\nDescription:\n${event.description.replace(/<[^>]*>/g, ' ').trim()}` : null,
          event.hangoutLink ? `Meeting Link: ${event.hangoutLink}` : null,
        ].filter(Boolean).join('\n');

        await db.knowledgeRecord.create({
          data: {
            workspaceId: connection.workspaceId,
            sourceSystem: 'google-calendar',
            sourceId: event.id,
            contentType: 'calendar-event',
            rawContent,
            summary: `Calendar: ${event.summary || '(No title)'} on ${new Date(start).toLocaleDateString()}`,
            metadata: {
              summary: event.summary,
              start,
              end,
              location: event.location,
              organizer,
              attendeeCount: event.attendees?.length || 0,
              status: event.status,
            },
          },
        });
        synced++;
      } catch (eventErr: any) {
        errors.push(`Event ${event.summary}: ${eventErr.message}`);
      }
    }

    await db.connection.update({
      where: { id: connectionId },
      data: { lastSyncAt: new Date(), recordsSynced: { increment: synced }, status: 'ACTIVE', errorMessage: errors.length > 0 ? `${errors.length} errors during sync` : null },
    });

    await db.ingestionLog.update({
      where: { id: log.id },
      data: { status: 'completed', recordsProcessed: processed, recordsCreated: synced, completedAt: new Date(), errorMessage: errors.length > 0 ? errors.join('; ') : null },
    });
  } catch (err: any) {
    await db.connection.update({ where: { id: connectionId }, data: { status: 'ERROR', errorMessage: err.message } });
    await db.ingestionLog.update({ where: { id: log.id }, data: { status: 'error', errorMessage: err.message, completedAt: new Date() } });
    throw err;
  }

  return { synced, errors };
}
