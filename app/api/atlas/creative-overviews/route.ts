import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAIClients } from '@/lib/ai';
import { getKnowledgeContext } from '@/lib/knowledge-context';

// GET: Load creative overviews for a project
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId');
  const workspace = req.nextUrl.searchParams.get('workspace');
  if (!projectId || !workspace) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const overviews = await db.creativeOverview.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ overviews });
}

// POST: Generate creative overviews from content plan
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, workspaceId } = body;

  if (!projectId || !workspaceId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const project = await db.forecastProject.findUnique({ where: { id: projectId } });
  if (!project || !project.blueprint) {
    return NextResponse.json({ error: 'Project or blueprint not found' }, { status: 404 });
  }

  const bp = project.blueprint as any;

  // Load content plan story units
  const contentPlan = await db.contentPlan.findFirst({
    where: { projectId },
    include: { stories: true },
    orderBy: { version: 'desc' },
  });

  // Load rights assets for format context
  const assets = await db.rightsAsset.findMany({ where: { projectId } });

  const clients = await getAIClients(workspaceId);
  const knowledgeCtx = await getKnowledgeContext(workspaceId, `${bp.sponsorName} ${bp.rightsHolder} creative format treatment`);

  // Identify distinct formats from the content plan
  const formats = contentPlan
    ? [...new Set(contentPlan.stories.map((s: any) => s.primaryFormat).filter(Boolean))]
    : ['Video', 'Editorial', 'Interactive'];

  // Identify distinct production routes
  const routes = contentPlan
    ? [...new Set(contentPlan.stories.map((s: any) => s.productionRoute).filter(Boolean))]
    : ['Capture', 'Newsroom', 'Generative'];

  // Group story units by story type for format identification
  const storyTypeGroups = contentPlan
    ? contentPlan.stories.reduce((acc: Record<string, any[]>, s: any) => {
        const key = s.atlasStoryType || 'General';
        if (!acc[key]) acc[key] = [];
        acc[key].push(s);
        return acc;
      }, {} as Record<string, any[]>)
    : {};

  const systemPrompt = `You are the 8pod Creative Overview engine. Generate professional format treatments / creative overviews for content formats.

These are presentation-quality documents similar to pitch decks that describe a content format. Each creative overview should include:

1. formatName: A compelling name for the format/series (e.g., "City Circuits", "All Access Pass", "Deep Dive")
2. tagline: A punchy one-liner that captures the essence
3. seriesRationale: Why this format exists — the strategic reasoning. Who is the talent/subject, why are they perfect for this? (2-3 paragraphs)
4. seriesSynopsis: What happens in this format — the full creative description. How does the format work, what does the viewer experience? (2-3 paragraphs)
5. formatDescription: The mechanical description — how many episodes, what length, what's the structure, shooting style, edit style
6. audienceProfile: Who watches this and why — interests, demographics, psychographics
7. audienceInterests: Array of 4-6 interest categories (e.g., "Exploration", "Culture", "Food & Drinks")
8. partnershipContext: Brand/sponsor integration opportunity — how does the sponsor fit naturally into this format?
9. callToAction: The audience engagement hook — competitions, community building, user participation
10. talentProfile: The talent or subject anchor for this format — name, bio, why they're the right fit
11. distributionNotes: Where and how this format gets distributed via 8pod
12. productionScale: Budget tier indication, crew requirements, location requirements
13. contentPillarAlignment: How this format maps to the broader content strategy

Each overview should feel like a real creative pitch document — compelling, visual in its language, and commercially aware.

Return a JSON array of creative overview objects. Return ONLY valid JSON, no other text.`;

  const audiences = contentPlan
    ? [...new Set(contentPlan.stories.map((s: any) => s.audienceLabel).filter(Boolean))]
    : [];

  const userPrompt = `Blueprint Context:
Sponsor: ${bp.sponsorName}
Rights Holder: ${bp.rightsHolder}
Market: ${bp.market}
Audience Profile: ${bp.audienceProfile}
Objectives: ${(bp.objectives || []).join(', ')}
Rights Package: ${(bp.rightsPackage || []).join(', ')}

Content Plan Context:
- ${contentPlan?.stories?.length || 0} story units across ${audiences.length} audiences
- Formats in use: ${formats.join(', ')}
- Production routes: ${routes.join(', ')}
- Story types: ${Object.keys(storyTypeGroups).join(', ')}
- Audiences: ${audiences.join(', ')}

Available Rights Assets: ${assets.length} assets across types: ${[...new Set(assets.map(a => a.assetType))].join(', ')}

${knowledgeCtx ? `Workspace Knowledge:\n${knowledgeCtx.slice(0, 2000)}\n` : ''}

Generate 3-5 distinct creative overviews / format treatments that would work for this rights package. Each should be a different content format (e.g., one might be a behind-the-scenes series, another a city exploration format, another a deep-dive educational series, etc.).

Make them feel like real 8pod format pitches — specific to the rights holder, the sponsor, and the market. Use real-world production language.`;

  let overviewsData: any[] = [];

  try {
    if (clients.claude) {
      const res = await clients.claude.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const text = (res.content[0] as any).text;
      const match = text.match(/\[[\s\S]*\]/);
      if (match) overviewsData = JSON.parse(match[0]);
    } else if (clients.openai) {
      const res = await clients.openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 8000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
      const text = res.choices[0]?.message?.content || '';
      const match = text.match(/\[[\s\S]*\]/);
      if (match) overviewsData = JSON.parse(match[0]);
    }
  } catch (e) {
    console.log('AI Creative Overview generation failed:', (e as any)?.message);
  }

  // Fallback
  if (overviewsData.length === 0) {
    overviewsData = generateFallbackOverviews(bp, formats, audiences);
  }

  // Save creative overviews
  for (const overview of overviewsData) {
    await db.creativeOverview.create({
      data: {
        projectId,
        formatName: overview.formatName || 'Untitled Format',
        seriesRationale: overview.seriesRationale,
        seriesSynopsis: overview.seriesSynopsis,
        formatDescription: overview.formatDescription,
        audienceProfile: overview.audienceProfile ? { description: overview.audienceProfile, interests: overview.audienceInterests || [] } : undefined,
        partnershipContext: overview.partnershipContext,
        callToAction: overview.callToAction,
        talentProfile: overview.talentProfile ? (typeof overview.talentProfile === 'string' ? { description: overview.talentProfile } : overview.talentProfile) : undefined,
        distributionNotes: overview.distributionNotes,
        content: overview,
      },
    });
  }

  return NextResponse.json({ success: true, count: overviewsData.length });
}

