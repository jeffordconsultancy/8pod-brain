import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAIClients } from '@/lib/ai';
import { getKnowledgeContext } from '@/lib/knowledge-context';

export async function POST(request: NextRequest) {
  try {
    const { projectId, insightId, workspaceId } = await request.json();
    if (!projectId || !insightId || !workspaceId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const project = await db.forecastProject.findFirst({ where: { id: projectId, workspaceId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const insight = await db.forecastInsight.findFirst({ where: { id: insightId, projectId } });
    if (!insight) return NextResponse.json({ error: 'Insight not found' }, { status: 404 });

    const { claude, openai, preferredProvider } = await getAIClients(workspaceId);

    const bp = project.blueprint as any;
    const queryHints = [bp?.sponsorName, bp?.rightsHolder, insight.title, insight.category].filter(Boolean).join(' ');
    const knowledgeContext = await getKnowledgeContext(workspaceId, queryHints);

    const context = `Blueprint: ${JSON.stringify(project.blueprint, null, 2)}

Insight to analyse:
Category: ${insight.category}
Title: ${insight.title}
Description: ${insight.description}
Data: ${JSON.stringify(insight.data, null, 2)}${knowledgeContext ? `\n\nTeam knowledge context (emails, meetings, documents):\n${knowledgeContext}` : ''}`;

    const systemPrompt = `You are the 8pod Algorithm — a deep analytical engine for sports and entertainment commercial intelligence.

Given a Rights Package Blueprint and a specific insight, provide a detailed "double-click" deep dive analysis. This should include:

1. Why this insight matters for the specific deal
2. Historical precedents and benchmarks from similar sponsorships
3. Risk factors and sensitivities
4. Actionable recommendations
5. Estimated financial impact where relevant

You also have access to the team's connected data (emails, calendar events, documents). Reference any relevant real-world context from the team's data to ground your analysis in actual relationships and communications.

Be specific, authoritative, and commercially focused. Write in clear paragraphs, not bullet points. Reference real-world comparable deals where appropriate.`;

    let analysis: string;

    if (preferredProvider === 'anthropic' && claude) {
      const msg = await claude.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: context }],
      });
      analysis = msg.content[0].type === 'text' ? msg.content[0].text : 'Analysis unavailable.';
    } else if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 2000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: context },
        ],
      });
      analysis = completion.choices[0]?.message?.content || 'Analysis unavailable.';
    } else {
      return NextResponse.json({ error: 'No AI provider available' }, { status: 400 });
    }

    return NextResponse.json({ analysis, insightId });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Deep dive failed' }, { status: 500 });
  }
}
