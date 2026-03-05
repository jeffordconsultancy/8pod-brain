import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAIClients } from '@/lib/ai';
import { getKnowledgeContext } from '@/lib/knowledge-context';

const ATLAS_8_STORY_TYPES = [
  'Docu-Style / Investigative / Features',
  'Behind-the-Scenes / Exclusive Access',
  'Interviews & Conversations',
  'Narrative / Serialised Storytelling',
  'Educational / How-To',
  'Comedy / Light-Hearted Content',
  'User-Generated & Community-Curated',
  'Clip Rights / Legacy Content',
];

const VALUE_FRAMES = ['Belonging', 'Achievement', 'Identity', 'Insider Access'];
const TONE_BANDS = ['Authoritative', 'Empathetic', 'Wry', 'Cultural Translator'];
const FUNNEL_STAGES = ['Inspiration', 'Aspiration', 'Immersion', 'Conversion'];
const PRODUCTION_ROUTES = ['Legacy', 'Newsroom', 'Capture', 'Generative'];

// GET: Load content plan
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId');
  const workspace = req.nextUrl.searchParams.get('workspace');
  if (!projectId || !workspace) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const plan = await db.contentPlan.findFirst({
    where: { projectId },
    orderBy: { version: 'desc' },
    include: { stories: { orderBy: { storyId: 'asc' } } },
  });

  return NextResponse.json({ plan });
}

