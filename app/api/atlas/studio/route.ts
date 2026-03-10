import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAIClients } from '@/lib/ai';
import { getKnowledgeContext } from '@/lib/knowledge-context';

// ─────────────────────────────────────────────────────────────
// GET: Load all content pieces for a project (with filtering)
// ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId');
  const workspace = req.nextUrl.searchParams.get('workspace');
  const status = req.nextUrl.searchParams.get('status');
  const assemblyMethod = req.nextUrl.searchParams.get('assemblyMethod');

  if (!projectId || !workspace) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const where: any = { projectId };
  if (status) where.status = status;
  if (assemblyMethod) where.assemblyMethod = assemblyMethod;

  const pieces = await db.contentPiece.findMany({
    where,
    include: { distributions: true },
    orderBy: { createdAt: 'desc' },
  });

  // Also load counts by status for the dashboard
  const counts = await db.contentPiece.groupBy({
    by: ['status'],
    where: { projectId },
    _count: { id: true },
  });

  const statusCounts: Record<string, number> = {};
  counts.forEach((c: any) => { statusCounts[c.status] = c._count.id; });

  return NextResponse.json({ pieces, statusCounts });
}

// ─────────────────────────────────────────────────────────────
// POST: Actions — generate content, update status, distribute
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, workspaceId, action } = body;

  if (!projectId || !workspaceId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  // ═══════════════════════════════════════════════════════════
  // ACTION: Generate content from approved production briefs
  // ═══════════════════════════════════════════════════════════
  if (action === 'generate-content') {
    const { briefIds, briefType } = body;

    const project = await db.forecastProject.findUnique({ where: { id: projectId } });
    if (!project || !project.blueprint) {
      return NextResponse.json({ error: 'Project or blueprint not found' }, { status: 404 });
    }

    const bp = project.blueprint as any;

    // Load briefs to generate from
    const briefWhere: any = { projectId };
    if (briefIds?.length) {
      briefWhere.id = { in: briefIds };
    } else if (briefType) {
      briefWhere.briefType = briefType;
      briefWhere.status = { in: ['APPROVED', 'IN_PRODUCTION'] };
    } else {
      // Default: all approved briefs that don't yet have content
      briefWhere.status = { in: ['APPROVED', 'IN_PRODUCTION'] };
    }

    const briefs = await db.productionBrief.findMany({
      where: briefWhere,
      orderBy: { createdAt: 'asc' },
    });

    if (briefs.length === 0) {
      return NextResponse.json({ error: 'No approved briefs found. Approve briefs in Pre-Production first.' }, { status: 400 });
    }

    // Check which briefs already have content pieces
    const existingPieces = await db.contentPiece.findMany({
      where: { projectId, briefId: { in: briefs.map((b: any) => b.id) } },
      select: { briefId: true },
    });
    const existingBriefIds = new Set(existingPieces.map((p: any) => p.briefId));
    const newBriefs = briefs.filter((b: any) => !existingBriefIds.has(b.id));

    if (newBriefs.length === 0) {
      return NextResponse.json({ error: 'Content already generated for all selected briefs.' }, { status: 400 });
    }

    // Load story units for context
    const contentPlan = await db.contentPlan.findFirst({
      where: { projectId },
      include: { stories: true },
      orderBy: { version: 'desc' },
    });

    const storyMap = new Map<string, any>();
    contentPlan?.stories.forEach((s: any) => { storyMap.set(s.id, s); });

    const clients = await getAIClients(workspaceId);
    const knowledgeCtx = await getKnowledgeContext(workspaceId, `${bp.sponsorName} ${bp.rightsHolder} content production`);

    console.log(`[Studio] Generating content for ${newBriefs.length} briefs`);

    const created: any[] = [];

    for (const brief of newBriefs) {
      const briefContent = brief.content as any;
      const storyUnit = brief.storyUnitId ? storyMap.get(brief.storyUnitId) : null;

      try {
        let contentBody = '';
        let headline = '';
        let summary = '';
        let qualityScore = 0;

        const briefContext = buildBriefContext(brief, briefContent, storyUnit, bp);

        if (clients.hasAI) {
          const systemPrompt = getContentGenerationPrompt(brief.briefType, bp);
          const userPrompt = `Generate a complete, publication-ready content piece from this production brief.

${briefContext}

${knowledgeCtx ? `\nWorkspace knowledge context:\n${knowledgeCtx}\n` : ''}

Return a JSON object with these fields:
{
  "headline": "The headline for this content piece",
  "bodyContent": "The full content body in markdown format. This should be a complete, ready-to-publish piece — not a template or outline.",
  "summary": "A 2-sentence editorial summary for review",
  "qualityScore": <number 0-100 based on adherence to brief requirements, tone consistency, sponsor compliance>
}`;

          let result: any = null;

          if (clients.claude) {
            try {
              const resp = await clients.claude.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4096,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }],
              });
              const text = resp.content[0].type === 'text' ? resp.content[0].text : '';
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (jsonMatch) result = JSON.parse(jsonMatch[0]);
            } catch (e) {
              console.log(`[Studio] Claude failed for brief ${brief.id}, trying OpenAI`);
            }
          }

          if (!result && clients.openai) {
            try {
              const resp = await clients.openai.chat.completions.create({
                model: 'gpt-4o',
                max_tokens: 4096,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userPrompt },
                ],
              });
              const text = resp.choices[0]?.message?.content || '';
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (jsonMatch) result = JSON.parse(jsonMatch[0]);
            } catch (e) {
              console.log(`[Studio] OpenAI failed for brief ${brief.id}, using fallback`);
            }
          }

          if (result) {
            headline = result.headline || briefContent.workingTitle || brief.title;
            contentBody = result.bodyContent || '';
            summary = result.summary || '';
            qualityScore = result.qualityScore || 70;
          }
        }

        // Fallback generator if AI failed or unavailable
        if (!contentBody) {
          const fallback = generateFallbackContent(brief, briefContent, storyUnit, bp);
          headline = fallback.headline;
          contentBody = fallback.bodyContent;
          summary = fallback.summary;
          qualityScore = fallback.qualityScore;
        }

        // Create the content piece
        const piece = await db.contentPiece.create({
          data: {
            projectId,
            briefId: brief.id,
            storyUnitId: brief.storyUnitId,
            headline,
            bodyContent: contentBody,
            summary,
            assemblyMethod: storyUnit?.assemblyMethod || (brief.briefType === 'NEWSROOM_BRIEF' ? 'Newsroom' : 'Generative'),
            assetSource: storyUnit?.assetSource,
            atlasStoryType: storyUnit?.atlasStoryType,
            funnelStage: storyUnit?.funnelStage,
            toneBand: storyUnit?.toneBand,
            valueFrame: storyUnit?.valueFrame,
            audienceLabel: storyUnit?.audienceLabel,
            format: storyUnit?.primaryFormat || 'article',
            sponsorRatio: storyUnit?.sponsorRatio,
            sponsorPresence: storyUnit?.sponsorPresence || false,
            qualityScore,
            status: 'DRAFT',
            generatedBy: clients.hasAI ? 'ai' : 'fallback',
          },
        });

        // Mark the brief as IN_PRODUCTION
        await db.productionBrief.update({
          where: { id: brief.id },
          data: { status: 'IN_PRODUCTION' },
        });

        created.push(piece);
        console.log(`[Studio] Created content piece ${piece.id} from brief ${brief.id}`);

      } catch (err) {
        console.error(`[Studio] Error generating content for brief ${brief.id}:`, err);
      }
    }

    // Update project status
    await db.forecastProject.update({
      where: { id: projectId },
      data: { status: 'studio' },
    });

    return NextResponse.json({
      success: true,
      count: created.length,
      pieces: created,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // ACTION: Update content piece (edit, add notes, change status)
  // ═══════════════════════════════════════════════════════════
  if (action === 'update-piece') {
    const { pieceId, updates } = body;

    if (!pieceId) {
      return NextResponse.json({ error: 'Missing pieceId' }, { status: 400 });
    }

    const allowedFields = [
      'headline', 'bodyContent', 'summary', 'editorialNotes',
      'status', 'assignedTo', 'reviewedBy', 'approvedBy',
      'format', 'qualityScore',
    ];

    const data: any = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        data[field] = updates[field];
      }
    }

    // Auto-set timestamps based on status changes
    if (updates.status === 'IN_REVIEW') {
      data.reviewedAt = null; // Clear previous review
    }
    if (updates.status === 'APPROVED') {
      data.approvedAt = new Date();
      if (updates.approvedBy) data.approvedBy = updates.approvedBy;
    }
    if (updates.status === 'REVISION_REQUESTED') {
      data.revisionCount = { increment: 1 };
    }

    const piece = await db.contentPiece.update({
      where: { id: pieceId },
      data,
    });

    return NextResponse.json({ success: true, piece });
  }

  // ═══════════════════════════════════════════════════════════
  // ACTION: Bulk update status (move multiple pieces through pipeline)
  // ═══════════════════════════════════════════════════════════
  if (action === 'bulk-status') {
    const { pieceIds, newStatus } = body;

    if (!pieceIds?.length || !newStatus) {
      return NextResponse.json({ error: 'Missing pieceIds or newStatus' }, { status: 400 });
    }

    const validStatuses = ['DRAFT', 'IN_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'READY_FOR_DISTRIBUTION', 'DISTRIBUTED', 'LIVE', 'ARCHIVED'];
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json({ error: `Invalid status: ${newStatus}` }, { status: 400 });
    }

    const data: any = { status: newStatus };
    if (newStatus === 'APPROVED') data.approvedAt = new Date();

    await db.contentPiece.updateMany({
      where: { id: { in: pieceIds }, projectId },
      data,
    });

    return NextResponse.json({ success: true, count: pieceIds.length });
  }

  // ═══════════════════════════════════════════════════════════
  // ACTION: Create distribution record (push to external tool)
  // ═══════════════════════════════════════════════════════════
  if (action === 'distribute') {
    const { pieceId, channel, destination, metadata } = body;

    if (!pieceId || !channel) {
      return NextResponse.json({ error: 'Missing pieceId or channel' }, { status: 400 });
    }

    // Verify the piece is approved or ready
    const piece = await db.contentPiece.findUnique({ where: { id: pieceId } });
    if (!piece) {
      return NextResponse.json({ error: 'Content piece not found' }, { status: 404 });
    }
    if (!['APPROVED', 'READY_FOR_DISTRIBUTION'].includes(piece.status)) {
      return NextResponse.json({ error: 'Content must be APPROVED before distribution' }, { status: 400 });
    }

    const record = await db.distributionRecord.create({
      data: {
        contentPieceId: pieceId,
        channel,
        destination,
        status: 'PENDING',
        metadata: metadata || {},
      },
    });

    // Update piece status
    await db.contentPiece.update({
      where: { id: pieceId },
      data: { status: 'READY_FOR_DISTRIBUTION' },
    });

    return NextResponse.json({ success: true, distribution: record });
  }

  // ═══════════════════════════════════════════════════════════
  // ACTION: Regenerate a single content piece with AI
  // ═══════════════════════════════════════════════════════════
  if (action === 'regenerate') {
    const { pieceId, editorialDirection } = body;

    if (!pieceId) {
      return NextResponse.json({ error: 'Missing pieceId' }, { status: 400 });
    }

    const piece = await db.contentPiece.findUnique({ where: { id: pieceId } });
    if (!piece) {
      return NextResponse.json({ error: 'Content piece not found' }, { status: 404 });
    }

    // Load the originating brief
    const brief = piece.briefId
      ? await db.productionBrief.findUnique({ where: { id: piece.briefId } })
      : null;

    const project = await db.forecastProject.findUnique({ where: { id: projectId } });
    const bp = (project?.blueprint as any) || {};
    const clients = await getAIClients(workspaceId);

    if (!clients.hasAI) {
      return NextResponse.json({ error: 'AI not available for regeneration' }, { status: 400 });
    }

    const systemPrompt = `You are the 8pod Content Studio. Regenerate this content piece based on editorial direction.

Rules:
- Maintain the same tone band: ${piece.toneBand || 'as specified in brief'}
- Maintain sponsor ratio: ${piece.sponsorRatio || 'as specified'}
- Follow the value frame: ${piece.valueFrame || 'as specified'}
- Target audience: ${piece.audienceLabel || 'as specified'}
- Funnel stage: ${piece.funnelStage || 'as specified'}
- Assembly method: ${piece.assemblyMethod || 'as specified'}

Return JSON: { "headline": "...", "bodyContent": "...", "summary": "...", "qualityScore": <0-100> }`;

    const userPrompt = `Regenerate this content piece.

Current headline: ${piece.headline}
Current content: ${piece.bodyContent.substring(0, 500)}...

${brief ? `Original brief: ${JSON.stringify(brief.content).substring(0, 1000)}` : ''}

${editorialDirection ? `Editorial direction from human reviewer:\n${editorialDirection}` : 'Improve quality and adherence to brief requirements.'}`;

    let result: any = null;

    if (clients.claude) {
      try {
        const resp = await clients.claude.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });
        const text = resp.content[0].type === 'text' ? resp.content[0].text : '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) result = JSON.parse(jsonMatch[0]);
      } catch (e) { /* fall through to openai */ }
    }

    if (!result && clients.openai) {
      try {
        const resp = await clients.openai.chat.completions.create({
          model: 'gpt-4o',
          max_tokens: 4096,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        });
        const text = resp.choices[0]?.message?.content || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) result = JSON.parse(jsonMatch[0]);
      } catch (e) { /* failed */ }
    }

    if (!result) {
      return NextResponse.json({ error: 'AI regeneration failed' }, { status: 500 });
    }

    const updated = await db.contentPiece.update({
      where: { id: pieceId },
      data: {
        headline: result.headline,
        bodyContent: result.bodyContent,
        summary: result.summary,
        qualityScore: result.qualityScore || 70,
        status: 'DRAFT',
        revisionCount: { increment: 1 },
        generatedBy: 'ai',
      },
    });

    return NextResponse.json({ success: true, piece: updated });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}

