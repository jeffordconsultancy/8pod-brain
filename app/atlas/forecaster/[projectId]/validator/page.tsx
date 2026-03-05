'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PhaseIndicator from '@/components/ui/PhaseIndicator';

interface RightsAsset {
  id: string;
  assetType: string;
  title: string;
  description: string;
  audienceAffinity: string;
  funnelState: string;
  format: string;
}

interface Checkpoint {
  id: string;
  checkName: string;
  checkOrder: number;
  status: string;
  requirementText: string;
  evidence: string | null;
  passedAt: string | null;
}

interface Blueprint {
  sponsorName: string;
  rightsHolder: string;
  market: string;
  objectives: string[];
  rightsPackage: string[];
  audienceProfile: string;
}

const ASSET_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  legacy_archive: { label: 'Legacy Archive', icon: '◉', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  rights_holder: { label: 'Rights Holder', icon: '◎', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  newsroom_curation: { label: 'Newsroom / Curation', icon: '⟡', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
};

const FUNNEL_COLORS: Record<string, string> = {
  inspiration: 'bg-sky-400/10 text-sky-400 border-sky-400/20',
  aspiration: 'bg-violet-400/10 text-violet-400 border-violet-400/20',
  immersion: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  conversion: 'bg-green-400/10 text-green-400 border-green-400/20',
};

export default function ValidatorPage() {
  const { data: session, status: authStatus } = useSession();
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const workspaceId = (session as any)?.workspaceId;

  const [project, setProject] = useState<any>(null);
  const [assets, setAssets] = useState<RightsAsset[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authStatus === 'authenticated' && workspaceId) {
      loadData();
    }
  }, [authStatus, workspaceId, projectId]);

  async function loadData() {
    try {
      // Load project
      const pRes = await fetch(`/api/forecaster/projects/${projectId}?workspace=${workspaceId}`);
      const pData = await pRes.json();
      setProject(pData.project);

      // Load validator data
      const vRes = await fetch(`/api/atlas/validator?projectId=${projectId}&workspace=${workspaceId}`);
      if (vRes.ok) {
        const vData = await vRes.json();
        setAssets(vData.assets || []);
        setCheckpoints(vData.checkpoints || []);
      }
    } catch {
      setError('Failed to load validator data');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateAssets() {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/atlas/validator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, workspaceId, action: 'generate-assets' }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Failed to generate assets');
        return;
      }
      await loadData();
    } catch {
      setError('Failed to generate rights assets');
    } finally {
      setGenerating(false);
    }
  }

  async function handleToggleCheckpoint(checkpointId: string, newStatus: string) {
    try {
      await fetch('/api/atlas/validator', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkpointId, status: newStatus, workspaceId }),
      });
      await loadData();
    } catch {
      setError('Failed to update checkpoint');
    }
  }

  async function handlePassAll() {
    try {
      await fetch('/api/atlas/validator', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pass-all', projectId, workspaceId }),
      });
      await loadData();
    } catch {
      setError('Failed to pass all checkpoints');
    }
  }

  async function handleProceedToContentPlan() {
    setGenerating(true);
    try {
      await fetch(`/api/forecaster/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'content-plan', workspaceId }),
      });
      router.push(`/atlas/forecaster/${projectId}/content-plan`);
    } catch {
      setError('Failed to proceed');
    } finally {
      setGenerating(false);
    }
  }

  if (authStatus === 'loading' || loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-text-muted font-mono text-sm">Loading Validator...</p></div>;
  }

  const bp = project?.blueprint as Blueprint | null;
  const passedCount = checkpoints.filter(c => c.status === 'PASS').length;
  const allPassed = checkpoints.length > 0 && passedCount === checkpoints.length;

  const phases = [
    { id: 'forecast', label: 'Forecast', status: 'complete' as const },
    { id: 'validate', label: 'Validate', status: 'active' as const },
    { id: 'content-plan', label: 'Content Plan', status: 'locked' as const },
    { id: 'pre-production', label: 'Pre-Production', status: 'locked' as const },
    { id: 'production', label: 'Production', status: 'locked' as const },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">Validator</h1>
          <p className="text-text-secondary text-sm">
            Simulate rights assets and validate against the canonical gate checklist before generating the Content Plan.
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

      {/* Blueprint Snapshot */}
      {bp && (
        <div className="console-card p-5">
          <h3 className="text-xs font-mono text-text-muted uppercase tracking-wide mb-3">Blueprint Snapshot</h3>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <span className="text-xs text-text-dim">Sponsor</span>
              <p className="text-text-primary font-medium">{bp.sponsorName}</p>
            </div>
            <div>
              <span className="text-xs text-text-dim">Rights Holder</span>
              <p className="text-text-primary font-medium">{bp.rightsHolder}</p>
            </div>
            <div>
              <span className="text-xs text-text-dim">Market</span>
              <p className="text-text-primary font-medium">{bp.market}</p>
            </div>
            <div>
              <span className="text-xs text-text-dim">Rights Items</span>
              <p className="text-text-primary font-medium">{bp.rightsPackage?.length || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Rights Assets Panel */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">Rights Assets</h2>
          {assets.length === 0 && (
            <button
              onClick={handleGenerateAssets}
              disabled={generating}
              className="px-5 py-2.5 bg-accent-teal/20 text-accent-teal font-medium rounded-xl hover:bg-accent-teal/30 border border-accent-teal/30 transition disabled:opacity-50 text-sm font-mono"
            >
              {generating ? 'Simulating assets...' : 'Load Simulated Rights Assets'}
            </button>
          )}
        </div>

        {assets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {assets.map((asset) => {
              const typeInfo = ASSET_TYPE_LABELS[asset.assetType] || { label: asset.assetType, icon: '◉', color: 'text-text-muted bg-console-surface border-console-border' };
              const funnelColor = FUNNEL_COLORS[asset.funnelState] || 'bg-console-surface text-text-muted border-console-border';
              return (
                <div key={asset.id} className="console-card p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${typeInfo.color}`}>
                      {typeInfo.icon} {typeInfo.label}
                    </span>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded border ${funnelColor}`}>
                      {asset.funnelState}
                    </span>
                  </div>
                  <h4 className="text-text-primary font-medium text-sm mb-1">{asset.title}</h4>
                  <p className="text-text-muted text-xs line-clamp-2">{asset.description}</p>
                  {asset.audienceAffinity && (
                    <p className="text-xs text-text-dim mt-2 font-mono">Audience: {asset.audienceAffinity}</p>
                  )}
                  {asset.format && (
                    <p className="text-xs text-text-dim font-mono">Format: {asset.format}</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="console-card p-12 text-center">
            <div className="text-3xl text-text-dim mb-3">◎</div>
            <p className="text-text-muted font-mono text-sm">No rights assets loaded yet</p>
            <p className="text-text-dim text-xs mt-1">Click "Load Simulated Rights Assets" to populate from the blueprint</p>
          </div>
        )}
      </div>

      {/* Validation Matrix */}
      {checkpoints.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-text-primary">Validation Gate Checklist</h2>
            <div className="flex items-center gap-3">
              {!allPassed && (
                <button
                  onClick={handlePassAll}
                  className="px-4 py-1.5 bg-accent-teal/10 text-accent-teal text-xs font-mono rounded-lg border border-accent-teal/20 hover:bg-accent-teal/20 transition"
                >
                  ✓ Pass All Gates
                </button>
              )}
              <div className="flex items-center gap-2">
                <div className="w-32 bg-console-surface rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-accent-teal h-2 rounded-full transition-all duration-500"
                    style={{ width: `${(passedCount / checkpoints.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-text-muted">{passedCount}/{checkpoints.length} PASS</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {checkpoints.sort((a, b) => a.checkOrder - b.checkOrder).map((cp) => (
              <div key={cp.id} className={`console-card p-4 ${cp.status === 'PASS' ? 'console-card-active' : ''}`}>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 pt-0.5">
                    {cp.status === 'PASS' ? (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full badge-pass text-xs font-bold">✓</span>
                    ) : cp.status === 'FAIL' ? (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full badge-fail text-xs font-bold">✗</span>
                    ) : (
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full badge-pending text-xs font-bold">?</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-text-primary font-medium text-sm">{cp.checkName}</h4>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleToggleCheckpoint(cp.id, 'PASS')}
                          className={`px-3 py-1 rounded text-xs font-mono transition ${
                            cp.status === 'PASS' ? 'badge-pass' : 'bg-console-surface text-text-dim border border-console-border hover:text-accent-teal'
                          }`}
                        >
                          PASS
                        </button>
                        <button
                          onClick={() => handleToggleCheckpoint(cp.id, 'FAIL')}
                          className={`px-3 py-1 rounded text-xs font-mono transition ${
                            cp.status === 'FAIL' ? 'badge-fail' : 'bg-console-surface text-text-dim border border-console-border hover:text-red-400'
                          }`}
                        >
                          FAIL
                        </button>
                      </div>
                    </div>
                    <p className="text-text-muted text-xs mb-2">{cp.requirementText}</p>
                    {cp.evidence && (
                      <div className="bg-console-surface border border-console-border rounded-lg p-3 mt-2">
                        <span className="text-xs font-mono text-text-dim">AI Evidence:</span>
                        <p className="text-text-secondary text-xs mt-1">{cp.evidence}</p>
                      </div>
                    )}
                    {cp.passedAt && (
                      <p className="text-xs font-mono text-accent-teal-dim mt-1">
                        Verified: {new Date(cp.passedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Generate Content Plan Button */}
          <button
            onClick={handleProceedToContentPlan}
            disabled={!allPassed || generating}
            className={`w-full py-4 font-medium rounded-xl text-lg transition ${
              allPassed
                ? 'bg-accent-teal/20 text-accent-teal border border-accent-teal/30 hover:bg-accent-teal/30 hover:shadow-glow-teal-lg'
                : 'bg-console-surface text-text-dim border border-console-border cursor-not-allowed'
            } disabled:opacity-50`}
          >
            {!allPassed
              ? `${checkpoints.length - passedCount} checkpoint(s) remaining`
              : generating
              ? 'Generating Content Plan...'
              : '✓ All Gates Passed — Generate Content Plan'}
          </button>
        </div>
      )}
    </div>
  );
}
