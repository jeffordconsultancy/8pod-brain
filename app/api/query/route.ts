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
    const { claude } = await getAIClients(workspaceId);

    const records = await db.knowledgeRecord.findMany({
      where: { workspaceId }, take: 10, orderBy: { createdAt: 'desc' },
    });

    const context = records.map(r => `[${r.sourceSystem}] ${r.rawContent.slice(0, 500)}`).join('\n---\n');

    const msg = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: 'You are the 8pod Brain. Answer using ONLY the provided context. Cite sources.',
      messages: [{ role: 'user', content: `Context:\n${context || '(No data yet)'}\n\nQuestion: ${query}` }],
    });

    const response = msg.content[0].type === 'text' ? msg.content[0].text : 'Unable to respond.';
    const elapsed = Date.now() - start;

    await db.agentQuery.create({
      data: { workspaceId, queryText: query, routedTo: 'supervisor', responseText: response, responseTimeMs: elapsed },
    });

    return NextResponse.json({ response, sources: records.map(r => ({ source: r.sourceSystem, id: r.sourceId })), responseTimeMs: elapsed });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Query failed' }, { status: 500 });
  }
}
