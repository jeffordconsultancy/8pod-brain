import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAIClients } from '@/lib/ai';
import { getKnowledgeContext } from '@/lib/knowledge-context';

const VALIDATION_CHECKS = [
  {
    checkName: 'Singular Conversion Goal',
    checkOrder: 1,
    requirementText: 'A single North Star CTA must be defined. This is the one action the entire content plan optimises towards.',
  },
  {
    checkName: 'Validated Semantic Audience Set',
    checkOrder: 2,
    requirementText: 'Minimum 3, typical 5-8 semantic audiences must be validated from the blueprint. No new audiences permitted beyond the validated set.',
  },
  {
    checkName: 'Funnel Coverage Map',
    checkOrder: 3,
    requirementText: 'Each audience must have at minimum one Story Unit at each of the four funnel stages: Inspiration, Aspiration, Immersion, Conversion.',
  },
  {
    checkName: 'Story Inventory Estimate',
    checkOrder: 4,
    requirementText: 'Required story count per audience × funnel stage cell must be estimated. Typical 2-4 stories per cell.',
  },
  {
    checkName: 'Sponsor Eligibility & Ratio Constraints',
    checkOrder: 5,
    requirementText: 'Sponsor presence rules: Inspiration 90:10 content-to-sponsor, Mid-funnel 30:70, Conversion 10:90. Ratios must be enforceable.',
  },
  {
    checkName: 'Performance Baseline Expectations',
    checkOrder: 6,
    requirementText: 'Target baselines: 10% CTR, 3-minute dwell time, 6-click depth. These govern content plan optimisation targets.',
  },
  {
    checkName: 'Format Allowlist',
    checkOrder: 7,
    requirementText: 'Canonical formats approved for this rights package must be declared. No formats outside the allowlist may be used.',
  },
  {
    checkName: 'Journalistic Avatar Definitions',
    checkOrder: 8,
    requirementText: 'Voice governance for copy generation. Each avatar (e.g., Wry Observer, Cultural Translator) must be defined with tone and register.',
  },
  {
    checkName: 'Talent Shortlist',
    checkOrder: 9,
    requirementText: 'Talent options with credibility and reach scores. Talent assignments must reference this validated shortlist.',
  },
];

// GET: Load validator state
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId');
  const workspace = req.nextUrl.searchParams.get('workspace');
  if (!projectId || !workspace) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const assets = await db.rightsAsset.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  });

  const checkpoints = await db.validationCheckpoint.findMany({
    where: { projectId },
    orderBy: { checkOrder: 'asc' },
  });

  return NextResponse.json({ assets, checkpoints });
}

