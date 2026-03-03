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

export async function syncGoogleDrive(connectionId: string): Promise<{ synced: number; errors: string[] }> {
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

  const drive = google.drive({ version: 'v3', auth: client });
  const errors: string[] = [];
  let synced = 0;

  // Create ingestion log
  const log = await db.ingestionLog.create({
    data: { workspaceId: connection.workspaceId, sourceSystem: 'google-drive', status: 'running' },
  });

  try {
    // Fetch recent files (modified in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const listRes = await drive.files.list({
      q: `modifiedTime > '${thirtyDaysAgo}' and trashed = false and (mimeType = 'application/vnd.google-apps.document' or mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.google-apps.presentation' or mimeType = 'application/pdf' or mimeType = 'text/plain')`,
      fields: 'files(id, name, mimeType, modifiedTime, owners, createdTime)',
      pageSize: 50,
      orderBy: 'modifiedTime desc',
    });

    const files = listRes.data.files || [];
    let processed = 0;

    for (const file of files) {
      processed++;
      try {
        const existing = await db.knowledgeRecord.findFirst({
          where: { workspaceId: connection.workspaceId, sourceSystem: 'google-drive', sourceId: file.id!, contributedById: connection.createdById },
        });
        if (existing) continue;

        let content = '';
        const googleDocTypes = [
          'application/vnd.google-apps.document',
          'application/vnd.google-apps.spreadsheet',
          'application/vnd.google-apps.presentation',
        ];

        if (googleDocTypes.includes(file.mimeType!)) {
          // Export Google Docs as plain text
          const exportRes = await drive.files.export({ fileId: file.id!, mimeType: 'text/plain' }, { responseType: 'text' });
          content = typeof exportRes.data === 'string' ? exportRes.data : String(exportRes.data);
        } else {
          // Download other files and read as text
          const downloadRes = await drive.files.get({ fileId: file.id!, alt: 'media' }, { responseType: 'text' });
          content = typeof downloadRes.data === 'string' ? downloadRes.data : String(downloadRes.data);
        }

        // Truncate very long documents
        if (content.length > 10000) content = content.slice(0, 10000) + '\n...[truncated]';

        const owner = file.owners?.[0]?.displayName || 'Unknown';
        const rawContent = `Document: ${file.name}\nOwner: ${owner}\nModified: ${file.modifiedTime}\nType: ${file.mimeType}\n\n${content}`;

        await db.knowledgeRecord.create({
          data: {
            workspaceId: connection.workspaceId,
            sourceSystem: 'google-drive',
            sourceId: file.id!,
            contentType: 'document',
            rawContent,
            summary: `Drive: ${file.name} (by ${owner})`,
            contributedById: connection.createdById,
            metadata: { name: file.name, mimeType: file.mimeType, owner, modifiedTime: file.modifiedTime },
          },
        });
        synced++;
      } catch (fileErr: any) {
        errors.push(`File ${file.name}: ${fileErr.message}`);
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
