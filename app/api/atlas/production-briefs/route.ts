import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAIClients } from '@/lib/ai';
import { getKnowledgeContext } from '@/lib/knowledge-context';

// GET: Load all production briefs for a project
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId');
  const workspace = req.nextUrl.searchParams.get('workspace');
  if (!projectId || !workspace) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const briefs = await db.productionBrief.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ briefs });
}

// POST: Generate production briefs from content plan story units
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, workspaceId, action, storyUnitIds } = body;

  if (!projectId || !workspaceId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const project = await db.forecastProject.findUnique({ where: { id: projectId } });
  if (!project || !project.blueprint) {
    return NextResponse.json({ error: 'Project or blueprint not found' }, { status: 404 });
  }

  const bp = project.blueprint as any;

  // Load content plan and story units
  const contentPlan = await db.contentPlan.findFirst({
    where: { projectId },
    include: { stories: true },
    orderBy: { version: 'desc' },
  });

  if (!contentPlan) {
    return NextResponse.json({ error: 'Content plan not found' }, { status: 404 });
  }

  const stories = storyUnitIds?.length
    ? contentPlan.stories.filter((s: any) => storyUnitIds.includes(s.id))
    : contentPlan.stories;

  const clients = await getAIClients(workspaceId);
  const knowledgeCtx = await getKnowledgeContext(workspaceId, `${bp.sponsorName} ${bp.rightsHolder} production briefs`);

  // ─────────────────────────────────────────────────────────────
  // TRACK 1 — ASSET PRODUCTION: Capture Briefs
  // For stories where captureRequired === true (original asset capture needed)
  // Inspired by PANIC structure (Purpose, Access, Narrative, Integrity, Craft)
  // ─────────────────────────────────────────────────────────────
  if (action === 'generate-capture-briefs') {
    const captureStories = stories.filter((s: any) => s.captureRequired === true);

    if (captureStories.length === 0) {
      return NextResponse.json({ error: 'No stories requiring original capture found' }, { status: 400 });
    }

    console.log(`[ProductionBriefs] Generating capture briefs for ${captureStories.length} stories`);

    const systemPrompt = `You are the 8pod Capture Brief engine. Generate structured pre-production briefs for original asset capture.

A Capture Brief is a structured document used to plan shoots and asset creation. It follows the PANIC structure (Purpose, Access, Narrative, Integrity, Craft) as a framework, but should feel natural and production-ready.

Each capture brief must include:

1. workingTitle: The character/subject name or story title
2. synopsis: Max 2 sentences — the elevator pitch for the story
3. background: 5-10 bullet points of key background information about the subject/story
4. storySource: Who pitched/found this story
5. location: Where the subject is based / where the shoot will happen
6. subjectAvailability: When the subject can be filmed
7. editorialPillar: The editorial category this story falls under
8. angle: The specific angle that makes this story original and engaging
9. regionalNarrative: How this story speaks to its regional context
10. jeopardy: The conflict or challenge the subject faces
11. desiredOutcome: The positive emotion this story should evoke (interest, surprise, delight, happiness, amusement)
12. purpose: Why this story is being told — one clear sentence
13. access: All access requirements — characters, locations, props, wardrobe
14. narrative: Overview of the story arc — beginning, middle, end
15. integrity: Any ethical sensitivities or concerns (filming children, sensitive locations, controversial subjects)
16. craft: Visual treatment overview — cinematography style, techniques
17. supportingVisuals: Any archival material needed from the subject
18. talentProfile: Name, background, relevance of the talent/subject
19. assetType: What type of asset will be produced (video, photography, or both)
20. captureRequirements: Equipment, crew size, location requirements

IMPORTANT: These briefs are for ASSET CAPTURE — the assets produced will later be used during Story Assembly (by the Newsroom) to build finished Story Units. Capture does NOT produce finished stories directly.

Generate briefs that are detailed and production-ready. Each brief should be specific to the story unit's theme, audience, and tone.

Return a JSON array of capture brief objects. Return ONLY valid JSON, no other text.`;

    const userPrompt = `Blueprint Context:
Sponsor: ${bp.sponsorName}
Rights Holder: ${bp.rightsHolder}
Market: ${bp.market}
Audience: ${bp.audienceProfile}

${knowledgeCtx ? `Workspace Knowledge:\n${knowledgeCtx.slice(0, 2000)}\n` : ''}

Generate Capture Briefs for these ${captureStories.length} story units that require original asset production:
${captureStories.map((s: any, i: number) => `
${i + 1}. Story ID: ${s.storyId}
   Theme: ${s.storyTheme}
   Audience: ${s.audienceLabel}
   Funnel Stage: ${s.funnelStage}
   Story Type: ${s.atlasStoryType}
   Treatment: ${s.storyTreatment}
   Tone: ${s.toneBand}
   Avatar: ${s.journalisticAvatar}
   Value Frame: ${s.valueFrame}
   Format: ${s.primaryFormat}
   Has Talent: ${s.talentSignal}
   Assembly Method: ${s.assemblyMethod}
   Asset Source: ${s.assetSource}
`).join('')}

Return a JSON array with one capture brief per story unit.`;

    let briefsData: any[] = [];

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
        if (match) briefsData = JSON.parse(match[0]);
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
        if (match) briefsData = JSON.parse(match[0]);
      }
    } catch (e) {
      console.log('[ProductionBriefs] AI capture brief generation failed, using fallback:', (e as any)?.message);
    }

    // Fallback
    if (briefsData.length === 0) {
      briefsData = captureStories.map((s: any) => generateFallbackCaptureBrief(s, bp));
    }

    // Save capture briefs
    for (let i = 0; i < briefsData.length; i++) {
      const brief = briefsData[i];
      const storyUnit = captureStories[i];
      try {
        await db.productionBrief.create({
          data: {
            projectId,
            storyUnitId: storyUnit?.id,
            briefType: 'CAPTURE_BRIEF',
            title: brief.workingTitle || `Capture Brief — ${storyUnit?.storyTheme || 'Story'} ${i + 1}`,
            content: brief,
          },
        });
      } catch (e) {
        console.error(`[ProductionBriefs] Failed to save capture brief ${i}:`, (e as any)?.message);
      }
    }

    return NextResponse.json({ success: true, count: briefsData.length });
  }

  // ─────────────────────────────────────────────────────────────
  // TRACK 1 — ASSET PRODUCTION: Shooting Scripts
  // Derived from Capture Briefs — interview/shooting scripts for on-set use
  // Inspired by Wendy structure (opening, jeopardy arc, resolution, questions)
  // ─────────────────────────────────────────────────────────────
  if (action === 'generate-shooting-scripts') {
    const existingCaptureBriefs = await db.productionBrief.findMany({
      where: { projectId, briefType: 'CAPTURE_BRIEF' },
    });

    if (existingCaptureBriefs.length === 0) {
      return NextResponse.json({ error: 'Generate Capture Briefs first before creating shooting scripts' }, { status: 400 });
    }

    console.log(`[ProductionBriefs] Generating shooting scripts for ${existingCaptureBriefs.length} capture briefs`);

    const systemPrompt = `You are the 8pod Shooting Script engine. Generate interview and shooting scripts from Capture Briefs.

A Shooting Script is a structured document the production crew takes on set. It follows a narrative arc designed to elicit authentic responses. The structure is:

1. openingStatement: A single statement with an element of surprise that hooks the audience. Written in the subject's voice.
2. supportingStatements: 3-4 statements giving context to the opening. What is the story about, why does the subject do what they do?
3. generalJeopardyStatement: A single relatable challenge statement — speaks to emotion, not a specific incident
4. specificJeopardyStatements: 3-4 statements turning the general jeopardy into specific story details
5. generalHappyEndingStatement: A single positive outcome statement — relatable emotion about overcoming the challenge
6. specificHappyEndingStatements: 3-4 statements with specific uplifting conclusions. Must include at least one statement that speaks to the regional narrative.
7. questions: 8-10 emotive interview questions that speak back to the statements and cover the main story elements

The statements should be written in the subject's voice — as if they are speaking. Consider the subject's age, personality, and language.

Return a JSON array of shooting script objects. Return ONLY valid JSON, no other text.`;

    const userPrompt = `Blueprint Context:
Sponsor: ${bp.sponsorName}
Rights Holder: ${bp.rightsHolder}
Market: ${bp.market}

Generate Shooting Scripts for these ${existingCaptureBriefs.length} capture briefs:
${existingCaptureBriefs.map((brief: any, i: number) => {
  const content = brief.content as any;
  return `
${i + 1}. Title: ${brief.title}
   Synopsis: ${content.synopsis || 'N/A'}
   Angle: ${content.angle || 'N/A'}
   Purpose: ${content.purpose || 'N/A'}
   Narrative: ${content.narrative || 'N/A'}
   Regional Narrative: ${content.regionalNarrative || 'N/A'}
   Jeopardy: ${content.jeopardy || 'N/A'}
   Desired Outcome: ${content.desiredOutcome || 'N/A'}
   Talent: ${content.talentProfile?.name || content.workingTitle || 'Subject'}
`;
}).join('')}

Return a JSON array with one shooting script per capture brief.`;

    let scriptsData: any[] = [];

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
        if (match) scriptsData = JSON.parse(match[0]);
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
        if (match) scriptsData = JSON.parse(match[0]);
      }
    } catch (e) {
      console.log('[ProductionBriefs] AI shooting script generation failed, using fallback:', (e as any)?.message);
    }

    // Fallback
    if (scriptsData.length === 0) {
      scriptsData = existingCaptureBriefs.map((brief: any) => generateFallbackShootingScript(brief));
    }

    // Save shooting scripts
    for (let i = 0; i < scriptsData.length; i++) {
      const script = scriptsData[i];
      const captureBrief = existingCaptureBriefs[i];
      try {
        await db.productionBrief.create({
          data: {
            projectId,
            storyUnitId: (captureBrief as any).storyUnitId,
            briefType: 'SHOOTING_SCRIPT',
            title: `Shooting Script — ${captureBrief.title.replace('Capture Brief — ', '')}`,
            content: script,
          },
        });
      } catch (e) {
        console.error(`[ProductionBriefs] Failed to save shooting script ${i}:`, (e as any)?.message);
      }
    }

    return NextResponse.json({ success: true, count: scriptsData.length });
  }

  // ─────────────────────────────────────────────────────────────
  // TRACK 2 — STORY ASSEMBLY: Newsroom Editorial Briefs
  // For stories assembled by the Newsroom team
  // ─────────────────────────────────────────────────────────────
  if (action === 'generate-newsroom-briefs') {
    const newsroomStories = stories.filter((s: any) => s.assemblyMethod === 'Newsroom');

    if (newsroomStories.length === 0) {
      return NextResponse.json({ error: 'No Newsroom-assembled story units found' }, { status: 400 });
    }

    console.log(`[ProductionBriefs] Generating newsroom briefs for ${newsroomStories.length} stories`);

    const systemPrompt = `You are the 8pod Newsroom Brief engine. Generate editorial assembly briefs for stories that will be assembled by the Newsroom team.

The Newsroom assembles stories through two streams:
1. Editorial Research & Curation — creating stories by curating relevant material, research, and archival content
2. Asset-Based Story Creation — packaging captured production assets into Story Units according to format treatments

A Newsroom Brief must include:
1. headline: Working editorial headline
2. editorialAngle: The specific curation or narrative angle
3. assemblyStream: Which newsroom stream — "editorial_curation" or "asset_packaging"
4. sourceConstraints: What sources can/should be used (curated material, captured assets, legacy archives)
5. curationParameters: Key themes, entities, and topics to curate around
6. avatarVoice: The journalistic avatar's tone and register for this piece
7. audienceContext: Who this is for and why they care
8. formatSpec: Format requirements (long-form, short-form, interactive, etc.)
9. sponsorIntegration: How sponsor presence should be handled (ratio, placement)
10. assetRequirements: What assets are needed from the Asset Library (captured footage, legacy material, etc.)
11. narrativeStructure: How the story arc should be structured
12. deadline: Suggested production timeline
13. qualityGates: Editorial standards that must be met before publication

Return a JSON array. Return ONLY valid JSON, no other text.`;

    const userPrompt = `Blueprint Context:
Sponsor: ${bp.sponsorName}
Rights Holder: ${bp.rightsHolder}
Market: ${bp.market}

Generate Newsroom Briefs for these ${newsroomStories.length} story units:
${newsroomStories.map((s: any, i: number) => `
${i + 1}. Story ID: ${s.storyId}
   Theme: ${s.storyTheme}
   Audience: ${s.audienceLabel}
   Funnel: ${s.funnelStage}
   Avatar: ${s.journalisticAvatar}
   Tone: ${s.toneBand}
   Format: ${s.primaryFormat}
   Asset Source: ${s.assetSource}
   Capture Required: ${s.captureRequired}
   Sponsor: ${s.sponsorPresence ? `Yes (${s.sponsorRatio})` : 'No'}
`).join('')}`;

    let briefsData: any[] = [];

    try {
      if (clients.claude) {
        const res = await clients.claude.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 6000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });
        const text = (res.content[0] as any).text;
        const match = text.match(/\[[\s\S]*\]/);
        if (match) briefsData = JSON.parse(match[0]);
      } else if (clients.openai) {
        const res = await clients.openai.chat.completions.create({
          model: 'gpt-4o',
          max_tokens: 6000,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        });
        const text = res.choices[0]?.message?.content || '';
        const match = text.match(/\[[\s\S]*\]/);
        if (match) briefsData = JSON.parse(match[0]);
      }
    } catch (e) {
      console.log('[ProductionBriefs] AI Newsroom brief generation failed:', (e as any)?.message);
    }

    if (briefsData.length === 0) {
      briefsData = newsroomStories.map((s: any) => ({
        headline: `${s.storyTheme} — Editorial Brief`,
        editorialAngle: `${s.atlasStoryType} perspective on ${s.storyTheme}`,
        assemblyStream: s.captureRequired ? 'asset_packaging' : 'editorial_curation',
        sourceConstraints: s.captureRequired
          ? 'Primary: captured production assets. Secondary: rights holder archive.'
          : 'Verified sources only. Cross-reference with rights holder archive.',
        curationParameters: `Theme: ${s.storyTheme}. Value Frame: ${s.valueFrame}. Audience: ${s.audienceLabel}.`,
        avatarVoice: `${s.journalisticAvatar} — ${s.toneBand} register`,
        audienceContext: `${s.audienceLabel} audience at ${s.funnelStage} stage`,
        formatSpec: s.primaryFormat || 'Editorial',
        sponsorIntegration: s.sponsorPresence ? `Sponsor ratio: ${s.sponsorRatio}` : 'No sponsor presence',
        assetRequirements: s.captureRequired
          ? `Captured assets from original production. Asset source: ${s.assetSource}`
          : `Curated material from ${s.assetSource || 'available sources'}`,
        narrativeStructure: 'Opening hook → Context → Depth → Resolution → Call to action',
        deadline: 'Per sprint cadence',
        qualityGates: 'Fact-check, editorial review, avatar voice compliance, brand safety check',
      }));
    }

    for (let i = 0; i < briefsData.length; i++) {
      const brief = briefsData[i];
      const storyUnit = newsroomStories[i];
      try {
        await db.productionBrief.create({
          data: {
            projectId,
            storyUnitId: storyUnit?.id,
            briefType: 'NEWSROOM_BRIEF',
            title: brief.headline || `Newsroom Brief ${i + 1}`,
            content: brief,
          },
        });
      } catch (e) {
        console.error(`[ProductionBriefs] Failed to save newsroom brief ${i}:`, (e as any)?.message);
      }
    }

    return NextResponse.json({ success: true, count: briefsData.length });
  }

  // ─────────────────────────────────────────────────────────────
  // TRACK 2 — STORY ASSEMBLY: Generative Story Briefs
  // For stories assembled using AI/generative methods
  // ─────────────────────────────────────────────────────────────
  if (action === 'generate-generative-briefs') {
    const generativeStories = stories.filter((s: any) => s.assemblyMethod === 'Generative');

    if (generativeStories.length === 0) {
      return NextResponse.json({ error: 'No Generative-assembled story units found' }, { status: 400 });
    }

    console.log(`[ProductionBriefs] Generating generative story briefs for ${generativeStories.length} stories`);

    const systemPrompt = `You are the 8pod Generative Story Brief engine. Generate structured AI assembly instructions for stories that will be created using generative methods.

A Generative Story Brief provides all the structured inputs needed for AI-assisted story creation. The brief must include:

1. headline: Working story headline
2. storyObjective: What this story should achieve (awareness, engagement, conversion)
3. generativeSource: What data/content the AI will use as source material
4. generativeSourceType: One of: "blueprint_insight", "performance_signal", "asset_id", "structured_dataset"
5. narrativeTemplate: The storytelling structure to follow
6. toneAndVoice: How the AI should write — avatar voice, register, personality
7. audienceContext: Who this is for and the emotional connection intended
8. formatConstraints: Length, format, visual treatment requirements
9. sponsorRules: How sponsor presence should be handled
10. humanGateRequired: Whether human review is needed before publication
11. qualityChecks: Automated quality requirements (brand safety, factual accuracy, tone compliance)
12. variationStrategy: How to create format variants (headline personalisation, A/B testing, etc.)
13. assetGuidance: What visual assets to pair with the generated narrative
14. attributionRules: How to credit sources and data

IMPORTANT: Generative stories still use structured inputs and system constraints. They are NOT unconstrained AI generation — they follow format rules, audience targeting, and brand safety requirements.

Return a JSON array. Return ONLY valid JSON, no other text.`;

    const userPrompt = `Blueprint Context:
Sponsor: ${bp.sponsorName}
Rights Holder: ${bp.rightsHolder}
Market: ${bp.market}

Generate Generative Story Briefs for these ${generativeStories.length} story units:
${generativeStories.map((s: any, i: number) => `
${i + 1}. Story ID: ${s.storyId}
   Theme: ${s.storyTheme}
   Audience: ${s.audienceLabel}
   Funnel: ${s.funnelStage}
   Story Type: ${s.atlasStoryType}
   Avatar: ${s.journalisticAvatar}
   Tone: ${s.toneBand}
   Value Frame: ${s.valueFrame}
   Format: ${s.primaryFormat}
   Asset Source: ${s.assetSource}
   Generative Source Type: ${s.generativeSourceType || 'blueprint_insight'}
   Sponsor: ${s.sponsorPresence ? `Yes (${s.sponsorRatio})` : 'No'}
   Headline Personalisation: ${s.headlinePersonalisation}
   Headline Variants: ${s.headlineVariantCount || 1}
`).join('')}`;

    let briefsData: any[] = [];

    try {
      if (clients.claude) {
        const res = await clients.claude.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 6000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });
        const text = (res.content[0] as any).text;
        const match = text.match(/\[[\s\S]*\]/);
        if (match) briefsData = JSON.parse(match[0]);
      } else if (clients.openai) {
        const res = await clients.openai.chat.completions.create({
          model: 'gpt-4o',
          max_tokens: 6000,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        });
        const text = res.choices[0]?.message?.content || '';
        const match = text.match(/\[[\s\S]*\]/);
        if (match) briefsData = JSON.parse(match[0]);
      }
    } catch (e) {
      console.log('[ProductionBriefs] AI Generative brief generation failed:', (e as any)?.message);
    }

    if (briefsData.length === 0) {
      briefsData = generativeStories.map((s: any) => ({
        headline: `${s.storyTheme} — Generative Story`,
        storyObjective: s.funnelStage === 'Conversion' ? 'Drive conversion' : s.funnelStage === 'Immersion' ? 'Deepen engagement' : 'Build awareness',
        generativeSource: `Blueprint insight: ${s.storyTheme}. Performance signals from audience: ${s.audienceLabel}`,
        generativeSourceType: s.generativeSourceType || 'blueprint_insight',
        narrativeTemplate: `${s.atlasStoryType} template — ${s.storyTreatment || 'standard treatment'}`,
        toneAndVoice: `${s.journalisticAvatar} avatar. ${s.toneBand} register. Value frame: ${s.valueFrame}`,
        audienceContext: `${s.audienceLabel} at ${s.funnelStage} stage`,
        formatConstraints: `Format: ${s.primaryFormat || 'Digital'}. Variants required: ${s.formatVariantsRequired || 1}`,
        sponsorRules: s.sponsorPresence ? `Sponsor ratio: ${s.sponsorRatio}. Sponsor presence integrated.` : 'No sponsor integration',
        humanGateRequired: s.humanGateRequired !== false,
        qualityChecks: 'Brand safety scan, tone compliance, factual accuracy, audience alignment verification',
        variationStrategy: s.headlinePersonalisation ? `${s.headlineVariantCount || 3} headline variants for A/B testing` : 'Single variant',
        assetGuidance: `Source: ${s.assetSource || 'GenerativeAI'}. Match visual treatment to ${s.toneBand} tone.`,
        attributionRules: 'Data-sourced claims must be attributed. Blueprint insights credited to research phase.',
      }));
    }

    for (let i = 0; i < briefsData.length; i++) {
      const brief = briefsData[i];
      const storyUnit = generativeStories[i];
      try {
        await db.productionBrief.create({
          data: {
            projectId,
            storyUnitId: storyUnit?.id,
            briefType: 'GENERATIVE_BRIEF',
            title: brief.headline || `Generative Brief ${i + 1}`,
            content: brief,
          },
        });
      } catch (e) {
        console.error(`[ProductionBriefs] Failed to save generative brief ${i}:`, (e as any)?.message);
      }
    }

    return NextResponse.json({ success: true, count: briefsData.length });
  }

  return NextResponse.json({ error: 'Unknown action. Valid actions: generate-capture-briefs, generate-shooting-scripts, generate-newsroom-briefs, generate-generative-briefs' }, { status: 400 });
}