// POST: Generate simulated assets + checkpoints
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { projectId, workspaceId, action } = body;

  if (!projectId || !workspaceId) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const project = await db.forecastProject.findUnique({ where: { id: projectId } });
  if (!project || !project.blueprint) {
    return NextResponse.json({ error: 'Project or blueprint not found' }, { status: 404 });
  }

  const bp = project.blueprint as any;

  if (action === 'generate-assets') {
    // Generate simulated rights assets from blueprint
    const clients = await getAIClients(workspaceId);
    const knowledgeCtx = await getKnowledgeContext(workspaceId, `${bp.sponsorName} ${bp.rightsHolder} ${bp.market} rights assets`);

    const systemPrompt = `You are the 8pod Validator asset engine. Given a rights package blueprint, generate a realistic set of 12-18 simulated rights assets that would be available for content creation.

Each asset should have:
- assetType: one of "legacy_archive", "rights_holder", "newsroom_curation"
- title: specific, realistic asset name
- description: 1-2 sentence description
- audienceAffinity: which audience segment this appeals to
- funnelState: one of "inspiration", "aspiration", "immersion", "conversion"
- format: content format (e.g., "Video", "Photo Gallery", "Interview Transcript", "Data Set", "Editorial Archive")

Distribute assets across:
- At least 4 legacy_archive (historical content from the rights holder)
- At least 4 rights_holder (current season/partnership content)
- At least 4 newsroom_curation (editorial and curation opportunities)
- Cover all 4 funnel stages
- Cover multiple audience segments from the blueprint

Return ONLY a JSON array of assets, no other text.`;

    const userPrompt = `Blueprint:
Sponsor: ${bp.sponsorName}
Rights Holder: ${bp.rightsHolder}
Market: ${bp.market}
Audience: ${bp.audienceProfile}
Rights Package: ${(bp.rightsPackage || []).join(', ')}
Objectives: ${(bp.objectives || []).join(', ')}

${knowledgeCtx ? `Workspace context:\n${knowledgeCtx.slice(0, 2000)}` : ''}

Generate the simulated rights assets as JSON array.`;

    let assetsData: any[] = [];

    try {
      if (clients.claude) {
        const res = await clients.claude.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 3000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });
        const text = (res.content[0] as any).text;
        const match = text.match(/\[[\s\S]*\]/);
        if (match) assetsData = JSON.parse(match[0]);
      } else if (clients.openai) {
        const res = await clients.openai.chat.completions.create({
          model: 'gpt-4o',
          max_tokens: 3000,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        });
        const text = res.choices[0]?.message?.content || '';
        const match = text.match(/\[[\s\S]*\]/);
        if (match) assetsData = JSON.parse(match[0]);
      }
    } catch (e) {
      console.log('AI asset generation failed, using fallback:', (e as any)?.message);
    }

    // Fallback if AI didn't produce assets
    if (assetsData.length === 0) {
      assetsData = generateFallbackAssets(bp);
    }

    // Save assets
    for (const asset of assetsData) {
      await db.rightsAsset.create({
        data: {
          projectId,
          assetType: asset.assetType || 'legacy_archive',
          title: asset.title || 'Untitled Asset',
          description: asset.description || '',
          audienceAffinity: asset.audienceAffinity || '',
          funnelState: asset.funnelState || 'inspiration',
          format: asset.format || 'Mixed',
        },
      });
    }

    // Create validation checkpoints
    for (const check of VALIDATION_CHECKS) {
      await db.validationCheckpoint.create({
        data: {
          projectId,
          ...check,
          evidence: generateCheckpointEvidence(check.checkName, bp, assetsData),
        },
      });
    }

    // Update project status
    await db.forecastProject.update({
      where: { id: projectId },
      data: { status: 'validating' },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

// PATCH: Update checkpoint status (single or bulk)
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { checkpointId, status, action, projectId } = body;

  // Bulk pass all checkpoints for a project
  if (action === 'pass-all' && projectId) {
    await db.validationCheckpoint.updateMany({
      where: { projectId },
      data: {
        status: 'PASS',
        passedAt: new Date(),
      },
    });
    return NextResponse.json({ success: true });
  }

  if (!checkpointId || !status) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  await db.validationCheckpoint.update({
    where: { id: checkpointId },
    data: {
      status,
      passedAt: status === 'PASS' ? new Date() : null,
    },
  });

  return NextResponse.json({ success: true });
}

function generateFallbackAssets(bp: any): any[] {
  const types = ['legacy_archive', 'rights_holder', 'newsroom_curation'];
  const funnels = ['inspiration', 'aspiration', 'immersion', 'conversion'];
  const formats = ['Video', 'Photo Gallery', 'Interview Transcript', 'Data Set', 'Editorial'];
  const assets = [];
  for (let i = 0; i < 15; i++) {
    assets.push({
      assetType: types[i % 3],
      title: `${bp.rightsHolder || 'Rights'} Asset ${i + 1}`,
      description: `Simulated ${types[i % 3].replace('_', ' ')} asset for ${bp.sponsorName || 'sponsor'} campaign.`,
      audienceAffinity: `Audience Segment ${(i % 5) + 1}`,
      funnelState: funnels[i % 4],
      format: formats[i % 5],
    });
  }
  return assets;
}

function generateCheckpointEvidence(checkName: string, bp: any, assets: any[]): string {
  const evidenceMap: Record<string, string> = {
    'Singular Conversion Goal': `Blueprint objectives include: ${(bp.objectives || []).slice(0, 3).join(', ')}. A singular North Star CTA should be derived from the primary objective.`,
    'Validated Semantic Audience Set': `Blueprint audience profile: "${bp.audienceProfile || 'Not specified'}". Assets cover ${new Set(assets.map((a: any) => a.audienceAffinity)).size} distinct audience segments.`,
    'Funnel Coverage Map': `Assets distributed across ${new Set(assets.map((a: any) => a.funnelState)).size} of 4 funnel stages. Full coverage requires assets at each stage for each audience.`,
    'Story Inventory Estimate': `Based on ${assets.length} available assets and the audience set, typical story inventory is 2-4 per audience × funnel cell.`,
    'Sponsor Eligibility & Ratio Constraints': `Sponsor ${bp.sponsorName} with rights holder ${bp.rightsHolder}. Ratio compliance: Inspiration 90:10, Mid-funnel 30:70, Conversion 10:90.`,
    'Performance Baseline Expectations': 'Industry baselines applied: 10% CTR target, 3-minute dwell time, 6-click depth. Calibrated to market and audience profile.',
    'Format Allowlist': `Available formats from assets: ${[...new Set(assets.map((a: any) => a.format))].join(', ')}. All must be declared on the canonical allowlist.`,
    'Journalistic Avatar Definitions': 'Avatar voice governance required for all copy generation. Standard set: Authoritative, Empathetic, Wry Observer, Cultural Translator.',
    'Talent Shortlist': `Talent identification based on ${bp.rightsHolder} roster and campaign objectives. Credibility and reach scores to be assigned.`,
  };
  return evidenceMap[checkName] || 'Evidence pending analysis.';
}