// ─────────────────────────────────────────────────────────────
// PATCH: Quick inline edit of a content piece
// ─────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { pieceId, headline, bodyContent, editorialNotes, status } = body;

  if (!pieceId) {
    return NextResponse.json({ error: 'Missing pieceId' }, { status: 400 });
  }

  const data: any = {};
  if (headline !== undefined) data.headline = headline;
  if (bodyContent !== undefined) data.bodyContent = bodyContent;
  if (editorialNotes !== undefined) data.editorialNotes = editorialNotes;
  if (status !== undefined) {
    data.status = status;
    if (status === 'APPROVED') data.approvedAt = new Date();
  }

  const piece = await db.contentPiece.update({
    where: { id: pieceId },
    data,
  });

  return NextResponse.json({ success: true, piece });
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function buildBriefContext(brief: any, briefContent: any, storyUnit: any, bp: any): string {
  const lines: string[] = [];
  lines.push(`Brief Type: ${brief.briefType}`);
  lines.push(`Title: ${brief.title}`);
  lines.push(`Rights Holder: ${bp.rightsHolder || 'Unknown'}`);
  lines.push(`Sponsor: ${bp.sponsorName || 'Unknown'}`);

  if (storyUnit) {
    lines.push(`\nStory Unit Context:`);
    lines.push(`  Audience: ${storyUnit.audienceLabel}`);
    lines.push(`  Funnel Stage: ${storyUnit.funnelStage}`);
    lines.push(`  Story Type: ${storyUnit.atlasStoryType}`);
    lines.push(`  Tone Band: ${storyUnit.toneBand}`);
    lines.push(`  Value Frame: ${storyUnit.valueFrame}`);
    lines.push(`  Assembly Method: ${storyUnit.assemblyMethod}`);
    lines.push(`  Format: ${storyUnit.primaryFormat}`);
    lines.push(`  Sponsor Ratio: ${storyUnit.sponsorRatio}`);
    if (storyUnit.journalisticAvatar) lines.push(`  Avatar: ${storyUnit.journalisticAvatar}`);
  }

  lines.push(`\nBrief Content:`);
  lines.push(JSON.stringify(briefContent, null, 2).substring(0, 3000));

  return lines.join('\n');
}

