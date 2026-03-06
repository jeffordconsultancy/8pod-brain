'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PhaseIndicator from '@/components/ui/PhaseIndicator';

interface Blueprint {
  sponsorName: string;
  sponsorProfile: string;
  rightsHolder: string;
  market: string;
  objectives: string[];
  governingRules: string[];
  rightsPackage: string[];
  audienceProfile: string;
}

interface Insight {
  id: string;
  category: string;
  title: string;
  description: string;
  chartType: string;
  data: any;
}

interface Project {
  id: string;
  name: string;
  status: string;
  sponsorBrief: string;
  blueprint: Blueprint | null;
  blueprintApprovedAt: string | null;
  insightsData: any;
  insights: Insight[];
}

const STATUS_TO_PHASE: Record<string, number> = {
  prompt: 1,
  blueprint: 2,
  insights: 3,
  validating: 4,
  validated: 4,
  'content-plan': 5,
  'pre-production': 6,
  production: 7,
  complete: 7,
};

function getPhases(status: string) {
  const current = STATUS_TO_PHASE[status] || 1;
  return [
    { id: 'forecast', label: 'Forecast', status: current > 3 ? 'complete' as const : current >= 1 ? 'active' as const : 'locked' as const },
    { id: 'validate', label: 'Validate', status: current > 4 ? 'complete' as const : current === 4 ? 'active' as const : 'locked' as const },
    { id: 'content-plan', label: 'Content Plan', status: current > 5 ? 'complete' as const : current === 5 ? 'active' as const : 'locked' as const },
    { id: 'pre-production', label: 'Pre-Production', status: current > 6 ? 'complete' as const : current === 6 ? 'active' as const : 'locked' as const },
    { id: 'production', label: 'Production', status: current >= 7 ? 'active' as const : 'locked' as const },
  ];
}

