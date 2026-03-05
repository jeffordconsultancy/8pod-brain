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

  if (action === 'generate-panics') {
    // Generate PANIC documents for Capture-route story units
    const captureStories = stories.filter((s: any) => s.productionRoute === 'Capture' || s.productionRoute === 'Legacy');

    if (captureStories.length === 0) {
      return NextResponse.json({ error: 'No capture-route story units to generate PANICs for' }, { status: 400 });
    }

    const systemPrompt = `You are the 8pod Production Brief engine. Generate PANIC documents (Purpose, Access, Narrative, Integrity, Craft) for content production.

A PANIC document is a structured pre-production brief used to plan shoots and capture. It must include:

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

Generate briefs that are detailed and production-ready. Each brief should be specific to the story unit's theme, audience, and tone.

Return a JSON array of PANIC objects. Return ONLY valid JSON, no other text.`;

    const userPrompt = `Blueprint Context:
Sponsor: ${bp.sponsorName}
Rights Holder: ${bp.rightsHolder}
Market: ${bp.market}
Audience: ${bp.audienceProfile}

${knowledgeCtx ? `Workspace Knowledge:\n${knowledgeCtx.slice(0, 2000)}\n` : ''}

Generate PANIC documents for these ${captureStories.length} story units:
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
`).join('')}

Return a JSON array with one PANIC object per story unit.`;

    let panicsData: any[] = [];

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
        if (match) panicsData = JSON.parse(match[0]);
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
        if (match) panicsData = JSON.parse(match[0]);
      }
    } catch (e) {
      console.log('AI PANIC generation failed, using fallback:', (e as any)?.message);
    }

    // Fallback
    if (panicsData.length === 0) {
      panicsData = captureStories.map((s: any) => generateFallbackPanic(s, bp));
    }

    // Save PANIC briefs
    for (let i = 0; i < panicsData.length; i++) {
      const panic = panicsData[i];
      const storyUnit = captureStories[i];
      await db.productionBrief.create({
        data: {
          projectId,
          storyUnitId: storyUnit?.id,
          briefType: 'PANIC',
          title: panic.workingTitle || `PANIC — ${storyUnit?.storyTheme || 'Story'} ${i + 1}`,
          content: panic,
        },
      });
    }

    return NextResponse.json({ success: true, count: panicsData.length });
  }

  if (action === 'generate-wendys') {
    // Generate Wendy scripts for story units that have PANICs
    const existingPanics = await db.productionBrief.findMany({
      where: { projectId, briefType: 'PANIC' },
    });

    if (existingPanics.length === 0) {
      return NextResponse.json({ error: 'Generate PANICs first before creating Wendy scripts' }, { status: 400 });
    }

    const systemPrompt = `You are the 8pod Wendy Script engine. Generate Wendy interview/shooting scripts from PANIC documents.

A Wendy is a structured interview script that the Shooter takes on set. It follows this specific narrative structure:

1. openingStatement: A single statement with an element of surprise that hooks the audience. Written in the subject's voice.
2. supportingStatements: 3-4 statements giving context to the opening. What is the story about, why does the subject do what they do?
3. generalJeopardyStatement: A single relatable challenge statement — speaks to emotion, not a specific incident
4. specificJeopardyStatements: 3-4 statements turning the general jeopardy into specific story details
5. generalHappyEndingStatement: A single positive outcome statement — relatable emotion about overcoming the challenge
6. specificHappyEndingStatements: 3-4 statements with specific uplifting conclusions. Must include at least one statement that speaks to the regional narrative.
7. questions: 8-10 emotive interview questions that speak back to the statements and cover the main story elements

The statements should be written in the subject's voice — as if they are speaking. Consider the subject's age, personality, and language.

Return a JSON array of Wendy objects. Return ONLY valid JSON, no other text.`;

    const userPrompt = `Blueprint Context:
Sponsor: ${bp.sponsorName}
Rights Holder: ${bp.rightsHolder}
Market: ${bp.market}

