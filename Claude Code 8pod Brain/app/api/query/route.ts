import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAIClients } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const { query, workspaceId } = await request.json();
    if (!query || !workspaceId) {
      return NextResponse.json({ error: 'Missing query or workspaceId' }, { status: 400 });
    }

    const start = Date.now();
    const { claude, openai, preferredProvider } = await getAIClients(workspaceId);

    const allRecords = await db.knowledgeRecord.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const queryTerms = query.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2);
    const scored = allRecords.map(r => {
      const text = (r.rawContent + ' ' + r.summary).toLowerCase();
      let score = 0;
      for (const term of queryTerms) {
        const matches = text.split(term).length - 1;
        score += matches;
      }
      const ageHours = (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60);
      score += Math.max(0, 1 - ageHours / (24 * 30));
      return { record: r, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const relevantRecords = scored.slice(0, 20).map(s => s.record);

    const context = relevantRecords
      .map(r => `[${r.sourceSystem}] ${r.summary}\n${r.rawContent.slice(0, 1000)}`)
      .join('\n---\n');

    let response: string;

    if (preferredProvider === 'anthropic' && claude) {
      const msg = await claude.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `You are the 8pod Brain — an AI assistant that answers questions using the user's connected data sources (emails, documents, calendar events). Answer using ONLY the provided context. If the context doesn't contain enough information, say so. Cite the source type (e.g. [gmail], [google-drive], [google-calendar]) when referencing specific information.`,
        messages: [{ role: 'user', content: `Context from connected data sources:\n${context || '(No data synced yet — connect and sync data sources first)'}\n\nQuestion: ${query}` }],
      });
      response = msg.content[0].type === 'text' ? msg.content[0].text : 'Unable to generate a response.';
    } else if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 2000,
        messages: [
          { role: 'system', content: `You are the 8pod Brain — an AI assistant that answers questions using the user's connected data sources (emails, documents, calendar events). Answer using ONLY the provided context. If the context doesn't contain enough information, say so. Cite the source type when referencing specific information.` },
          { role: 'user', content: `Context from connected data sources:\n${context || '(No data synced yet)'}\n\nQuestion: ${query}` },
        ],
      });
      response = completion.choices[0]?.message?.content || 'Unable to generate a response.';
    } else {
      return NextResponse.json({ error: 'No AI provider available. Add an API key in Settings.' }, { status: 400 });
    }

    const elapsed = Date.now() - start;

    await db.agentQuery.create({
      data: { workspaceId, queryText: query, routedTo: 'supervisor', responseText: response, responseTimeMs: elapsed },
    });

    return NextResponse.json({
      response,
      sources: relevantRecords.map(r => ({ source: r.sourceSystem, id: r.sourceId, summary: r.summary })),
      responseTimeMs: elapsed,
      provider: preferredProvider,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Query failed' }, { status: 500 });
  }
}
