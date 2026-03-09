'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PhaseIndicator from '@/components/ui/PhaseIndicator';

interface CreativeOverview {
  id: string;
  formatName: string;
  status: string;
  seriesRationale: string | null;
  seriesSynopsis: string | null;
  formatDescription: string | null;
  audienceProfile: any;
  partnershipContext: string | null;
  callToAction: string | null;
  talentProfile: any;
  distributionNotes: string | null;
  content: any;
  createdAt: string;
  approvedAt: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'badge-pending',
  REVIEW: 'bg-amber-400/10 text-amber-400 border border-amber-400/20',
  APPROVED: 'badge-pass',
};

const phases = [
  { id: 'forecast', label: 'Forecast', status: 'complete' as const },
  { id: 'validate', label: 'Validate', status: 'complete' as const },
  { id: 'content-plan', label: 'Content Plan', status: 'complete' as const },
  { id: 'pre-production', label: 'Pre-Production', status: 'complete' as const },
  { id: 'production', label: 'Production', status: 'active' as const },
];

export default function ProductionPage() {
  const { data: session, status: authStatus } = useSession();
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const workspaceId = (session as any)?.workspaceId;

  const [overviews, setOverviews] = useState<CreativeOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [expandedOverview, setExpandedOverview] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === 'authenticated' && workspaceId) {
      loadData();
    }
  }, [authStatus, workspaceId, projectId]);

  async function loadData() {
    try {
      const res = await fetch(`/api/atlas/creative-overviews?projectId=${projectId}&workspace=${workspaceId}`);
      if (res.ok) {
        const data = await res.json();
        setOverviews(data.overviews || []);
      }
    } catch {
      setError('Failed to load creative overviews');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/atlas/creative-overviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, workspaceId }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Generation failed');
        return;
      }
      await loadData();
    } catch {
      setError('Failed to generate creative overviews');
    } finally {
      setGenerating(false);
    }
  }

  async function handleUpdateStatus(overviewId: string, newStatus: string) {
    try {
      await fetch('/api/atlas/creative-overviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overviewId, status: newStatus }),
      });
      await loadData();
    } catch {
      setError('Failed to update status');
    }
  }

  if (authStatus === 'loading' || loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-text-muted font-mono text-sm">Loading Production...</p></div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">Production</h1>
          <p className="text-text-secondary text-sm">
            Creative overviews and format treatments — presentation-ready documents for each content format.
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

      {/* Generation Panel */}
      {overviews.length === 0 && (
        <div className="console-card p-12 text-center border-accent-teal/20">
          <div className="text-5xl text-text-dim mb-4">⬡</div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">Creative Overviews</h2>
          <p className="text-text-secondary max-w-lg mx-auto mb-6">
            Generate format treatments and creative overviews from the Content Plan and rights package.
            These are presentation-ready documents that define how stories are assembled and presented —
            covering both Newsroom and Generative assembly methods.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-8 py-4 bg-accent-teal/20 text-accent-teal font-medium rounded-xl hover:bg-accent-teal/30 border border-accent-teal/30 transition disabled:opacity-50 text-lg"
          >
            {generating ? 'Generating Format Treatments...' : 'Generate Creative Overviews'}
          </button>
        </div>
      )}

      {/* Overview Cards */}
      {overviews.length > 0 && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="console-card p-4 text-center">
              <span className="text-2xl font-bold text-accent-teal">{overviews.length}</span>
              <p className="text-xs font-mono text-text-dim mt-1">Format Treatments</p>
            </div>
            <div className="console-card p-4 text-center">
              <span className="text-2xl font-bold text-green-400">{overviews.filter(o => o.status === 'APPROVED').length}</span>
              <p className="text-xs font-mono text-text-dim mt-1">Approved</p>
            </div>
            <div className="console-card p-4 text-center">
              <span className="text-2xl font-bold text-text-primary">{overviews.filter(o => o.status === 'DRAFT').length}</span>
              <p className="text-xs font-mono text-text-dim mt-1">In Draft</p>
            </div>
          </div>

          <div className="space-y-4">
            {overviews.map((overview) => {
              const isExpanded = expandedOverview === overview.id;
              const content = overview.content || {};

              return (
                <div key={overview.id} className="console-card overflow-hidden">
                  {/* Header */}
                  <button
                    onClick={() => setExpandedOverview(isExpanded ? null : overview.id)}
                    className="w-full p-5 flex items-center gap-4 text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-accent-teal/10 border border-accent-teal/20 flex items-center justify-center text-accent-teal text-lg font-bold">
                      ⬡
                    </div>
                    <div className="flex-1">
                      <h3 className="text-text-primary font-bold text-lg">{overview.formatName}</h3>
                      {content.tagline && (
                        <p className="text-text-secondary text-sm italic">{content.tagline}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded ${STATUS_COLORS[overview.status] || 'badge-pending'}`}>
                        {overview.status}
                      </span>
                      <span className="text-text-dim text-xs">{isExpanded ? '▼' : '▶'}</span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-console-border p-6 space-y-6">
                      {/* Status controls */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-text-dim">Status:</span>
                        {['DRAFT', 'REVIEW', 'APPROVED'].map(status => (
                          <button
                            key={status}
                            onClick={() => handleUpdateStatus(overview.id, status)}
                            className={`px-3 py-1 rounded text-xs font-mono transition ${
                              overview.status === status
                                ? STATUS_COLORS[status]
                                : 'bg-console-surface text-text-dim border border-console-border hover:text-text-secondary'
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>

                      {/* Series Rationale */}
                      {(overview.seriesRationale || content.seriesRationale) && (
                        <div>
                          <h4 className="text-sm font-bold text-text-primary mb-2 flex items-center gap-2">
                            <span className="w-1 h-4 bg-accent-teal rounded-full"></span>
                            Series Rationale
                          </h4>
                          <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-line">
                            {overview.seriesRationale || content.seriesRationale}
                          </p>
                        </div>
                      )}

                      {/* Series Synopsis */}
                      {(overview.seriesSynopsis || content.seriesSynopsis) && (
                        <div>
                          <h4 className="text-sm font-bold text-text-primary mb-2 flex items-center gap-2">
                            <span className="w-1 h-4 bg-purple-400 rounded-full"></span>
                            Series Synopsis
                          </h4>
                          <p className="text-text-secondary text-sm leading-relaxed whitespace-pre-line">
                            {overview.seriesSynopsis || content.seriesSynopsis}
                          </p>
                        </div>
                      )}

                      {/* Format Description */}
                      {(overview.formatDescription || content.formatDescription) && (
                        <div className="bg-console-surface border border-console-border rounded-xl p-4">
                          <h4 className="text-xs font-mono text-text-dim uppercase tracking-wide mb-2">The Format</h4>
                          <p className="text-text-primary text-sm leading-relaxed">
                            {overview.formatDescription || content.formatDescription}
                          </p>
                        </div>
                      )}

                      {/* Audience & Partnership */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-console-surface border border-console-border rounded-xl p-4">
                          <h4 className="text-xs font-mono text-text-dim uppercase tracking-wide mb-2">The Audience</h4>
                          {(overview.audienceProfile?.description || content.audienceProfile) && (
                            <p className="text-text-secondary text-sm mb-2">
                              {typeof overview.audienceProfile === 'object' ? overview.audienceProfile.description : overview.audienceProfile || content.audienceProfile}
                            </p>
                          )}
                          {(overview.audienceProfile?.interests || content.audienceInterests)?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {(overview.audienceProfile?.interests || content.audienceInterests || []).map((interest: string, i: number) => (
                                <span key={i} className="text-xs font-mono px-2 py-0.5 bg-sky-400/10 text-sky-400 border border-sky-400/20 rounded">
                                  {interest}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="bg-console-surface border border-console-border rounded-xl p-4">
                          <h4 className="text-xs font-mono text-text-dim uppercase tracking-wide mb-2">The Partnership</h4>
                          <p className="text-text-secondary text-sm">
                            {overview.partnershipContext || content.partnershipContext || 'Partnership details to be defined.'}
                          </p>
                        </div>
                      </div>

                      {/* Talent Profile */}
                      {(overview.talentProfile || content.talentProfile) && (
                        <div className="bg-console-surface border border-console-border rounded-xl p-4">
                          <h4 className="text-xs font-mono text-text-dim uppercase tracking-wide mb-2">Talent</h4>
                          {typeof (overview.talentProfile || content.talentProfile) === 'object' ? (
                            <div className="grid grid-cols-3 gap-3 text-sm">
                              <div>
                                <span className="text-text-dim text-xs">Name</span>
                                <p className="text-text-primary">{(overview.talentProfile || content.talentProfile).name || 'TBD'}</p>
                              </div>
                              <div>
                                <span className="text-text-dim text-xs">Background</span>
                                <p className="text-text-primary">{(overview.talentProfile || content.talentProfile).background || 'TBD'}</p>
                              </div>
                              <div>
                                <span className="text-text-dim text-xs">Relevance</span>
                                <p className="text-text-primary">{(overview.talentProfile || content.talentProfile).relevance || 'TBD'}</p>
                              </div>
                            </div>
                          ) : (
                            <p className="text-text-secondary text-sm">{overview.talentProfile || content.talentProfile}</p>
                          )}
                        </div>
                      )}

                      {/* Call to Action */}
                      {(overview.callToAction || content.callToAction) && (
                        <div className="bg-accent-teal/5 border border-accent-teal/20 rounded-xl p-4">
                          <h4 className="text-xs font-mono text-accent-teal uppercase tracking-wide mb-2">Audience Call to Action</h4>
                          <p className="text-text-primary text-sm leading-relaxed">
                            {overview.callToAction || content.callToAction}
                          </p>
                        </div>
                      )}

                      {/* Distribution + Production Scale */}
                      <div className="grid grid-cols-2 gap-4">
                        {(overview.distributionNotes || content.distributionNotes) && (
                          <div>
                            <h4 className="text-xs font-mono text-text-dim uppercase tracking-wide mb-1">Distribution</h4>
                            <p className="text-text-secondary text-xs">{overview.distributionNotes || content.distributionNotes}</p>
                          </div>
                        )}
                        {content.productionScale && (
                          <div>
                            <h4 className="text-xs font-mono text-text-dim uppercase tracking-wide mb-1">Production Scale</h4>
                            <p className="text-text-secondary text-xs">{content.productionScale}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Downstream lifecycle */}
          <div className="console-card p-6">
            <h3 className="text-xs font-mono tracking-[0.3em] text-text-dim mb-3">DOWNSTREAM LIFECYCLE</h3>
            <div className="flex items-center gap-3 text-sm font-mono text-text-dim">
              <span className="text-accent-teal">Production</span>
              <span>→</span>
              <span>Post-Production</span>
              <span>→</span>
              <span>Distribute</span>
              <span>→</span>
              <span>Learn</span>
              <span>→</span>
              <span>Recreate</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
