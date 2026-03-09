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
const ASSEMBLY_METHODS = ['Newsroom', 'Generative'];
const ASSET_SOURCES = ['OriginalCapture', 'RightsHolderArchive', 'Curated', 'Sponsor', 'GenerativeAI'];

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

ARCHITECTURE MODEL — understand this before generating:
- CAPTURE is an upstream production STAGE that produces reusable ASSETS (video, photo), NOT a story assembly method.
- STORY ASSEMBLY is how finished Story Units are built. There are only 2 assembly methods: Newsroom and Generative.
- ASSET SOURCES describe where the assets come from: OriginalCapture, RightsHolderArchive, Curated, Sponsor, or GenerativeAI.
- A story may need original asset capture (captureRequired=true) but still be assembled via Newsroom or Generative methods.
- Key principle: Capture produces assets. Newsroom/Generative assemble stories.

You must generate Story Units following these GOVERNING RULES:
1. VALIDATION GATE: All validation checkpoints must be PASS (assumed true).
2. FUNNEL COMPLETENESS: Every semantic audience MUST have at minimum one Story Unit at each of the 4 funnel stages.
3. PROVENANCE RATIO: Generative-assembled Story Units must not exceed 80% of total plan.
4. PRE-CONTENT PLAN: This is a complete draft before production begins.
5. SINGLE AUDIENCE: One Story Unit = one semantic audience at one funnel stage.
6. ASSEMBLY METHODS: Only Newsroom or Generative. Capture is NOT an assembly method.
7. TAXONOMY GOVERNANCE: All enumerated fields use closed, versioned taxonomies.