// PATCH: Update brief status
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { briefId, status } = body;

  if (!briefId || !status) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  await db.productionBrief.update({
    where: { id: briefId },
    data: {
      status,
      approvedAt: status === 'APPROVED' ? new Date() : null,
    },
  });

  return NextResponse.json({ success: true });
}

// ─────────────────────────────────────────────────────────────
// FALLBACK GENERATORS
// ─────────────────────────────────────────────────────────────

function generateFallbackCaptureBrief(story: any, bp: any): any {
  return {
    workingTitle: story.storyTheme || 'Story Subject',
    synopsis: `A ${story.atlasStoryType?.toLowerCase() || 'compelling'} story exploring ${story.storyTheme || 'the subject'} for ${story.audienceLabel || 'the target audience'}.`,
    background: [
      `Story aligns with ${bp.rightsHolder} rights package.`,
      `Target audience: ${story.audienceLabel}.`,
      `Funnel stage: ${story.funnelStage}.`,
      `Production value frame: ${story.valueFrame || 'Not specified'}.`,
      `Story type: ${story.atlasStoryType || 'General'}.`,
    ],
    storySource: '8pod Atlas Content Plan',
    location: bp.market || 'TBD',
    subjectAvailability: 'To be confirmed with subject',
    editorialPillar: story.storyTheme || 'General',
    angle: `${story.atlasStoryType} approach to ${story.storyTheme} targeting ${story.audienceLabel} audience`,
    regionalNarrative: `How this story connects to the ${bp.market || 'target'} market`,
    jeopardy: 'To be developed during research phase',
    desiredOutcome: 'Interest, surprise, inspiration',
    purpose: `To create compelling ${story.funnelStage?.toLowerCase() || ''} content that resonates with ${story.audienceLabel || 'audiences'}`,
    access: 'Subject access requirements to be confirmed',
    narrative: 'Beginning: Introduce subject and context. Middle: Explore the challenge/journey. End: Resolution and call to action.',
    integrity: 'Standard editorial guidelines apply. Verify facts and obtain releases.',
    craft: `${story.toneBand || 'Authentic'} visual tone. Format: ${story.primaryFormat || 'Video'}.`,
    supportingVisuals: 'Reference archive from rights holder where available',
    talentProfile: {
      name: 'TBD',
      background: 'To be identified',
      relevance: `Aligned with ${story.storyTheme} theme and ${story.audienceLabel} audience`,
    },
    assetType: story.primaryFormat?.toLowerCase().includes('video') ? 'Video' : 'Video and Photography',
    captureRequirements: `Crew size TBD. Location: ${bp.market || 'TBD'}. Equipment per format treatment.`,
  };
}