// PATCH: Update overview status
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { overviewId, status } = body;

  if (!overviewId || !status) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  await db.creativeOverview.update({
    where: { id: overviewId },
    data: {
      status,
      approvedAt: status === 'APPROVED' ? new Date() : null,
    },
  });

  return NextResponse.json({ success: true });
}

function generateFallbackOverviews(bp: any, formats: string[], audiences: string[]): any[] {
  return [
    {
      formatName: `${bp.rightsHolder || 'Series'} — Behind The Curtain`,
      tagline: 'The stories behind the stories',
      seriesRationale: `An intimate behind-the-scenes format that takes ${audiences[0] || 'audiences'} inside the world of ${bp.rightsHolder || 'the rights holder'}. This format leverages exclusive access to create content that feels authentic and insider-driven.`,
      seriesSynopsis: `Each episode follows a different character or moment within the ${bp.rightsHolder} ecosystem. The camera is always present, capturing candid moments, real decisions, and human emotions that the public rarely sees.`,
      formatDescription: `8-12 episodes per season. 3-8 minute episodes. Unscripted, observational shooting style with intimate interviews. Fast-paced montage edit.`,
      audienceProfile: `${audiences[0] || 'Core fans'} who want deeper access and authentic behind-the-scenes content.`,
      audienceInterests: ['People and Culture', 'Reality', 'Pop Culture', 'Lifestyle Entertainment'],
      partnershipContext: `${bp.sponsorName || 'Sponsor'} integration through natural product placement and branded moments. Mid-funnel ratio: 30:70 content-to-sponsor.`,
      callToAction: 'Fans vote on which behind-the-scenes moment gets a full deep-dive episode next.',
      talentProfile: { name: 'TBD — from rights holder roster', background: 'Key personality from the rights holder', relevance: 'Authentic access and audience appeal' },
      distributionNotes: 'Distributed via 8pod units across premium publisher network. Optimised for mobile-first consumption.',
      productionScale: 'Mid-tier production. 2-person crew. On-location at rights holder venues.',
      contentPillarAlignment: `Aligns with ${bp.objectives?.[0] || 'engagement'} objective.`,
    },
    {
      formatName: `${bp.market || 'Global'} Spotlight`,
      tagline: `Exploring ${bp.market || 'the world'} through the lens of ${bp.rightsHolder || 'story'}`,
      seriesRationale: `A location-driven format that connects ${bp.rightsHolder} to the culture and energy of ${bp.market || 'target markets'}. Each episode is a love letter to a city/region, anchored by a local character whose story intersects with the world of ${bp.rightsHolder}.`,
      seriesSynopsis: `Part travelogue, part character study. The audience discovers a place through a person — their routines, their haunts, their relationship to ${bp.rightsHolder}. The format is light, fast-paced, and visually rich.`,
      formatDescription: `10-20 episodes. 2-5 minutes each. In-car cameras, street-level POV, and authentic interactions. Unscripted with guided prompts.`,
      audienceProfile: `Audiences interested in exploration, destinations, and lifestyle content who also have an affinity for ${bp.rightsHolder}.`,
      audienceInterests: ['Exploration', 'Destinations', 'Culture', 'Food & Drinks', 'Lifestyle'],
      partnershipContext: `${bp.sponsorName || 'Sponsor'} brand integration through location-based activations and sponsored city guides.`,
      callToAction: 'Audience submits their own city recommendations. Best submissions featured in future episodes.',
      talentProfile: { name: 'TBD', background: 'Local personality or rights holder talent', relevance: 'Authentic connection to the city and audience' },
      distributionNotes: 'Distributed via 8pod. Geo-targeted to match episode locations for maximum relevance.',
      productionScale: 'Lower-tier production. 1-2 person crew. Authentic, run-and-gun style.',
      contentPillarAlignment: `Supports audience expansion into ${audiences[1] || 'new'} segments.`,
    },
    {
      formatName: `The ${bp.rightsHolder || 'Subject'} Masterclass`,
      tagline: 'Learn from the best. Powered by those who know.',
      seriesRationale: `An educational deep-dive format that positions ${bp.rightsHolder} as the authoritative source of knowledge in their domain. Expert talent breaks down complex topics into compelling, accessible stories.`,
      seriesSynopsis: `Each episode tackles a single topic with depth and clarity. The talent speaks directly to camera, supplemented by rich archive footage, data visualisations, and real-world examples. The tone is authoritative but accessible — think BBC Maestro meets 8pod interactivity.`,
      formatDescription: `6-10 episodes. 5-15 minutes each. Studio and location hybrid. Teleprompter-supported delivery with B-roll packages.`,
      audienceProfile: `Knowledge-seekers and enthusiasts who want expert-level insight in an engaging, modern format.`,
      audienceInterests: ['Education', 'Science & Technology', 'Insight', 'Expert Opinion'],
      partnershipContext: `${bp.sponsorName || 'Sponsor'} positioned as the enabler of knowledge — "Powered by" branding and contextual ad units.`,
      callToAction: '"Ask the Expert" — audience submits questions for future episodes. Top questions answered in special Q&A editions.',
      talentProfile: { name: 'TBD — domain expert from rights holder network', background: 'Recognised authority in the field', relevance: 'Credibility and audience trust' },
      distributionNotes: 'Long-form distribution via 8pod premium placements. Evergreen content suitable for always-on campaigns.',
      productionScale: 'Mid-high tier production. Professional lighting and sound. Mixed studio/location.',
      contentPillarAlignment: `Aligns with educational and authority-building objectives.`,
    },
  ];
}