Generate Wendy scripts for these ${existingPanics.length} PANIC briefs:
${existingPanics.map((panic: any, i: number) => {
  const content = panic.content as any;
  return `
${i + 1}. Title: ${panic.title}
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

Return a JSON array with one Wendy object per PANIC brief.`;

    let wendysData: any[] = [];

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
        if (match) wendysData = JSON.parse(match[0]);
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
        if (match) wendysData = JSON.parse(match[0]);
      }
    } catch (e) {
      console.log('AI Wendy generation failed, using fallback:', (e as any)?.message);
    }

    // Fallback
    if (wendysData.length === 0) {
      wendysData = existingPanics.map((panic: any) => generateFallbackWendy(panic));
    }

    // Save Wendy briefs
    for (let i = 0; i < wendysData.length; i++) {
      const wendy = wendysData[i];
      const panic = existingPanics[i];
      await db.productionBrief.create({
        data: {
          projectId,
          storyUnitId: (panic as any).storyUnitId,
          briefType: 'WENDY',
          title: `Wendy — ${panic.title.replace('PANIC — ', '')}`,
          content: wendy,
        },
      });
    }

    return NextResponse.json({ success: true, count: wendysData.length });
  }

  if (action === 'generate-newsroom-briefs') {
    const newsroomStories = stories.filter((s: any) => s.productionRoute === 'Newsroom');

    if (newsroomStories.length === 0) {
      return NextResponse.json({ error: 'No newsroom-route story units' }, { status: 400 });
    }

    const systemPrompt = `You are the 8pod Newsroom Brief engine. Generate editorial curation briefs for newsroom-route story units.

A Newsroom Brief must include:
1. headline: Working editorial headline
2. editorialAngle: The specific curation angle
3. sourceConstraints: What sources can/should be used
4. curationParameters: Key themes, entities, and topics to curate around
5. avatarVoice: The journalistic avatar's tone and register for this piece
6. audienceContext: Who this is for and why they care
7. formatSpec: Format requirements (long-form, short-form, interactive, etc.)
8. sponsorIntegration: How sponsor presence should be handled (ratio, placement)
9. deadline: Suggested production timeline
10. qualityGates: Editorial standards that must be met before publication

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
      console.log('AI Newsroom brief generation failed:', (e as any)?.message);
    }

    if (briefsData.length === 0) {
      briefsData = newsroomStories.map((s: any) => ({
        headline: `${s.storyTheme} — Editorial Brief`,
        editorialAngle: `${s.atlasStoryType} perspective on ${s.storyTheme}`,
        sourceConstraints: 'Verified sources only. Cross-reference with rights holder archive.',
        curationParameters: `Theme: ${s.storyTheme}. Value Frame: ${s.valueFrame}. Audience: ${s.audienceLabel}.`,
        avatarVoice: `${s.journalisticAvatar} — ${s.toneBand} register`,
        audienceContext: `${s.audienceLabel} audience at ${s.funnelStage} stage`,
        formatSpec: s.primaryFormat || 'Editorial',
        sponsorIntegration: s.sponsorPresence ? `Sponsor ratio: ${s.sponsorRatio}` : 'No sponsor presence',
        deadline: 'Per sprint cadence',
        qualityGates: 'Fact-check, editorial review, avatar voice compliance, brand safety check',
      }));
    }

    for (let i = 0; i < briefsData.length; i++) {
      const brief = briefsData[i];
      const storyUnit = newsroomStories[i];
      await db.productionBrief.create({
        data: {
          projectId,
          storyUnitId: storyUnit?.id,
          briefType: 'NEWSROOM_BRIEF',
          title: brief.headline || `Newsroom Brief ${i + 1}`,
          content: brief,
        },
      });
    }

    return NextResponse.json({ success: true, count: briefsData.length });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
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

function generateFallbackPanic(story: any, bp: any): any {
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
  };
}

function generateFallbackWendy(panic: any): any {
  const content = panic.content as any;
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