Atlas 8 Story Types (closed taxonomy — use ONLY these):
${ATLAS_8_STORY_TYPES.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Value Frames: ${VALUE_FRAMES.join(', ')}
Tone Bands: ${TONE_BANDS.join(', ')}
Funnel Stages: ${FUNNEL_STAGES.join(', ')}
Assembly Methods: ${ASSEMBLY_METHODS.join(', ')}
Asset Sources: ${ASSET_SOURCES.join(', ')}

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
- assemblyMethod (Newsroom or Generative — how the story is ASSEMBLED)
- assetSource (OriginalCapture / RightsHolderArchive / Curated / Sponsor / GenerativeAI — where assets come FROM)
- captureRequired (true if the story needs original asset capture before assembly)
- generativeSourceType (asset_id / blueprint_insight / performance_signal — only if assemblyMethod is Generative)
- humanGateRequired (true for stories with captureRequired=true or assemblyMethod=Generative)
- primaryFormat (Video / Editorial / Interactive / Photo)
- formatVariantsRequired (1-4)
- thumbStopperType (e.g., TS-1 Curiosity Gap, TS-2 Tribal Signal, TS-3 Shock Stat)
- publisherId (e.g., PUB-MailOnline-001 or CLU-PremiumSports-UK)
- storyTarget (1-4)
- funnelBlockAssignment (e.g., Block 1 - Inspiration Open, Block 3 - Aspiration Sponsor)
- sequencePriority (1-10)
- evergreenFlag (Evergreen / Seasonal / Event-triggered)

Guidelines for assembly and asset decisions:
- Tentpole stories (behind-the-scenes, interviews, docu-style) typically need captureRequired=true with assemblyMethod=Newsroom
- Stories using legacy/archive footage use assetSource=RightsHolderArchive with captureRequired=false
- Curated editorial stories use assetSource=Curated with assemblyMethod=Newsroom
- AI-scaled stories use assemblyMethod=Generative with assetSource=GenerativeAI
- Aim for ~30-40% of stories to require original capture, ~20-30% from archives, remainder curated/generative

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
      console.log('[ContentPlan] Using Claude API...');
      const res = await clients.claude.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const text = (res.content[0] as any).text;
      console.log('[ContentPlan] Claude response length:', text?.length);
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        storiesData = JSON.parse(match[0]);
        console.log('[ContentPlan] Parsed', storiesData.length, 'stories from Claude');
      } else {
        console.log('[ContentPlan] Could not parse JSON array from Claude response, using fallback');
        storiesData = generateFallbackStories(bp);
      }
    } else if (clients.openai) {
      console.log('[ContentPlan] Using OpenAI API...');
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
      if (match) {
        storiesData = JSON.parse(match[0]);
        console.log('[ContentPlan] Parsed', storiesData.length, 'stories from OpenAI');
      } else {
        console.log('[ContentPlan] Could not parse JSON from OpenAI, using fallback');
        storiesData = generateFallbackStories(bp);
      }
    } else {
      console.log('[ContentPlan] No AI clients available, using fallback generator');
      storiesData = generateFallbackStories(bp);
    }
  } catch (e: any) {
    console.error('[ContentPlan] AI generation error:', e?.message || e);
    storiesData = generateFallbackStories(bp);
  }

  console.log('[ContentPlan] Total stories to save:', storiesData.length);

  // Validate provenance ratio (Rule 3): Generative assembly must not exceed 80%
  const genCount = storiesData.filter(s => s.assemblyMethod === 'Generative').length;
  if (storiesData.length > 0 && (genCount / storiesData.length) > 0.8) {
    let excess = genCount - Math.floor(storiesData.length * 0.8);
    for (const story of storiesData) {
      if (excess <= 0) break;
      if (story.assemblyMethod === 'Generative') {
        story.assemblyMethod = 'Newsroom';
        story.assetSource = 'Curated';
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
      taxonomyVersion: 'v1.2',
      status: 'DRAFT',
    },
  });

  // Save story units
  let savedCount = 0;
  for (let idx = 0; idx < storiesData.length; idx++) {
    const story = storiesData[idx];
    try {
      await db.storyUnit.create({
        data: {
          contentPlanId: plan.id,
          storyId: story.storyId || `SP-${String(idx + 1).padStart(3, '0')}`,
          sprint: story.sprint || 'Sprint 1',
          rightsPackage: story.rightsPackage || `${bp.rightsHolder} ${bp.market}`,
          contentPlanVersion: 'v1.2',
          blueprintId: `BPR-${project.id.slice(0, 8)}`,
          targetAudienceId: story.targetAudienceId || `AUD-${String(idx % 5 + 1).padStart(2, '0')}`,
          audienceLabel: story.audienceLabel || 'General Audience',
          funnelStage: story.funnelStage || 'Inspiration',
          estimatedReach: typeof story.estimatedReach === 'number' ? story.estimatedReach : 100000,
          storyTheme: story.storyTheme || 'General',
          atlasStoryType: story.atlasStoryType || ATLAS_8_STORY_TYPES[0],
          storyTreatment: story.storyTreatment || 'Profile',
          valueFrame: story.valueFrame || VALUE_FRAMES[0],
          toneBand: story.toneBand || TONE_BANDS[0],
          journalisticAvatar: story.journalisticAvatar || 'JA-1 Authoritative Voice',
          talentSignal: !!story.talentSignal,
          sponsorPresence: !!story.sponsorPresence,
          sponsorRatio: story.sponsorRatio || null,
          assemblyMethod: story.assemblyMethod || 'Newsroom',
          assetSource: story.assetSource || 'Curated',
          captureRequired: !!story.captureRequired,
          generativeSource: story.generativeSource || null,
          generativeSourceType: story.generativeSourceType || null,
          humanGateRequired: story.humanGateRequired ?? (story.captureRequired || story.assemblyMethod === 'Generative'),
          primaryFormat: story.primaryFormat || 'Editorial',
          formatVariantsRequired: typeof story.formatVariantsRequired === 'number' ? story.formatVariantsRequired : 1,
          thumbStopperType: story.thumbStopperType || 'TS-1 Curiosity Gap',
          publisherId: story.publisherId || null,
          publisherClusterId: story.publisherClusterId || null,
          storyTarget: typeof story.storyTarget === 'number' ? story.storyTarget : 1,
          funnelBlockAssignment: story.funnelBlockAssignment || '',
          sequencePriority: typeof story.sequencePriority === 'number' ? story.sequencePriority : 1,
          evergreenFlag: story.evergreenFlag || 'Evergreen',
          status: 'Planned',
        },
      });
      savedCount++;
    } catch (e: any) {
      console.error(`[ContentPlan] Failed to save story ${idx + 1}:`, e?.message || e);
    }
  }
  console.log(`[ContentPlan] Saved ${savedCount}/${storiesData.length} story units`);

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

  // Asset source / assembly patterns for variety
  const patterns = [
    { assemblyMethod: 'Newsroom', assetSource: 'OriginalCapture', captureRequired: true },    // tentpole capture stories
    { assemblyMethod: 'Newsroom', assetSource: 'RightsHolderArchive', captureRequired: false }, // legacy archive stories
    { assemblyMethod: 'Newsroom', assetSource: 'Curated', captureRequired: false },             // editorial curation
    { assemblyMethod: 'Generative', assetSource: 'GenerativeAI', captureRequired: false },      // AI-assembled
  ];

  for (const aud of audiences) {
    for (const stage of FUNNEL_STAGES) {
      const storyCount = stage === 'Inspiration' ? 2 : 1;
      for (let i = 0; i < storyCount; i++) {
        const pattern = patterns[idx % patterns.length];
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
          talentSignal: pattern.captureRequired,
          sponsorPresence: stage !== 'Inspiration' || idx % 3 === 0,
          sponsorRatio: stage === 'Inspiration' ? '90:10' : stage === 'Conversion' ? '10:90' : '30:70',
          assemblyMethod: pattern.assemblyMethod,
          assetSource: pattern.assetSource,
          captureRequired: pattern.captureRequired,
          generativeSourceType: pattern.assemblyMethod === 'Generative' ? 'blueprint_insight' : null,
          humanGateRequired: pattern.captureRequired || pattern.assemblyMethod === 'Generative',
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