function getContentGenerationPrompt(briefType: string, bp: any): string {
  const base = `You are the 8pod Content Studio engine. You produce publication-ready content from structured production briefs.

The content must:
- Be complete and ready to publish — not an outline or template
- Follow the tone band specified in the brief exactly
- Respect the sponsor ratio (e.g. 90:10 means 90% editorial content, 10% sponsor-adjacent)
- Target the specified audience with appropriate language and references
- Align with the value frame and funnel stage
- Use the journalistic avatar's voice if specified
- Include natural headline hooks and thumb-stopper elements

Rights Holder: ${bp.rightsHolder || 'As specified'}
Sponsor: ${bp.sponsorName || 'As specified'}
Market: ${bp.market || 'As specified'}`;

  switch (briefType) {
    case 'NEWSROOM_BRIEF':
      return `${base}

This is a NEWSROOM piece — editorially-assembled from curated sources and captured assets.
Write as journalism: factual, narrative-driven, with editorial integrity.
The newsroom editorial team will review and refine this before publication.`;

    case 'GENERATIVE_BRIEF':
      return `${base}

This is a GENERATIVE piece — AI-assembled following strict format constraints.
Follow the narrative template exactly. Maintain brand safety.
Include variation hooks for A/B headline testing where appropriate.`;

    case 'CAPTURE_BRIEF':
      return `${base}

This content is based on an ORIGINAL CAPTURE brief (interview, documentary, on-location).
Write compelling narrative content that brings the captured story to life.
Include quotes (fictional but realistic), scene descriptions, and emotional arc.`;

    case 'SHOOTING_SCRIPT':
      return `${base}

This is derived from a SHOOTING SCRIPT — interview-based, narrative arc format.
Create article content from the interview structure: opening, tension/jeopardy, resolution.
Present as a written piece that captures the interview's narrative flow.`;

    default:
      return base;
  }
}

