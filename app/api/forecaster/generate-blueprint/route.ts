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
    if (!project.sponsorBrief) return NextResponse.json({ error: 'No sponsor brief provided' }, { status: 400 });

    const { claude, openai, preferredProvider } = await getAIClients(workspaceId);

    const systemPrompt = `You are the 8pod Forecaster — a commercial intelligence engine for sports and entertainment sponsorship.

Given a natural language description of a sponsorship opportunity, generate a structured Rights Package Blueprint as JSON.

Return ONLY valid JSON with this structure:
{
  "sponsorName": "string",
  "sponsorProfile": "Brief description of the sponsor",
  "rightsHolder": "Name of the rights holder (league, team, event, etc.)",
  "market": "Target market/geography",
  "objectives": ["objective 1", "objective 2", ...],
  "governingRules": ["rule 1", "rule 2", ...],
  "rightsPackage": ["right/asset 1", "right/asset 2", ...],
  "audienceProfile": "Description of target audience"
}

Be specific, commercial, and practical. Draw on your knowledge of sports sponsorship, media rights, and brand partnerships.`;

    let responseText: string;

    if (preferredProvider === 'anthropic' && claude) {
      const msg = await claude.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: project.sponsorBrief }],
      });
      responseText = msg.content[0].type === 'text' ? msg.content[0].text : '{}';
    } else if (openai) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 2000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: project.sponsorBrief },
        ],
      });
      responseText = completion.choices[0]?.message?.content || '{}';
    } else {
      return NextResponse.json({ error: 'No AI provider available. Add an API key in Brain > Settings.' }, { status: 400 });
    }

    // Parse JSON from response
    let blueprint;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      blueprint = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      blueprint = { raw: responseText };
    }

    // Update project
    const updated = await db.forecastProject.update({
      where: { id: projectId },
      data: {
        blueprint,
        status: 'blueprint',
        sponsorName: blueprint.sponsorName || null,
        rightsHolder: blueprint.rightsHolder || null,
        market: blueprint.market || null,
        name: blueprint.sponsorName
          ? `${blueprint.sponsorName} x ${blueprint.rightsHolder || 'Rights Package'}`
          : project.name,
      },
    });

    return NextResponse.json({ project: updated, blueprint });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Blueprint generation failed' }, { status: 500 });
  }
}