// POST: Generate content plan
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
  const assets = await db.rightsAsset.findMany({ where: { projectId } });
  const clients = await getAIClients(workspaceId);
  const knowledgeCtx = await getKnowledgeContext(workspaceId, `${bp.sponsorName} ${bp.rightsHolder} content plan stories`);

  const systemPrompt = `You are the 8pod Content Plan Generator — a system that creates production instruction sets from validated blueprints.

You must generate Story Units following these GOVERNING RULES:
1. VALIDATION GATE: All validation checkpoints must be PASS (assumed true).
2. FUNNEL COMPLETENESS: Every semantic audience MUST have at minimum one Story Unit at each of the 4 funnel stages (Inspiration, Aspiration, Immersion, Conversion).
3. PROVENANCE RATIO: Generative Story Units must not exceed 80% of total plan.
4. PRE-CONTENT PLAN: This is a complete draft before production begins.
5. SINGLE AUDIENCE: One Story Unit = one semantic audience at one funnel stage. No multi-audience units.
6. AUTHORISED ROUTES ONLY: Production routes limited to: Legacy, Newsroom, Capture, Generative.
7. TAXONOMY GOVERNANCE: All enumerated fields use closed, versioned taxonomies.

Atlas 8 Story Types (closed taxonomy — use ONLY these):
${ATLAS_8_STORY_TYPES.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Value Frames: ${VALUE_FRAMES.join(', ')}
Tone Bands: ${TONE_BANDS.join(', ')}
Funnel Stages: ${FUNNEL_STAGES.join(', ')}
Production Routes: ${PRODUCTION_ROUTES.join(', ')}

For each Story Unit, generate ALL these fields:
- storyId (format: SP-001, SP-002, etc.)
- sprint (Sprint 1 or Sprint 2)
- rightsPackage (from blueprint)
- targetAudienceId (AUD-01, AUD-02, etc.)
- audienceLabel (human-readable)
- funnelStage (one of 4 stages)
- estimatedReach (numeric)
- storyTheme (narrative territory)
- atlasStoryType (one of Atlas 8)
- storyTreatment (Profile/Moment/Explainer/Cultural/Competitive)
- valueFrame (one of 4)
- toneBand (one of 4)
- journalisticAvatar (e.g., JA-1 Authoritative Voice)
- talentSignal (true/false)
- sponsorPresence (true/false)
- sponsorRatio (e.g., "90:10" for Inspiration, "30:70" for mid-funnel, "10:90" for Conversion)
- productionRoute (one of 4)
- sourceStream (RH Archive / Curation / Original Shoot / AI-Generated)
- generativeSourceType (asset_id / blueprint_insight / performance_signal — only if Generative)
- humanGateRequired (true for Capture and Generative)
- primaryFormat (Video / Editorial / Interactive / Photo)
- formatVariantsRequired (1-4)
- thumbStopperType (e.g., TS-1 Curiosity Gap, TS-2 Tribal Signal, TS-3 Shock Stat)
- publisherId (e.g., PUB-MailOnline-001 or CLU-PremiumSports-UK)
- storyTarget (1-4)
- funnelBlockAssignment (e.g., Block 1 - Inspiration Open, Block 3 - Aspiration Sponsor)
- sequencePriority (1-10)
- evergreenFlag (Evergreen / Seasonal / Event-triggered)

Generate 15-20 Story Units ensuring complete funnel coverage for at least 4 audiences.
Return ONLY a JSON array, no other text.`;

  const userPrompt = `Blueprint:
Sponsor: ${bp.sponsorName}
Rights Holder: ${bp.rightsHolder}
Market: ${bp.market}
Audience Profile: ${bp.audienceProfile}
Rights Package: ${(bp.rightsPackage || []).join(', ')}
Objectives: ${(bp.objectives || []).join(', ')}

Available Assets (${assets.length}):
${assets.slice(0, 10).map(a => `- [${a.assetType}] ${a.title} (${a.funnelState}, ${a.format})`).join('\n')}

${knowledgeCtx ? `Workspace context:\n${knowledgeCtx.slice(0, 1500)}` : ''}

Generate the Content Plan Story Units as JSON array.`;

  let storiesData: any[] = [];

  try {
    if (clients.claude) {
      const res = await clients.claude.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const text = (res.content[0] as any).text;
      const match = text.match(/\[[\s\S]*\]/);
      if (match) storiesData = JSON.parse(match[0]);
    } else if (clients.openai) {
      const res = await clients.openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 4000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });
      const text = res.choices[0]?.message?.content || '';
      const match = text.match(/\[[\s\S]*\]/);
      if (match) storiesData = JSON.parse(match[0]);
    } else {
      // Fallback: generate programmatically
      storiesData = generateFallbackStories(bp);
    }
  } catch (e) {
    storiesData = generateFallbackStories(bp);
  }

  // Validate provenance ratio (Rule 3)
  const genCount = storiesData.filter(s => s.productionRoute === 'Generative').length;
  if (storiesData.length > 0 && (genCount / storiesData.length) > 0.8) {
    // Rebalance by converting some Generative to other routes
    let excess = genCount - Math.floor(storiesData.length * 0.8);
    for (const story of storiesData) {
      if (excess <= 0) break;
      if (story.productionRoute === 'Generative') {
        story.productionRoute = 'Newsroom';
        story.sourceStream = 'Curation';
        excess--;
      }
    }
  }

  // Create content plan
  const plan = await db.contentPlan.create({
    data: {
      projectId,
      blueprintId: `BPR-${project.id.slice(0, 8)}`,
      version: 1,
      taxonomyVersion: 'v1.1',
      status: 'DRAFT',
    },
  });

  // Save story units
  for (const story of storiesData) {
    await db.storyUnit.create({
      data: {
        contentPlanId: plan.id,
        storyId: story.storyId || `SP-${String(storiesData.indexOf(story) + 1).padStart(3, '0')}`,
        sprint: story.sprint || 'Sprint 1',
        rightsPackage: story.rightsPackage || `${bp.rightsHolder} ${bp.market}`,
        contentPlanVersion: 'v1',
        blueprintId: `BPR-${project.id.slice(0, 8)}`,
        targetAudienceId: story.targetAudienceId || `AUD-${String(storiesData.indexOf(story) % 5 + 1).padStart(2, '0')}`,
        audienceLabel: story.audienceLabel || 'General Audience',
        funnelStage: story.funnelStage || 'Inspiration',
        estimatedReach: story.estimatedReach || 100000,
        storyTheme: story.storyTheme || 'General',
        atlasStoryType: story.atlasStoryType || ATLAS_8_STORY_TYPES[0],
        storyTreatment: story.storyTreatment || 'Profile',
        valueFrame: story.valueFrame || VALUE_FRAMES[0],
        toneBand: story.toneBand || TONE_BANDS[0],
        journalisticAvatar: story.journalisticAvatar || 'JA-1 Authoritative Voice',
        talentSignal: story.talentSignal || false,
        sponsorPresence: story.sponsorPresence || false,
        sponsorRatio: story.sponsorRatio || null,
        productionRoute: story.productionRoute || 'Newsroom',
        sourceStream: story.sourceStream || 'Curation',
        generativeSource: story.generativeSource || null,
        generativeSourceType: story.generativeSourceType || null,
        humanGateRequired: story.humanGateRequired ?? true,
        primaryFormat: story.primaryFormat || 'Editorial',
        formatVariantsRequired: story.formatVariantsRequired || 1,
        thumbStopperType: story.thumbStopperType || 'TS-1 Curiosity Gap',
        publisherId: story.publisherId || null,
        publisherClusterId: story.publisherClusterId || null,
        storyTarget: story.storyTarget || 1,
        funnelBlockAssignment: story.funnelBlockAssignment || '',
        sequencePriority: story.sequencePriority || 1,
        evergreenFlag: story.evergreenFlag || 'Evergreen',
        status: 'Planned',
      },
    });
  }

  // Update project status
  await db.forecastProject.update({
    where: { id: projectId },
    data: { status: 'content-plan' },
  });

  return NextResponse.json({ success: true, planId: plan.id });
}