export default function ForecasterProject() {
  const { data: session, status: authStatus } = useSession();
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const workspaceId = (session as any)?.workspaceId;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [deepDive, setDeepDive] = useState<{ insightId: string; analysis: string } | null>(null);
  const [deepDiveLoading, setDeepDiveLoading] = useState(false);

  useEffect(() => {
    if (authStatus === 'authenticated' && workspaceId) {
      fetch(`/api/forecaster/projects/${projectId}?workspace=${workspaceId}`)
        .then(r => r.ok ? r.json() : Promise.reject('Failed to load'))
        .then(async (data) => {
          setProject(data.project);
          // Auto-trigger blueprint generation if stuck in prompt status
          if (data.project.status === 'prompt') {
            try {
              const res = await fetch('/api/forecaster/generate-blueprint', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, workspaceId }),
              });
              if (res.ok) {
                const bpData = await res.json();
                setProject(bpData.project);
              }
            } catch {
              // Blueprint gen failed — page will show retry option
            }
          }
        })
        .catch(() => setError('Failed to load project'))
        .finally(() => setLoading(false));
    }
  }, [authStatus, workspaceId, projectId]);

  if (authStatus === 'loading' || loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-text-muted font-mono text-sm">Loading...</p></div>;
  }

  if (!project) {
    return <div className="p-8"><div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">{error || 'Project not found'}</div></div>;
  }

  async function handleApproveBlueprint() {
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/forecaster/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'insights', blueprintApprovedAt: new Date().toISOString(), workspaceId }),
      });
      if (!res.ok) throw new Error('Failed to approve');

      const iRes = await fetch('/api/forecaster/generate-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, workspaceId }),
      });
      if (!iRes.ok) {
        const d = await iRes.json();
        setError(d.error || 'Failed to generate insights');
      }

      const pRes = await fetch(`/api/forecaster/projects/${projectId}?workspace=${workspaceId}`);
      const data = await pRes.json();
      setProject(data.project);
    } catch (err) {
      setError('Failed to generate insights');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleProceedToValidator() {
    setActionLoading(true);
    try {
      await fetch(`/api/forecaster/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'validating', workspaceId }),
      });
      router.push(`/atlas/forecaster/${projectId}/validator`);
    } catch {
      setError('Failed to proceed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeepDive(insightId: string) {
    setDeepDiveLoading(true);
    setDeepDive(null);
    try {
      const res = await fetch('/api/forecaster/deep-dive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, insightId, workspaceId }),
      });
      if (!res.ok) throw new Error('Deep dive failed');
      const data = await res.json();
      setDeepDive({ insightId, analysis: data.analysis });
    } catch {
      setError('Deep dive analysis failed');
    } finally {
      setDeepDiveLoading(false);
    }
  }

  const bp = project.blueprint as Blueprint | null;
  const insights = project.insights || [];
  const phases = getPhases(project.status);
  const showBlueprint = project.status === 'blueprint';
  const showInsights = ['insights', 'validating', 'validated', 'content-plan', 'pre-production', 'production', 'complete'].includes(project.status);

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">{project.name}</h1>
          <div className="flex gap-4 text-sm text-text-muted font-mono">
            <span>Status: {project.status}</span>
          </div>
        </div>
        <button onClick={() => router.push('/atlas')} className="text-text-muted hover:text-text-primary text-sm transition font-mono">
          ← Back to Atlas
        </button>
      </div>

      {/* Phase indicator */}
      <PhaseIndicator phases={phases} />

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Phase 2: Blueprint Review */}
      {showBlueprint && bp && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-text-primary mb-1">Phase 2: Rights Package Blueprint</h2>
            <p className="text-text-secondary text-sm">Review the AI-generated blueprint. Confirm to generate insights.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="console-card p-5">
              <h3 className="text-xs font-mono text-text-muted uppercase tracking-wide mb-2">Sponsor</h3>
              <p className="text-text-primary font-bold text-lg">{bp.sponsorName}</p>
              <p className="text-text-secondary text-sm mt-1">{bp.sponsorProfile}</p>
            </div>
            <div className="console-card p-5">
              <h3 className="text-xs font-mono text-text-muted uppercase tracking-wide mb-2">Rights Holder</h3>
              <p className="text-text-primary font-bold text-lg">{bp.rightsHolder}</p>
            </div>
            <div className="console-card p-5">
              <h3 className="text-xs font-mono text-text-muted uppercase tracking-wide mb-2">Market</h3>
              <p className="text-text-primary font-bold text-lg">{bp.market}</p>
              <p className="text-text-secondary text-sm mt-1">{bp.audienceProfile}</p>
            </div>
            <div className="console-card p-5">
              <h3 className="text-xs font-mono text-text-muted uppercase tracking-wide mb-2">Objectives</h3>
              <ul className="space-y-1">
                {(bp.objectives || []).map((obj, i) => (
                  <li key={i} className="text-text-primary text-sm">• {obj}</li>
                ))}
              </ul>
            </div>
          </div>

          {bp.rightsPackage && bp.rightsPackage.length > 0 && (
            <div className="console-card p-5">
              <h3 className="text-xs font-mono text-text-muted uppercase tracking-wide mb-3">Proposed Rights Package</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {bp.rightsPackage.map((right, i) => (
                  <div key={i} className="text-text-primary text-sm bg-console-surface rounded-lg px-3 py-2 border border-console-border">{right}</div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleApproveBlueprint}
            disabled={actionLoading}
            className="w-full py-4 bg-accent-teal/20 text-accent-teal font-medium rounded-xl hover:bg-accent-teal/30 border border-accent-teal/30 transition disabled:opacity-50 text-lg"
          >
            {actionLoading ? 'Generating Insights...' : 'Confirm & Generate Insights'}
          </button>
        </div>
      )}

      {/* Phase 3: Insights Dashboard */}
      {showInsights && (
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-text-primary mb-1">Phase 3: Insights Dashboard</h2>
              <p className="text-text-secondary text-sm">AI-generated commercial intelligence. Click any insight to deep-dive.</p>
            </div>
            {project.status === 'insights' && (
              <button
                onClick={handleProceedToValidator}
                disabled={actionLoading}
                className="px-6 py-3 bg-accent-teal/20 text-accent-teal font-medium rounded-xl hover:bg-accent-teal/30 border border-accent-teal/30 transition disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Proceed to Validator →'}
              </button>
            )}
          </div>

          {insights.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.map((insight) => (
                <div key={insight.id} className="console-card p-5">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-xs font-mono text-text-muted uppercase tracking-wide">{insight.category}</span>
                    <span className="text-xs text-text-dim font-mono">{insight.chartType}</span>
                  </div>
                  <h3 className="text-text-primary font-bold mb-2">{insight.title}</h3>
                  <p className="text-text-secondary text-sm mb-4">{insight.description}</p>

                  {insight.chartType === 'bar' && insight.data?.items && (
                    <div className="space-y-2 mb-4">
                      {insight.data.items.slice(0, 5).map((item: any, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-text-muted w-24 truncate">{item.label}</span>
                          <div className="flex-1 bg-console-surface rounded-full h-2">
                            <div className="bg-accent-teal h-2 rounded-full" style={{ width: `${Math.min(100, item.value)}%` }} />
                          </div>
                          <span className="text-xs text-text-dim w-10 text-right">{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {insight.chartType === 'metric' && insight.data?.value && (
                    <div className="text-3xl font-bold text-accent-teal mb-4">{insight.data.value}</div>
                  )}

                  <button
                    onClick={() => handleDeepDive(insight.id)}
                    disabled={deepDiveLoading}
                    className="text-sm text-accent-teal hover:text-accent-teal/80 transition font-mono"
                  >
                    {deepDiveLoading && !deepDive ? 'Analysing...' : '→ Deep dive'}
                  </button>

                  {deepDive?.insightId === insight.id && (
                    <div className="mt-4 pt-4 border-t border-console-border">
                      <h4 className="text-sm font-mono text-accent-teal mb-2">8pod Algorithm Analysis</h4>
                      <div className="text-text-secondary text-sm whitespace-pre-wrap leading-relaxed">{deepDive.analysis}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 console-card">
              <p className="text-text-muted font-mono">Insights are being generated...</p>
            </div>
          )}
        </div>
      )}

      {/* Show brief if still in prompt phase */}
      {project.status === 'prompt' && (
        <div className="console-card p-6">
          <h2 className="text-xl font-bold text-text-primary mb-2">Sponsor Brief</h2>
          <p className="text-text-secondary whitespace-pre-wrap">{project.sponsorBrief}</p>
          <p className="text-yellow-400 text-sm mt-4 font-mono">Blueprint generation in progress. Refresh to check status.</p>
        </div>
      )}

      {/* Quick links for downstream phases */}
      {['validating', 'validated', 'content-plan', 'pre-production', 'production'].includes(project.status) && (
        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/atlas/forecaster/${projectId}/validator`)}
            className="console-card px-5 py-3 text-sm font-mono text-accent-teal hover:shadow-glow-teal transition"
          >
            → Validator
          </button>
          {['content-plan', 'pre-production', 'production'].includes(project.status) && (
            <button
              onClick={() => router.push(`/atlas/forecaster/${projectId}/content-plan`)}
              className="console-card px-5 py-3 text-sm font-mono text-accent-teal hover:shadow-glow-teal transition"
            >
              → Content Plan
            </button>
          )}
          <button
            onClick={() => router.push(`/atlas/forecaster/${projectId}/pre-production`)}
            className="console-card px-5 py-3 text-sm font-mono text-text-dim"
          >
            → Pre-Production
          </button>
          <button
            onClick={() => router.push(`/atlas/forecaster/${projectId}/production`)}
            className="console-card px-5 py-3 text-sm font-mono text-text-dim"
          >
            → Production
          </button>
        </div>
      )}
    </div>
  );
}
