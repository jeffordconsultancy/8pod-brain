import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db';
import { decryptToken } from '../crypto';

async function getAnthropicClient(workspaceId: string): Promise<Anthropic | null> {
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId }, select: { anthropicApiKey: true } });
  const key = workspace?.anthropicApiKey ? decryptToken(workspace.anthropicApiKey) : process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

interface ExtractedEntity {
  name: string;
  type: 'person' | 'company' | 'topic' | 'location';
  role?: string;
}

export async function extractEntities(workspaceId: string, recordIds: string[]): Promise<number> {
  const client = await getAnthropicClient(workspaceId);
  if (!client) return 0; // No API key, skip extraction

  let totalEntities = 0;

  // Process records in batches of 5 to avoid rate limits
  for (let i = 0; i < recordIds.length; i += 5) {
    const batch = recordIds.slice(i, i + 5);
    const records = await db.knowledgeRecord.findMany({ where: { id: { in: batch } } });

    for (const record of records) {
      try {
        // Truncate content to avoid huge prompts
        const content = record.rawContent.slice(0, 3000);

        const msg = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: 'Extract named entities from the following text. Return ONLY a JSON array of objects with fields: name (string), type (one of: person, company, topic, location), role (optional string, e.g. "sender", "attendee", "author"). Be specific with names. Return [] if no entities found.',
          messages: [{ role: 'user', content }],
        });

        const responseText = msg.content[0].type === 'text' ? msg.content[0].text : '[]';

        // Parse the JSON response
        let entities: ExtractedEntity[] = [];
        try {
          // Extract JSON from response (handle markdown code blocks)
          const jsonMatch = responseText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            entities = JSON.parse(jsonMatch[0]);
          }
        } catch {
          continue; // Skip if JSON parsing fails
        }

        for (const entity of entities) {
          if (!entity.name || !entity.type) continue;

          // Find or create entity
          let dbEntity = await db.entity.findFirst({
            where: { workspaceId, canonicalName: entity.name },
          });

          if (!dbEntity) {
            dbEntity = await db.entity.create({
              data: {
                workspaceId,
                type: entity.type,
                canonicalName: entity.name,
                role: entity.role,
                firstSeen: record.createdAt,
                lastSeen: record.createdAt,
                mentionCount: 0,
              },
            });
          }

          // Check if mention already exists
          const existingMention = await db.entityMention.findUnique({
            where: { entityId_recordId: { entityId: dbEntity.id, recordId: record.id } },
          });

          if (!existingMention) {
            await db.entityMention.create({
              data: {
                entityId: dbEntity.id,
                recordId: record.id,
                mentionText: entity.name,
              },
            });

            // Update mention count and lastSeen
            await db.entity.update({
              where: { id: dbEntity.id },
              data: {
                mentionCount: { increment: 1 },
                lastSeen: record.createdAt,
              },
            });

            totalEntities++;
          }
        }
      } catch (err: any) {
        console.error(`Entity extraction failed for record ${record.id}:`, err.message);
      }
    }
  }

  return totalEntities;
}
