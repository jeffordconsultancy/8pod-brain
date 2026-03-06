import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getKnowledgeContext } from '@/lib/knowledge-context';

function extractFromBrief(brief: string) {
  const lower = brief.toLowerCase();

  // Try to extract sponsor name
  const sponsorPatterns = [
    /(\w[\w\s]*?)\s+as\s+sponsor/i,
    /sponsor[:\s]+(\w[\w\s&.]+)/i,
    /sponsored\s+by\s+(\w[\w\s&.]+)/i,
  ];
  let sponsorName = 'Sponsor TBC';
  for (const p of sponsorPatterns) {
    const m = brief.match(p);
    if (m) { sponsorName = m[1].trim(); break; }
  }

  // Try to extract rights holder
  const rightsPatterns = [
    /(\w[\w\s]*?)\s+as\s+rights?\s*holder/i,
    /rights?\s*holder[:\s]+(\w[\w\s&.]+)/i,
    /^(\w[\w\s]*?)\s+as\s+/im,
  ];
  let rightsHolder = 'Rights Holder TBC';
  for (const p of rightsPatterns) {
    const m = brief.match(p);
    if (m) { rightsHolder = m[1].trim(); break; }
  }

  // If the brief mentions a known entity first, use it as rights holder
  const knownEntities = ['F1', 'Formula 1', 'Premier League', 'UEFA', 'FIFA', 'NFL', 'NBA', 'MLB', 'NHL', 'Olympics', 'ICC', 'ATP', 'WTA'];
  for (const entity of knownEntities) {
    if (lower.includes(entity.toLowerCase())) {
      rightsHolder = entity;
      break;
    }
  }

  // Budget
  const budgetMatch = brief.match(/[£$€]\s*(\d[\d,.]*)\s*(k|m|million|thousand)?/i);
  let budget = 'TBC';
  if (budgetMatch) {
    budget = budgetMatch[0];
  }

  // Objectives from brief
  const objectiveKeywords = ['1st party data', 'first party data', 'data acquisition', 'brand awareness', 'conversion', 'engagement', 'reach', 'lead gen', 'hospitality', 'content', 'digital', 'social'];
  const objectives = objectiveKeywords.filter(k => lower.includes(k)).map(k => k.charAt(0).toUpperCase() + k.slice(1));
  if (objectives.length === 0) objectives.push('Brand visibility', 'Audience engagement', 'Commercial ROI');

  return { sponsorName, rightsHolder, budget, objectives };
}

function generateFallbackBlueprint(brief: string): object {
  const { sponsorName, rightsHolder, budget, objectives } = extractFromBrief(brief);

  return {
    sponsorName,
    sponsorProfile: `${sponsorName} — sponsor partner seeking rights activation across ${rightsHolder} properties.`,
    rightsHolder,
    market: 'Global (primary: UK & Europe)',
    objectives,
    governingRules: [
      'All content must comply with rights holder brand guidelines',
      'Sponsor exclusivity within agreed category',
      'Digital-first activation strategy required',
      'Performance metrics to be agreed pre-activation',
      `Budget envelope: ${budget}`,
    ],
    rightsPackage: [
      'Title sponsorship of broadcast segments',
      'LED perimeter board inventory',
      'Social media co-branded content series',
      'Hospitality and experiential activations',
      'Data capture via owned digital platforms',
      '1st party audience data rights',
      'Rights to archive / legacy content clips',
      'Newsroom editorial integration',
    ],
    audienceProfile: 'Sports-engaged audiences 18-45, high digital affinity, cross-platform consumption habits. Secondary: corporate hospitality and B2B decision-makers.',
  };
}

export async function POST(request: NextRequest) {
  try {
    const { projectId, workspaceId } = await request.json();
    if (!projectId || !workspaceId) {
      return NextResponse.json({ error: 'Missing projectId or workspaceId' }, { status: 400 });
    }

    const project = await db.forecastProject.findFirst({ where: { id: projectId, workspaceId } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (!project.sponsorBrief) return NextResponse.json({ error: 'No sponsor brief provided' }, { status: 400 });

    // Try AI generation, fall back to smart extraction
    let blueprint: any;
    let usedAI = false;

    try {
      const { getAIClients } = await import('@/lib/ai');
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

      let knowledgeContext = '';
      try {
        knowledgeContext = await getKnowledgeContext(workspaceId, project.sponsorBrief) || '';
      } catch { /* ignore knowledge fetch errors */ }

      const userContent = knowledgeContext
        ? `${project.sponsorBrief}\n\nTeam knowledge context:\n${knowledgeContext}`
        : project.sponsorBrief;

      let responseText: string = '';

      if (preferredProvider === 'anthropic' && claude) {
        const msg = await claude.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userContent }],
        });
        responseText = msg.content[0].type === 'text' ? msg.content[0].text : '';
      } else if (openai) {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          max_tokens: 2000,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
        });
        responseText = completion.choices[0]?.message?.content || '';
      }

      if (responseText) {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          blueprint = JSON.parse(jsonMatch[0]);
          usedAI = true;
        }
      }
    } catch (aiError) {
      console.log('AI generation unavailable, using fallback:', (aiError as any)?.message);
    }

    // Fallback if AI didn't work
    if (!blueprint) {
      blueprint = generateFallbackBlueprint(project.sponsorBrief);
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

    return NextResponse.json({ project: updated, blueprint, usedAI });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Blueprint generation failed' }, { status: 500 });
  }
}