function generateFallbackContent(brief: any, briefContent: any, storyUnit: any, bp: any) {
  const audience = storyUnit?.audienceLabel || 'target audience';
  const funnelStage = storyUnit?.funnelStage || 'Inspiration';
  const toneBand = storyUnit?.toneBand || 'Authoritative';
  const storyType = storyUnit?.atlasStoryType || 'Features';
  const valueFrame = storyUnit?.valueFrame || 'Achievement';
  const sponsor = bp.sponsorName || 'the sponsor';
  const rightsHolder = bp.rightsHolder || 'the rights holder';
  const title = briefContent?.workingTitle || brief.title || 'Untitled Story';

  const toneGuide: Record<string, string> = {
    'Authoritative': 'with gravitas and expert insight',
    'Empathetic': 'with warmth and emotional connection',
    'Wry': 'with wit and cultural awareness',
    'Cultural Translator': 'bridging cultures and perspectives',
  };

  const funnelApproach: Record<string, string> = {
    'Inspiration': 'ignite curiosity and draw the audience into the world of',
    'Aspiration': 'build identity alignment between the audience and',
    'Immersion': 'create deep engagement and knowledge about',
    'Conversion': 'drive action and owned audience conversion for',
  };

  const headline = `${title}`;
  const bodyContent = `# ${title}

*A ${storyType.toLowerCase()} piece for ${audience}, written ${toneGuide[toneBand] || 'with editorial care'}.*

---

This story is designed to ${funnelApproach[funnelStage] || 'engage audiences with'} ${rightsHolder}. It lives within the **${valueFrame}** value frame, connecting ${audience} to the deeper narrative.

## The Story

${briefContent?.synopsis || briefContent?.storyObjective || `An exploration of ${rightsHolder} through the lens of ${storyType.toLowerCase()}, crafted for ${audience} at the ${funnelStage.toLowerCase()} stage of the content journey.`}

${briefContent?.editorialAngle ? `## Editorial Angle\n\n${briefContent.editorialAngle}\n` : ''}

${briefContent?.background ? `## Background\n\n${Array.isArray(briefContent.background) ? briefContent.background.join('\n\n') : briefContent.background}\n` : ''}

## For ${audience}

This piece speaks directly to ${audience}, leveraging ${valueFrame.toLowerCase()} as the primary emotional driver. The tone is ${toneBand.toLowerCase()} throughout, maintaining the journalistic avatar's authentic voice.

${storyUnit?.sponsorPresence ? `\n## Partnership Integration\n\n${sponsor} is woven into this narrative at a ${storyUnit?.sponsorRatio || '90:10'} ratio — the story leads, the brand follows naturally.\n` : ''}

---

*Format: ${storyUnit?.primaryFormat || 'article'} | Assembly: ${storyUnit?.assemblyMethod || brief.briefType} | ${funnelStage} stage content*`;

  const summary = `A ${storyType.toLowerCase()} piece targeting ${audience} at the ${funnelStage.toLowerCase()} stage, using a ${toneBand.toLowerCase()} tone within the ${valueFrame.toLowerCase()} value frame.`;

  return { headline, bodyContent, summary, qualityScore: 55 };
}