function generateFallbackShootingScript(captureBrief: any): any {
  const content = captureBrief.content as any;
  return {
    openingStatement: `[Opening statement to be crafted based on: ${content.angle || content.synopsis || 'the story angle'}]`,
    supportingStatements: [
      'Supporting statement 1 — context and background',
      'Supporting statement 2 — what the subject does',
      'Supporting statement 3 — why they do it',
      'Supporting statement 4 — the outcome',
    ],
    generalJeopardyStatement: '[A relatable challenge statement — speaks to universal emotion]',
    specificJeopardyStatements: [
      'Specific jeopardy 1 — the personal challenge',
      'Specific jeopardy 2 — obstacles faced',
      'Specific jeopardy 3 — moments of doubt',
    ],
    generalHappyEndingStatement: '[A positive outcome statement — relatable emotion of overcoming]',
    specificHappyEndingStatements: [
      'Specific happy ending 1 — tangible achievement',
      'Specific happy ending 2 — community/regional impact',
      'Specific happy ending 3 — speaks to regional narrative',
    ],
    questions: [
      'Tell me about yourself and what you do?',
      'What inspired you to start this journey?',
      'What has been the biggest challenge you\'ve faced?',
      'How did you overcome that challenge?',
      'What does success look like for you?',
      'How does your work impact your community?',
      'What would you say to someone facing similar challenges?',
      'What are your hopes for the future?',
    ],
  };
}
