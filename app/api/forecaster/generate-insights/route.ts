import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAIClients } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const { projectId, workspaceId } = await request.json();
    if (!projectId || !workspaceId) {
      return NextResponse.json({ error: 'Missing projectId or workspaceId' }, { status: 400 });
    }

    const project = await db.forecastProject.findFirst({ where: { id: projectId, workspaceId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (!project.blueprint) return NextResponse.json({ error: 'Blueprint not yet generated' }, { status: 400 });

    const { claude, openai, preferredProvider } = await getAIClients(workspaceId);

    const blueprintStr = JSON.stringify(project.blueprint, null, 2);

    const systemPrompt = `You are the 8pod Forecaster Algorithm. Given a Rights Package Blueprint for a sponsorship deal, generate 6-8 strategic insights as a JSON array.

Each insight should have:
{
  "category": "audience" | "revenue" | "market" | "engagement" | "brand" | "media",
  "title": "Short insight title",
  "description": "2-3 sentence explanation",
  "chartType": "bar" | "metric" | "table",
  "data": {
    // For "bar" charts: { "items": [{ "label": "...", "value": 0-100 }, ...] }
    // For "metric" charts: { "value": "£2.4M", "change": "+15%", "period": "YoY" }
    // For "table" charts: { "headers": ["Col1", "Col2"], "rows": [["val1", "val2"], ...] }
  }
}

Return ONLY a valid JSON array of insight objects. Be specific and data-driven. Use realistic estimated figures for the sponsorship context described. Focus on audience value drivers, revenue projections, market dynamics, engagement metrics, brand alignment, and media value.`;

    let responseText: string;

    if (preferredProvider === 'anthropic' && claude) {
      const msg = await claude.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Blueprint:\n${blueprintStr}` }],
      });
      responseText = msg.content[0].type === 'text' ? msg.content[0].text : '[]';
    } else if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 3000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Blueprint:\n${blueprintStr}` },
        ],
      });
      responseText = completion.choices[0]?.message?.content || '[]';
    } else {
      return NextResponse.json({ error: 'No AI provider available' }, { status: 400 });
    }

    // Parse insights array
    let insightsArr: any[] = [];
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) insightsArr = JSON.parse(jsonMatch[0]);
    } catch {
      insightsArr = [];
    }

    // Delete old insights and create new ones
    await db.forecastInsight.deleteMany({ where: { projectId } });

    for (const insight of insightsArr) {
      await db.forecastInsight.create({
        data: {
          projectId,
          category: insight.category || 'general',
          title: insight.title || 'Insight',
          description: insight.description || '',
          chartType: insight.chartType || 'metric',
          data: insight.data || {},
        },
      });
    }

    // Update project status
    await db.forecastProject.update({
      where: { id: projectId },
      data: { status: 'insights', insightsData: { generatedAt: new Date().toISOString(), count: insightsArr.length } },
    });

    return NextResponse.json({ insights: insightsArr, count: insightsArr.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Insights generation failed' }, { status: 500 });
  }
}
