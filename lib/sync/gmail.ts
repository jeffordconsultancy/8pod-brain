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

export async function syncGmail(connectionId: string): Promise<{ synced: number; errors: string[] }> {
  const connection = await db.connection.findUnique({ where: { id: connectionId } });
  if (!connection?.accessToken) throw new Error('No access token');

  const client = getClient();
  client.setCredentials({
    access_token: decryptToken(connection.accessToken),
    refresh_token: connection.refreshToken ? decryptToken(connection.refreshToken) : undefined,
  });

  // Handle token refresh
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

  const gmail = google.gmail({ version: 'v1', auth: client });
  const errors: string[] = [];
  let synced = 0;

  try {
    // Fetch recent messages (last 50)
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 50,
      q: 'newer_than:7d', // Last 7 days
    });

    const messages = listRes.data.messages || [];

    for (const msg of messages) {
      try {
        // Check if already ingested
        const existing = await db.knowledgeRecord.findFirst({
          where: {
            workspaceId: connection.workspaceId,
            sourceSystem: 'gmail',
            sourceId: msg.id!,
          },
        });

        if (existing) continue;

        // Fetch full message
        const detail = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
          format: 'full',
        });

        const headers = detail.data.payload?.headers || [];
        const subject = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || '(No subject)';
        const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';
        const to = headers.find(h => h.name?.toLowerCase() === 'to')?.value || '';
        const date = headers.find(h => h.name?.toLowerCase() === 'date')?.value || '';

        // Extract body text
        let body = '';
        const payload = detail.data.payload;
        if (payload?.body?.data) {
          body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        } else if (payload?.parts) {
          const textPart = payload.parts.find(p => p.mimeType === 'text/plain');
          if (textPart?.body?.data) {
            body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
          } else {
            const htmlPart = payload.parts.find(p => p.mimeType === 'text/html');
            if (htmlPart?.body?.data) {
              body = Buffer.from(htmlPart.body.data, 'base64')
                .toString('utf-8')
                .replace(/<[^>]*>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            }
          }
        }

        // Truncate very long emails
        const content = body.length > 5000 ? body.slice(0, 5000) + '...' : body;

        const rawContent = `From: ${from}\nTo: ${to}\nDate: ${date}\nSubject: ${subject}\n\n${content}`;

        await db.knowledgeRecord.create({
          data: {
            workspaceId: connection.workspaceId,
            sourceSystem: 'gmail',
            sourceId: msg.id!,
            contentType: 'email',
            rawContent,
            summary: `Email: ${subject} (from ${from})`,
            threadId: detail.data.threadId || undefined,
            metadata: {
              subject,
              from,
              to,
              date,
              labels: detail.data.labelIds || [],
            },
          },
        });

        synced++;
      } catch (msgErr: any) {
        errors.push(`Message ${msg.id}: ${msgErr.message}`);
      }
    }

    // Update connection status
    await db.connection.update({
      where: { id: connectionId },
      data: {
        lastSyncAt: new Date(),
        recordsSynced: { increment: synced },
        status: 'ACTIVE',
        errorMessage: errors.length > 0 ? `${errors.length} errors during sync` : null,
      },
    });

  } catch (err: any) {
    await db.connection.update({
      where: { id: connectionId },
      data: { status: 'ERROR', errorMessage: err.message },
    });
    throw err;
  }

  return { synced, errors };
}
