import { db } from './db';

/**
 * Fetches relevant knowledge records from the full workspace pool (no scope filter)
 * and returns a formatted context string for AI prompts.
 */
export async function getKnowledgeContext(
  workspaceId: string,
  queryHints: string,
  maxRecords: number = 30,
): Promise<string> {
  const allRecords = await db.knowledgeRecord.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      contributedBy: { select: { name: true } },
    },
  });

  if (allRecords.length === 0) return '';

  // Relevance scoring: count query term matches in content
  const queryTerms = queryHints.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const scored = allRecords.map(r => {
    const text = (r.rawContent + ' ' + (r.summary || '')).toLowerCase();
    let score = 0;
    for (const term of queryTerms) {
      score += (text.split(term).length - 1);
    }
    // Recency boost for last 30 days
    const ageHours = (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60);
    score += Math.max(0, 1 - ageHours / (24 * 30));
    return { record: r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const relevant = scored.slice(0, maxRecords).filter(s => s.score > 0).map(s => s.record);

  if (relevant.length === 0) return '';

  return relevant
    .map(r => {
      const via = r.contributedBy?.name ? ` via ${r.contributedBy.name}` : '';
      return `[${r.sourceSystem}${via}] ${r.summary || ''}\n${r.rawContent.slice(0, 800)}`;
    })
    .join('\n---\n');
}
