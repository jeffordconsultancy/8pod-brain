'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PhaseIndicator from '@/components/ui/PhaseIndicator';

interface StoryUnit {
  id: string;
  storyId: string;
  sprint: string;
  rightsPackage: string;
  targetAudienceId: string;
  audienceLabel: string;
  funnelStage: string;
  estimatedReach: number;
  storyTheme: string;
  atlasStoryType: string;
  storyTreatment: string;
  valueFrame: string;
  toneBand: string;
  journalisticAvatar: string;
  talentSignal: boolean;
  sponsorPresence: boolean;
  sponsorRatio: string;
  productionRoute: string;
  sourceStream: string;
  generativeSourceType: string;
  humanGateRequired: boolean;
  primaryFormat: string;
  formatVariantsRequired: number;
  thumbStopperType: string;
  publisherId: string;
  storyTarget: number;
  funnelBlockAssignment: string;
  sequencePriority: number;
  evergreenFlag: string;
  status: string;
  gapFlag: boolean;
}

interface ContentPlanData {
  id: string;
  version: number;
  taxonomyVersion: string;
  status: string;
  stories: StoryUnit[];
}

const FUNNEL_STAGES = ['Inspiration', 'Aspiration', 'Immersion', 'Conversion'];
const FUNNEL_COLORS: Record<string, string> = {
  Inspiration: 'bg-sky-400/10 text-sky-400 border-sky-400/20',
  Aspiration: 'bg-violet-400/10 text-violet-400 border-violet-400/20',
  Immersion: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  Conversion: 'bg-green-400/10 text-green-400 border-green-400/20',
};
const ROUTE_COLORS: Record<string, string> = {
  Legacy: 'text-amber-400',
  Newsroom: 'text-blue-400',
  Capture: 'text-purple-400',
  Generative: 'text-cyan-400',
};

