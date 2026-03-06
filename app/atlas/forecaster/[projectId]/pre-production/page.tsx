'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PhaseIndicator from '@/components/ui/PhaseIndicator';

interface ProductionBrief {
  id: string;
  briefType: string;
  title: string;
  content: any;
  status: string;
  storyUnitId: string | null;
  createdAt: string;
  approvedAt: string | null;
}

// Helper to safely render values that might be objects/arrays
function renderValue(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) return val.map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)).join(', ');
  if (typeof val === 'object') {
    return Object.entries(val).map(([k, v]) => `${k}: ${Array.isArray(v) ? (v as any[]).join(', ') : v}`).join(' | ');
  }
  return String(val);
}

const BRIEF_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string; bgColor: string }> = {
  PANIC: { label: 'PANIC', icon: '◉', color: 'text-amber-400', bgColor: 'bg-amber-400/10 border-amber-400/20' },
  WENDY: { label: 'Wendy', icon: '◎', color: 'text-purple-400', bgColor: 'bg-purple-400/10 border-purple-400/20' },
  NEWSROOM_BRIEF: { label: 'Newsroom Brief', icon: '⟡', color: 'text-blue-400', bgColor: 'bg-blue-400/10 border-blue-400/20' },
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'badge-pending',
  REVIEW: 'bg-amber-400/10 text-amber-400 border border-amber-400/20',
  APPROVED: 'badge-pass',
  IN_PRODUCTION: 'bg-purple-400/10 text-purple-400 border border-purple-400/20',
};

const phases = [
  { id: 'forecast', label: 'Forecast', status: 'complete' as const },
  { id: 'validate', label: 'Validate', status: 'complete' as const },
  { id: 'content-plan', label: 'Content Plan', status: 'complete' as const },
  { id: 'pre-production', label: 'Pre-Production', status: 'active' as const },
  { id: 'production', label: 'Production', status: 'locked' as const },
];