function generateFallbackStories(bp: any): any[] {
  const audiences = ['Young Sports Fans 18-24', 'Aspirational Female Fitness 25-34', 'Family Sports Viewers 35-50', 'Premium Cord-Cutters 25-44'];
  const stories: any[] = [];
  let idx = 1;

  for (const aud of audiences) {
    for (const stage of FUNNEL_STAGES) {
      const storyCount = stage === 'Inspiration' ? 2 : 1;
      for (let i = 0; i < storyCount; i++) {
        const route = PRODUCTION_ROUTES[idx % 4];
        stories.push({
          storyId: `SP-${String(idx).padStart(3, '0')}`,
          sprint: idx <= 10 ? 'Sprint 1' : 'Sprint 2',
          rightsPackage: `${bp.rightsHolder || 'Rights'} ${bp.market || 'UK'}`,
          targetAudienceId: `AUD-${String(audiences.indexOf(aud) + 1).padStart(2, '0')}`,
          audienceLabel: aud,
          funnelStage: stage,
          estimatedReach: 100000 + (idx * 50000),
          storyTheme: `${bp.rightsHolder || 'Sports'} ${stage} Story ${i + 1}`,
          atlasStoryType: ATLAS_8_STORY_TYPES[idx % 8],
          storyTreatment: ['Profile', 'Moment', 'Explainer', 'Cultural'][idx % 4],
          valueFrame: VALUE_FRAMES[idx % 4],
          toneBand: TONE_BANDS[idx % 4],
          journalisticAvatar: `JA-${(idx % 4) + 1} ${TONE_BANDS[idx % 4]} Voice`,
          talentSignal: route === 'Capture',
          sponsorPresence: stage !== 'Inspiration' || idx % 3 === 0,
          sponsorRatio: stage === 'Inspiration' ? '90:10' : stage === 'Conversion' ? '10:90' : '30:70',
          productionRoute: route,
          sourceStream: route === 'Legacy' ? 'RH Archive' : route === 'Newsroom' ? 'Curation' : route === 'Capture' ? 'Original Shoot' : 'AI-Generated',
          generativeSourceType: route === 'Generative' ? 'blueprint_insight' : null,
          humanGateRequired: route === 'Capture' || route === 'Generative',
          primaryFormat: ['Video', 'Editorial', 'Interactive', 'Photo'][idx % 4],
          formatVariantsRequired: stage === 'Conversion' ? 3 : 1,
          thumbStopperType: [`TS-1 Curiosity Gap`, `TS-2 Tribal Signal`, `TS-3 Shock Stat`, `TS-4 Celebrity Hook`][idx % 4],
          publisherId: `PUB-${['MailOnline', 'SkySports', 'BBC', 'Guardian'][idx % 4]}-001`,
          storyTarget: stage === 'Inspiration' ? 3 : 2,
          funnelBlockAssignment: `Block ${FUNNEL_STAGES.indexOf(stage) + 1} — ${stage}`,
          sequencePriority: FUNNEL_STAGES.indexOf(stage) + 1,
          evergreenFlag: stage === 'Inspiration' ? 'Evergreen' : idx % 3 === 0 ? 'Event-triggered' : 'Seasonal',
        });
        idx++;
      }
    }
  }
  return stories;
}