export default function ContentPlanPage() {
  const { data: session, status: authStatus } = useSession();
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const workspaceId = (session as any)?.workspaceId;

  const [project, setProject] = useState<any>(null);
  const [plan, setPlan] = useState<ContentPlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [expandedStory, setExpandedStory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stories' | 'coverage' | 'outputs'>('stories');

  useEffect(() => {
    if (authStatus === 'authenticated' && workspaceId) {
      loadData();
    }
  }, [authStatus, workspaceId, projectId]);

  async function loadData() {
    try {
      const pRes = await fetch(`/api/forecaster/projects/${projectId}?workspace=${workspaceId}`);
      const pData = await pRes.json();
      setProject(pData.project);

      const cpRes = await fetch(`/api/atlas/content-plan?projectId=${projectId}&workspace=${workspaceId}`);
      if (cpRes.ok) {
        const cpData = await cpRes.json();
        setPlan(cpData.plan);
      }
    } catch {
      setError('Failed to load content plan');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/atlas/content-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, workspaceId }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Failed to generate content plan');
        return;
      }
      await loadData();
    } catch {
      setError('Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  if (authStatus === 'loading' || loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-text-muted font-mono text-sm">Loading Content Plan...</p></div>;
  }

  const stories = plan?.stories || [];
  const audiences = [...new Set(stories.map(s => s.audienceLabel))];

  // Coverage matrix data
  const coverageMatrix = audiences.map(aud => {
    const row: Record<string, number> = { audience: 0 };
    FUNNEL_STAGES.forEach(stage => {
      row[stage] = stories.filter(s => s.audienceLabel === aud && s.funnelStage === stage).length;
    });
    return { audience: aud, ...row };
  });

  // Stats
  const totalStories = stories.length;
  const generativeCount = stories.filter(s => s.productionRoute === 'Generative').length;
  const generativeRatio = totalStories > 0 ? ((generativeCount / totalStories) * 100).toFixed(0) : '0';
  const sponsoredCount = stories.filter(s => s.sponsorPresence).length;

  const phases = [
    { id: 'forecast', label: 'Forecast', status: 'complete' as const },
    { id: 'validate', label: 'Validate', status: 'complete' as const },
    { id: 'content-plan', label: 'Content Plan', status: 'active' as const },
    { id: 'pre-production', label: 'Pre-Production', status: 'locked' as const },
    { id: 'production', label: 'Production', status: 'locked' as const },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">Content Plan</h1>
          <p className="text-text-secondary text-sm">
            Production instruction set derived from the validated blueprint. Schema v{plan?.taxonomyVersion || '1.1'}.
          </p>
        </div>
        <button onClick={() => router.push(`/atlas/forecaster/${projectId}`)} className="text-text-muted hover:text-text-primary text-sm transition font-mono">
          ← Back to Forecast
        </button>
      </div>

      <PhaseIndicator phases={phases} />

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {!plan && (
        <div className="console-card p-12 text-center">
          <div className="text-4xl text-text-dim mb-4">◈</div>
          <h3 className="text-text-primary font-bold text-lg mb-2">Ready to Generate Content Plan</h3>
          <p className="text-text-muted text-sm mb-6 max-w-md mx-auto">
            The validator has confirmed all gates. Generate the Content Plan to create Story Units across all audiences and funnel stages.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-8 py-4 bg-accent-teal/20 text-accent-teal font-medium rounded-xl hover:bg-accent-teal/30 border border-accent-teal/30 transition disabled:opacity-50 text-lg"
          >
            {generating ? 'Generating Story Units...' : 'Generate Content Plan'}
          </button>
        </div>
      )}

      {plan && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-5 gap-3">
            <div className="console-card p-4 text-center">
              <span className="text-2xl font-bold text-accent-teal">{totalStories}</span>
              <p className="text-xs font-mono text-text-dim mt-1">Story Units</p>
            </div>
            <div className="console-card p-4 text-center">
              <span className="text-2xl font-bold text-text-primary">{audiences.length}</span>
              <p className="text-xs font-mono text-text-dim mt-1">Audiences</p>
            </div>
            <div className="console-card p-4 text-center">
              <span className={`text-2xl font-bold ${parseInt(generativeRatio) > 80 ? 'text-red-400' : 'text-text-primary'}`}>
                {generativeRatio}%
              </span>
              <p className="text-xs font-mono text-text-dim mt-1">Generative Ratio</p>
            </div>
            <div className="console-card p-4 text-center">
              <span className="text-2xl font-bold text-text-primary">{sponsoredCount}</span>
              <p className="text-xs font-mono text-text-dim mt-1">Sponsored</p>
            </div>
            <div className="console-card p-4 text-center">
              <span className="text-2xl font-bold text-accent-teal">v{plan.version}</span>
              <p className="text-xs font-mono text-text-dim mt-1">Plan Version</p>
            </div>
          </div>

          {/* Tab nav */}
          <div className="flex gap-1 bg-console-surface rounded-lg p-1">
            {(['stories', 'coverage', 'outputs'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 rounded-lg text-sm font-mono transition ${
                  activeTab === tab
                    ? 'bg-console-card text-accent-teal border border-accent-teal/20'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {tab === 'stories' ? 'Story Units' : tab === 'coverage' ? 'Coverage Matrix' : 'Downstream Outputs'}
              </button>
            ))}
          </div>

          {/* Story Units Table */}
          {activeTab === 'stories' && (
            <div className="space-y-2">
              {/* Table header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-mono text-text-dim uppercase tracking-wide">
                <span className="col-span-1">ID</span>
                <span className="col-span-2">Audience</span>
                <span className="col-span-1">Funnel</span>
                <span className="col-span-2">Theme</span>
                <span className="col-span-2">Story Type</span>
                <span className="col-span-1">Route</span>
                <span className="col-span-1">Format</span>
                <span className="col-span-1">Sponsor</span>
                <span className="col-span-1">Status</span>
              </div>

              {stories.map((story) => (
                <div key={story.id}>
                  <button
                    onClick={() => setExpandedStory(expandedStory === story.id ? null : story.id)}
                    className="w-full console-card"
                  >
                    <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm">
                      <span className="col-span-1 font-mono text-accent-teal text-xs">{story.storyId}</span>
                      <span className="col-span-2 text-text-primary text-xs truncate">{story.audienceLabel}</span>
                      <span className="col-span-1">
                        <span className={`text-xs font-mono px-2 py-0.5 rounded border ${FUNNEL_COLORS[story.funnelStage] || ''}`}>
                          {story.funnelStage?.slice(0, 4)}
                        </span>
                      </span>
                      <span className="col-span-2 text-text-secondary text-xs truncate">{story.storyTheme}</span>
                      <span className="col-span-2 text-text-muted text-xs truncate">{story.atlasStoryType}</span>
                      <span className={`col-span-1 text-xs font-mono ${ROUTE_COLORS[story.productionRoute] || 'text-text-muted'}`}>
                        {story.productionRoute}
                      </span>
                      <span className="col-span-1 text-text-muted text-xs truncate">{story.primaryFormat}</span>
                      <span className="col-span-1 text-xs">{story.sponsorPresence ? '✓' : '—'}</span>
                      <span className="col-span-1">
                        <span className="text-xs font-mono badge-pending px-1.5 py-0.5 rounded">{story.status}</span>
                      </span>
                    </div>
                  </button>

                  {expandedStory === story.id && (
                    <div className="bg-console-surface border border-console-border rounded-b-xl -mt-1 p-5 grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-text-dim font-mono">Value Frame</span>
                        <p className="text-text-primary mt-0.5">{story.valueFrame}</p>
                      </div>
                      <div>
                        <span className="text-text-dim font-mono">Tone Band</span>
                        <p className="text-text-primary mt-0.5">{story.toneBand}</p>
                      </div>
                      <div>
                        <span className="text-text-dim font-mono">Avatar</span>
                        <p className="text-text-primary mt-0.5">{story.journalisticAvatar}</p>
                      </div>
                      <div>
                        <span className="text-text-dim font-mono">Treatment</span>
                        <p className="text-text-primary mt-0.5">{story.storyTreatment}</p>
                      </div>
                      <div>
                        <span className="text-text-dim font-mono">Thumb-Stopper</span>
                        <p className="text-text-primary mt-0.5">{story.thumbStopperType}</p>
                      </div>
                      <div>
                        <span className="text-text-dim font-mono">Est. Reach</span>
                        <p className="text-text-primary mt-0.5">{story.estimatedReach?.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-text-dim font-mono">Format Variants</span>
                        <p className="text-text-primary mt-0.5">{story.formatVariantsRequired}</p>
                      </div>
                      <div>
                        <span className="text-text-dim font-mono">Source Stream</span>
                        <p className="text-text-primary mt-0.5">{story.sourceStream}</p>
                      </div>
                      <div>
                        <span className="text-text-dim font-mono">Publisher</span>
                        <p className="text-text-primary mt-0.5">{story.publisherId || '—'}</p>
                      </div>
                      {story.sponsorPresence && (
                        <div>
                          <span className="text-text-dim font-mono">Sponsor Ratio</span>
                          <p className="text-text-primary mt-0.5">{story.sponsorRatio}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-text-dim font-mono">Funnel Block</span>
                        <p className="text-text-primary mt-0.5">{story.funnelBlockAssignment}</p>
                      </div>
                      <div>
                        <span className="text-text-dim font-mono">Evergreen</span>
                        <p className="text-text-primary mt-0.5">{story.evergreenFlag}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Coverage Matrix */}
          {activeTab === 'coverage' && (
            <div className="console-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-console-border">
                    <th className="text-left px-4 py-3 text-xs font-mono text-text-dim uppercase tracking-wide">Audience</th>
                    {FUNNEL_STAGES.map(stage => (
                      <th key={stage} className="text-center px-4 py-3 text-xs font-mono text-text-dim uppercase tracking-wide">{stage}</th>
                    ))}
                    <th className="text-center px-4 py-3 text-xs font-mono text-text-dim uppercase tracking-wide">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {coverageMatrix.map((row, i) => {
                    const total = FUNNEL_STAGES.reduce((sum, stage) => sum + (row[stage] as number || 0), 0);
                    const hasGap = FUNNEL_STAGES.some(stage => (row[stage] as number || 0) === 0);
                    return (
                      <tr key={i} className="border-b border-console-border/50 hover:bg-console-surface/50">
                        <td className="px-4 py-3 text-sm text-text-primary">{row.audience}</td>
                        {FUNNEL_STAGES.map(stage => {
                          const count = row[stage] as number || 0;
                          return (
                            <td key={stage} className="text-center px-4 py-3">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${
                                count === 0
                                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                  : count >= 3
                                  ? 'bg-accent-teal/10 text-accent-teal border border-accent-teal/20'
                                  : 'bg-console-surface text-text-primary border border-console-border'
                              }`}>
                                {count}
                              </span>
                            </td>
                          );
                        })}
                        <td className="text-center px-4 py-3">
                          <span className={`text-sm font-bold ${hasGap ? 'text-red-400' : 'text-accent-teal'}`}>
                            {total} {hasGap && '⚠'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Downstream Outputs */}
          {activeTab === 'outputs' && (
            <div className="space-y-4">
              <p className="text-text-secondary text-sm">
                The Content Plan generates these downstream production documents. Proceed to Pre-Production to generate detailed briefs.
              </p>

              {/* Production Briefs */}
              <div className="console-card p-5 border-amber-400/20">
                <div className="flex items-start gap-4">
                  <span className="text-2xl">◉</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-text-primary font-bold">PANIC Documents</h4>
                      <span className="text-xs font-mono text-amber-400">{stories.filter(s => s.productionRoute === 'Capture' || s.productionRoute === 'Legacy').length} capture stories</span>
                    </div>
                    <p className="text-text-secondary text-sm mb-2">
                      Purpose, Access, Narrative, Integrity, Craft — structured pre-production briefs for each capture-route story unit. Generated in Pre-Production.
                    </p>
                    <div className="bg-console-surface border border-console-border rounded-lg p-3">
                      <span className="text-xs font-mono text-text-dim">Includes:</span>
                      <p className="text-text-muted text-xs mt-1">Working title, synopsis, background, story source, location, subject availability, editorial pillar, angle, regional narrative, jeopardy, desired outcome, full PANIC breakdown, and talent profile.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="console-card p-5 border-purple-400/20">
                <div className="flex items-start gap-4">
                  <span className="text-2xl">◎</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-text-primary font-bold">Wendy Scripts</h4>
                      <span className="text-xs font-mono text-purple-400">Per PANIC</span>
                    </div>
                    <p className="text-text-secondary text-sm mb-2">
                      Interview/shooting scripts with structured narrative — opening statement, supporting statements, jeopardy arc, happy ending, and interview questions. Generated from PANICs.
                    </p>
                    <div className="bg-console-surface border border-console-border rounded-lg p-3">
                      <span className="text-xs font-mono text-text-dim">Structure:</span>
                      <p className="text-text-muted text-xs mt-1">Opening → Supporting Statements → General Jeopardy → Specific Jeopardy → General Happy Ending → Specific Happy Ending (inc. regional narrative) → Interview Questions (8-10)</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="console-card p-5 border-blue-400/20">
                <div className="flex items-start gap-4">
                  <span className="text-2xl">⟡</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-text-primary font-bold">Newsroom Briefs</h4>
                      <span className="text-xs font-mono text-blue-400">{stories.filter(s => s.productionRoute === 'Newsroom').length} newsroom stories</span>
                    </div>
                    <p className="text-text-secondary text-sm mb-2">
                      Editorial curation briefs with source constraints, journalistic avatar voice rules, audience context, and quality gates.
                    </p>
                  </div>
                </div>
              </div>

              {/* Creative Overviews */}
              <div className="console-card p-5 border-accent-teal/20">
                <div className="flex items-start gap-4">
                  <span className="text-2xl">⬡</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-text-primary font-bold">Creative Overviews / Format Treatments</h4>
                      <span className="text-xs font-mono text-accent-teal">Generated in Production</span>
                    </div>
                    <p className="text-text-secondary text-sm mb-2">
                      Presentation-ready format treatments — series rationale, synopsis, audience profile, partnership context, talent profile, and audience call to action. Think pitch-deck quality.
                    </p>
                    <div className="bg-console-surface border border-console-border rounded-lg p-3">
                      <span className="text-xs font-mono text-text-dim">Examples:</span>
                      <p className="text-text-muted text-xs mt-1">Behind-the-scenes series, city exploration formats, deep-dive educational series, talent-led masterclasses — each tailored to the rights holder and sponsor.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Other outputs */}
              {[
                {
                  title: 'Generative Instructions',
                  desc: 'For all Story Units with route: Generative. Source reference + source type, avatar rules, format specs.',
                  icon: '⚡',
                  count: stories.filter(s => s.productionRoute === 'Generative').length,
                },
                {
                  title: 'Story Coverage Report',
                  desc: 'Audience × funnel stage matrix with gap flags. Available in the Coverage Matrix tab.',
                  icon: '📊',
                  count: audiences.length * FUNNEL_STAGES.length,
                },
              ].map((output) => (
                <div key={output.title} className="console-card p-5">
                  <div className="flex items-start gap-4">
                    <span className="text-2xl">{output.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-text-primary font-bold">{output.title}</h4>
                        <span className="text-xs font-mono text-text-muted">{output.count} units</span>
                      </div>
                      <p className="text-text-secondary text-sm">{output.desc}</p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Proceed to Pre-Production */}
              <button
                onClick={() => router.push(`/atlas/forecaster/${projectId}/pre-production`)}
                className="w-full py-4 bg-accent-teal/20 text-accent-teal font-medium rounded-xl border border-accent-teal/30 hover:bg-accent-teal/30 transition text-lg"
              >
                Proceed to Pre-Production — Generate Briefs →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