export default function PreProductionPage() {
  const { data: session, status: authStatus } = useSession();
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const workspaceId = (session as any)?.workspaceId;

  const [briefs, setBriefs] = useState<ProductionBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [expandedBrief, setExpandedBrief] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    if (authStatus === 'authenticated' && workspaceId) {
      loadData();
    }
  }, [authStatus, workspaceId, projectId]);

  async function loadData() {
    try {
      const res = await fetch(`/api/atlas/production-briefs?projectId=${projectId}&workspace=${workspaceId}`);
      if (res.ok) {
        const data = await res.json();
        setBriefs(data.briefs || []);
      }
    } catch {
      setError('Failed to load production briefs');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate(action: string) {
    setGenerating(action);
    setError('');
    try {
      const res = await fetch('/api/atlas/production-briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, workspaceId, action }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Generation failed');
        return;
      }
      await loadData();
    } catch {
      setError('Failed to generate briefs');
    } finally {
      setGenerating(null);
    }
  }

  async function handleUpdateStatus(briefId: string, newStatus: string) {
    try {
      await fetch('/api/atlas/production-briefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ briefId, status: newStatus }),
      });
      await loadData();
    } catch {
      setError('Failed to update status');
    }
  }

  if (authStatus === 'loading' || loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-text-muted font-mono text-sm">Loading Pre-Production...</p></div>;
  }

  const panics = briefs.filter(b => b.briefType === 'PANIC');
  const wendys = briefs.filter(b => b.briefType === 'WENDY');
  const newsroomBriefs = briefs.filter(b => b.briefType === 'NEWSROOM_BRIEF');

  const filteredBriefs = activeFilter === 'all' ? briefs : briefs.filter(b => b.briefType === activeFilter);

  const approvedCount = briefs.filter(b => b.status === 'APPROVED').length;
  const allApproved = briefs.length > 0 && approvedCount === briefs.length;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">Pre-Production</h1>
          <p className="text-text-secondary text-sm">
            Generate production briefs — PANIC documents, Wendy scripts, and Newsroom briefs — from the Content Plan.
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

      {/* Generation Controls */}
      <div className="console-card p-6">
        <h3 className="text-xs font-mono tracking-[0.3em] text-text-dim uppercase mb-4">Generate Production Documents</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* PANIC Generation */}
          <div className={`p-4 rounded-xl border transition ${panics.length > 0 ? 'bg-amber-400/5 border-amber-400/20' : 'bg-console-surface border-console-border'}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-400 text-lg">◉</span>
              <h4 className="text-text-primary font-bold text-sm">PANIC Documents</h4>
            </div>
            <p className="text-text-muted text-xs mb-3">
              Purpose, Access, Narrative, Integrity, Craft — structured capture briefs for shoot planning.
            </p>
            {panics.length > 0 ? (
              <span className="text-xs font-mono text-amber-400">{panics.length} generated</span>
            ) : (
              <button
                onClick={() => handleGenerate('generate-panics')}
                disabled={generating !== null}
                className="px-4 py-2 bg-amber-400/20 text-amber-400 text-xs font-mono rounded-lg border border-amber-400/30 hover:bg-amber-400/30 transition disabled:opacity-50 w-full"
              >
                {generating === 'generate-panics' ? 'Generating...' : 'Generate PANICs'}
              </button>
            )}
          </div>

          {/* Wendy Generation */}
          <div className={`p-4 rounded-xl border transition ${wendys.length > 0 ? 'bg-purple-400/5 border-purple-400/20' : 'bg-console-surface border-console-border'}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-purple-400 text-lg">◎</span>
              <h4 className="text-text-primary font-bold text-sm">Wendy Scripts</h4>
            </div>
            <p className="text-text-muted text-xs mb-3">
              Interview/shooting scripts with narrative structure — opening, jeopardy, resolution, questions.
            </p>
            {wendys.length > 0 ? (
              <span className="text-xs font-mono text-purple-400">{wendys.length} generated</span>
            ) : panics.length === 0 ? (
              <span className="text-xs font-mono text-text-dim">Requires PANICs first</span>
            ) : (
              <button
                onClick={() => handleGenerate('generate-wendys')}
                disabled={generating !== null}
                className="px-4 py-2 bg-purple-400/20 text-purple-400 text-xs font-mono rounded-lg border border-purple-400/30 hover:bg-purple-400/30 transition disabled:opacity-50 w-full"
              >
                {generating === 'generate-wendys' ? 'Generating...' : 'Generate Wendys'}
              </button>
            )}
          </div>

          {/* Newsroom Brief Generation */}
          <div className={`p-4 rounded-xl border transition ${newsroomBriefs.length > 0 ? 'bg-blue-400/5 border-blue-400/20' : 'bg-console-surface border-console-border'}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-blue-400 text-lg">⟡</span>
              <h4 className="text-text-primary font-bold text-sm">Newsroom Briefs</h4>
            </div>
            <p className="text-text-muted text-xs mb-3">
              Editorial curation briefs with source constraints, avatar voice rules, and quality gates.
            </p>
            {newsroomBriefs.length > 0 ? (
              <span className="text-xs font-mono text-blue-400">{newsroomBriefs.length} generated</span>
            ) : (
              <button
                onClick={() => handleGenerate('generate-newsroom-briefs')}
                disabled={generating !== null}
                className="px-4 py-2 bg-blue-400/20 text-blue-400 text-xs font-mono rounded-lg border border-blue-400/30 hover:bg-blue-400/30 transition disabled:opacity-50 w-full"
              >
                {generating === 'generate-newsroom-briefs' ? 'Generating...' : 'Generate Newsroom Briefs'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      {briefs.length > 0 && (
        <div className="grid grid-cols-5 gap-3">
          <div className="console-card p-4 text-center">
            <span className="text-2xl font-bold text-accent-teal">{briefs.length}</span>
            <p className="text-xs font-mono text-text-dim mt-1">Total Briefs</p>
          </div>
          <div className="console-card p-4 text-center">
            <span className="text-2xl font-bold text-amber-400">{panics.length}</span>
            <p className="text-xs font-mono text-text-dim mt-1">PANICs</p>
          </div>
          <div className="console-card p-4 text-center">
            <span className="text-2xl font-bold text-purple-400">{wendys.length}</span>
            <p className="text-xs font-mono text-text-dim mt-1">Wendys</p>
          </div>
          <div className="console-card p-4 text-center">
            <span className="text-2xl font-bold text-blue-400">{newsroomBriefs.length}</span>
            <p className="text-xs font-mono text-text-dim mt-1">Newsroom</p>
          </div>
          <div className="console-card p-4 text-center">
            <span className="text-2xl font-bold text-green-400">{approvedCount}</span>
            <p className="text-xs font-mono text-text-dim mt-1">Approved</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      {briefs.length > 0 && (
        <div className="flex gap-1 bg-console-surface rounded-lg p-1">
          {[
            { key: 'all', label: `All (${briefs.length})` },
            { key: 'PANIC', label: `PANICs (${panics.length})` },
            { key: 'WENDY', label: `Wendys (${wendys.length})` },
            { key: 'NEWSROOM_BRIEF', label: `Newsroom (${newsroomBriefs.length})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-mono transition ${
                activeFilter === tab.key
                  ? 'bg-console-card text-accent-teal border border-accent-teal/20'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Brief Cards */}
      {filteredBriefs.length > 0 && (
        <div className="space-y-3">
          {filteredBriefs.map((brief) => {
            const config = BRIEF_TYPE_CONFIG[brief.briefType] || { label: brief.briefType, icon: '•', color: 'text-text-muted', bgColor: 'bg-console-surface border-console-border' };
            const isExpanded = expandedBrief === brief.id;
            const content = brief.content;

            return (
              <div key={brief.id} className="console-card overflow-hidden">
                <button
                  onClick={() => setExpandedBrief(isExpanded ? null : brief.id)}
                  className="w-full p-4 flex items-center gap-4 text-left"
                >
                  <span className={`text-xs font-mono px-2.5 py-1 rounded border ${config.bgColor} ${config.color}`}>
                    {config.icon} {config.label}
                  </span>
                  <h4 className="flex-1 text-text-primary font-medium text-sm">{brief.title}</h4>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono px-2 py-0.5 rounded ${STATUS_COLORS[brief.status] || 'badge-pending'}`}>
                      {brief.status}
                    </span>
                    <span className="text-text-dim text-xs">{isExpanded ? '▼' : '▶'}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-console-border p-5 space-y-4">
                    {/* Status controls */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-text-dim">Status:</span>
                      {['DRAFT', 'REVIEW', 'APPROVED', 'IN_PRODUCTION'].map(status => (
                        <button
                          key={status}
                          onClick={() => handleUpdateStatus(brief.id, status)}
                          className={`px-3 py-1 rounded text-xs font-mono transition ${
                            brief.status === status
                              ? STATUS_COLORS[status]
                              : 'bg-console-surface text-text-dim border border-console-border hover:text-text-secondary'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>

                    {/* PANIC Content */}
                    {brief.briefType === 'PANIC' && (
                      <div className="space-y-4">
                        {content.synopsis && (
                          <div>
                            <h5 className="text-xs font-mono text-text-dim uppercase tracking-wide mb-1">Synopsis</h5>
                            <p className="text-text-primary text-sm">{renderValue(content.synopsis)}</p>
                          </div>
                        )}
                        {content.background && (
                          <div>
                            <h5 className="text-xs font-mono text-text-dim uppercase tracking-wide mb-1">Background</h5>
                            <ul className="space-y-1">
                              {(Array.isArray(content.background) ? content.background : [content.background]).map((item: string, i: number) => (
                                <li key={i} className="text-text-secondary text-xs flex gap-2">
                                  <span className="text-text-dim">•</span>{renderValue(item)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          {content.angle && (
                            <div>
                              <h5 className="text-xs font-mono text-text-dim uppercase tracking-wide mb-1">Angle</h5>
                              <p className="text-text-secondary text-sm">{renderValue(content.angle)}</p>
                            </div>
                          )}
                          {content.regionalNarrative && (
                            <div>
                              <h5 className="text-xs font-mono text-text-dim uppercase tracking-wide mb-1">Regional Narrative</h5>
                              <p className="text-text-secondary text-sm">{renderValue(content.regionalNarrative)}</p>
                            </div>
                          )}
                          {content.jeopardy && (
                            <div>
                              <h5 className="text-xs font-mono text-text-dim uppercase tracking-wide mb-1">Jeopardy</h5>
                              <p className="text-text-secondary text-sm">{renderValue(content.jeopardy)}</p>
                            </div>
                          )}
                          {content.desiredOutcome && (
                            <div>
                              <h5 className="text-xs font-mono text-text-dim uppercase tracking-wide mb-1">Desired Outcome</h5>
                              <p className="text-text-secondary text-sm">{renderValue(content.desiredOutcome)}</p>
                            </div>
                          )}
                        </div>
                        {/* PANIC breakdown */}
                        <div className="bg-console-surface border border-console-border rounded-xl p-4 space-y-3">
                          <h5 className="text-xs font-mono text-accent-teal uppercase tracking-wide">P.A.N.I.C Breakdown</h5>
                          {[
                            { key: 'purpose', label: 'P — Purpose', desc: 'Why are we telling this story?' },
                            { key: 'access', label: 'A — Access', desc: 'What access do we need?' },
                            { key: 'narrative', label: 'N — Narrative', desc: 'How will the story be told?' },
                            { key: 'integrity', label: 'I — Integrity', desc: 'Any ethical sensitivities?' },
                            { key: 'craft', label: 'C — Craft', desc: 'Visual treatment approach' },
                          ].map(field => content[field.key] ? (
                            <div key={field.key}>
                              <h6 className="text-xs font-bold text-text-primary">{field.label}</h6>
                              <p className="text-text-secondary text-xs mt-0.5">{renderValue(content[field.key])}</p>
                            </div>
                          ) : null)}
                        </div>
                        {content.talentProfile && (
                          <div className="bg-console-surface border border-console-border rounded-xl p-4">
                            <h5 className="text-xs font-mono text-text-dim uppercase tracking-wide mb-2">Talent Profile</h5>
                            <div className="grid grid-cols-3 gap-3 text-xs">
                              <div><span className="text-text-dim">Name:</span> <span className="text-text-primary">{content.talentProfile.name || 'TBD'}</span></div>
                              <div><span className="text-text-dim">Background:</span> <span className="text-text-primary">{content.talentProfile.background || 'TBD'}</span></div>
                              <div><span className="text-text-dim">Relevance:</span> <span className="text-text-primary">{content.talentProfile.relevance || 'TBD'}</span></div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* WENDY Content */}
                    {brief.briefType === 'WENDY' && (
                      <div className="space-y-4">
                        <div className="bg-purple-400/5 border border-purple-400/20 rounded-xl p-4">
                          <h5 className="text-xs font-mono text-purple-400 uppercase tracking-wide mb-2">Opening Statement</h5>
                          <p className="text-text-primary text-sm italic">{renderValue(content.openingStatement)}</p>
                        </div>
                        {content.supportingStatements?.length > 0 && (
                          <div>
                            <h5 className="text-xs font-mono text-text-dim uppercase tracking-wide mb-2">Supporting Statements</h5>
                            <ol className="space-y-1">
                              {content.supportingStatements.map((s: string, i: number) => (
                                <li key={i} className="text-text-secondary text-xs flex gap-2">
                                  <span className="text-text-dim font-mono">{i + 1}.</span>{renderValue(s)}
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                            <h5 className="text-xs font-mono text-red-400 uppercase tracking-wide mb-2">General Jeopardy</h5>
                            <p className="text-text-primary text-sm italic">{renderValue(content.generalJeopardyStatement)}</p>
                            {content.specificJeopardyStatements?.length > 0 && (
                              <div className="mt-3">
                                <h6 className="text-xs font-mono text-text-dim mb-1">Specific Jeopardy</h6>
                                <ol className="space-y-1">
                                  {content.specificJeopardyStatements.map((s: string, i: number) => (
                                    <li key={i} className="text-text-muted text-xs flex gap-2">
                                      <span className="text-text-dim font-mono">{i + 1}.</span>{renderValue(s)}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}
                          </div>
                          <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                            <h5 className="text-xs font-mono text-green-400 uppercase tracking-wide mb-2">General Happy Ending</h5>
                            <p className="text-text-primary text-sm italic">{renderValue(content.generalHappyEndingStatement)}</p>
                            {content.specificHappyEndingStatements?.length > 0 && (
                              <div className="mt-3">
                                <h6 className="text-xs font-mono text-text-dim mb-1">Specific Happy Ending</h6>
                                <ol className="space-y-1">
                                  {content.specificHappyEndingStatements.map((s: string, i: number) => (
                                    <li key={i} className="text-text-muted text-xs flex gap-2">
                                      <span className="text-text-dim font-mono">{i + 1}.</span>{renderValue(s)}
                                    </li>
                                  ))}
                                </ol>
                              </div>
                            )}
                          </div>
                        </div>
                        {content.questions?.length > 0 && (
                          <div>
                            <h5 className="text-xs font-mono text-text-dim uppercase tracking-wide mb-2">Interview Questions</h5>
                            <ol className="space-y-1">
                              {content.questions.map((q: string, i: number) => (
                                <li key={i} className="text-text-secondary text-xs flex gap-2">
                                  <span className="text-text-dim font-mono">{i + 1}.</span>{renderValue(q)}
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    )}

                    {/* NEWSROOM BRIEF Content */}
                    {brief.briefType === 'NEWSROOM_BRIEF' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          {content.editorialAngle && (
                            <div>
                              <h5 className="text-xs font-mono text-text-dim uppercase tracking-wide mb-1">Editorial Angle</h5>
                              <p className="text-text-secondary text-sm">{renderValue(content.editorialAngle)}</p>
                            </div>
                          )}
                          {content.avatarVoice && (
                            <div>
                              <h5 className="text-xs font-mono text-text-dim uppercase tracking-wide mb-1">Avatar Voice</h5>
                              <p className="text-text-secondary text-sm">{renderValue(content.avatarVoice)}</p>
                            </div>
                          )}
                          {content.sourceConstraints && (
                            <div>
                              <h5 className="text-xs font-mono text-text-dim uppercase tracking-wide mb-1">Source Constraints</h5>
                              <p className="text-text-secondary text-sm">{renderValue(content.sourceConstraints)}</p>
                            </div>
                          )}
                          {content.curationParameters && (
                            <div>
                              <h5 className="text-xs font-mono text-text-dim uppercase tracking-wide mb-1">Curation Parameters</h5>
                              <p className="text-text-secondary text-sm">{renderValue(content.curationParameters)}</p>
                            </div>
                          )}
                          {content.audienceContext && (
                            <div>
                              <h5 className="text-xs font-mono text-text-dim uppercase tracking-wide mb-1">Audience Context</h5>
                              <p className="text-text-secondary text-sm">{renderValue(content.audienceContext)}</p>
                            </div>
                          )}
                          {content.sponsorIntegration && (
                            <div>
                              <h5 className="text-xs font-mono text-text-dim uppercase tracking-wide mb-1">Sponsor Integration</h5>
                              <p className="text-text-secondary text-sm">{renderValue(content.sponsorIntegration)}</p>
                            </div>
                          )}
                        </div>
                        {content.qualityGates && (
                          <div className="bg-console-surface border border-console-border rounded-xl p-4">
                            <h5 className="text-xs font-mono text-text-dim uppercase tracking-wide mb-1">Quality Gates</h5>
                            <p className="text-text-secondary text-xs">{renderValue(content.qualityGates)}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Proceed to Production */}
      {briefs.length > 0 && (
        <button
          onClick={() => router.push(`/atlas/forecaster/${projectId}/production`)}
          disabled={!allApproved}
          className={`w-full py-4 font-medium rounded-xl text-lg transition ${
            allApproved
              ? 'bg-accent-teal/20 text-accent-teal border border-accent-teal/30 hover:bg-accent-teal/30 hover:shadow-glow-teal-lg'
              : 'bg-console-surface text-text-dim border border-console-border hover:border-console-border-hover'
          }`}
        >
          {allApproved
            ? '✓ All Briefs Approved — Proceed to Production'
            : `${briefs.length - approvedCount} brief(s) pending approval — Proceed to Production →`}
        </button>
      )}
    </div>
  );
}
