'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

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
        .then(data => setProject(data.project))
        .catch(() => setError('Failed to load project'))
        .finally(() => setLoading(false));
    }
  }, [authStatus, workspaceId, projectId]);

  if (authStatus === 'loading' || loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-gray-400">Loading...</p></div>;
  }

  if (!project) {
    return <div className="p-8"><div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg">{error || 'Project not found'}</div></div>;
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

      // Generate insights
      const iRes = await fetch('/api/forecaster/generate-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, workspaceId }),
      });
      if (!iRes.ok) {
        const d = await iRes.json();
        setError(d.error || 'Failed to generate insights');
      }

      // Reload project
      const pRes = await fetch(`/api/forecaster/projects/${projectId}?workspace=${workspaceId}`);
      const data = await pRes.json();
      setProject(data.project);
    } catch (err) {
      setError('Failed to generate insights');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeepDive(insightId: string, title: string) {
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
  const phase = project.status === 'prompt' ? 1
    : project.status === 'blueprint' ? 2
    : project.status === 'insights' || project.status === 'complete' ? 3
    : 2;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">{project.name}</h1>
          <div className="flex gap-4 text-sm text-gray-500">
            <span>Phase {phase} of 4</span>
            <span>Status: {project.status}</span>
          </div>
        </div>
        <button onClick={() => router.push('/atlas')} className="text-gray-500 hover:text-white text-sm transition">
          Back to Atlas
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg">{error}</div>
      )}

      {/* Phase 2: Blueprint Review */}
      {phase === 2 && bp && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Phase 2: Rights Package Blueprint</h2>
            <p className="text-gray-400 text-sm">Review the AI-generated blueprint. Confirm to proceed to insights generation.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Sponsor</h3>
              <p className="text-white font-bold text-lg">{bp.sponsorName}</p>
              <p className="text-gray-400 text-sm mt-1">{bp.sponsorProfile}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Rights Holder</h3>
              <p className="text-white font-bold text-lg">{bp.rightsHolder}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Market</h3>
              <p className="text-white font-bold text-lg">{bp.market}</p>
              <p className="text-gray-400 text-sm mt-1">{bp.audienceProfile}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Objectives</h3>
              <ul className="space-y-1">
                {(bp.objectives || []).map((obj, i) => (
                  <li key={i} className="text-white text-sm">{obj}</li>
                ))}
              </ul>
            </div>
          </div>

          {bp.rightsPackage && bp.rightsPackage.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Proposed Rights Package</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {bp.rightsPackage.map((right, i) => (
                  <div key={i} className="text-white text-sm bg-gray-800 rounded px-3 py-2">{right}</div>
                ))}
              </div>
            </div>
          )}

          {bp.governingRules && bp.governingRules.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Governing Rules</h3>
              <ul className="space-y-1">
                {bp.governingRules.map((rule, i) => (
                  <li key={i} className="text-gray-300 text-sm">{rule}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={handleApproveBlueprint}
            disabled={actionLoading}
            className="w-full py-4 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50 text-lg"
          >
            {actionLoading ? 'Generating Insights...' : 'Confirm & Continue to Insights'}
          </button>
        </div>
      )}

      {/* Phase 3: Insights Dashboard */}
      {phase >= 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Phase 3: Tailored Insights Dashboard</h2>
            <p className="text-gray-400 text-sm">Click any insight card to deep-dive into the 8pod Algorithm analysis.</p>
          </div>

          {insights.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.map((insight) => (
                <div key={insight.id} className="bg-gray-900 border border-gray-800 rounded-lg p-5 hover:border-gray-700 transition">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{insight.category}</span>
                    <span className="text-xs text-gray-600">{insight.chartType}</span>
                  </div>
                  <h3 className="text-white font-bold mb-2">{insight.title}</h3>
                  <p className="text-gray-400 text-sm mb-4">{insight.description}</p>

                  {/* Simple data visualization */}
                  {insight.chartType === 'bar' && insight.data?.items && (
                    <div className="space-y-2 mb-4">
                      {insight.data.items.slice(0, 5).map((item: any, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 w-24 truncate">{item.label}</span>
                          <div className="flex-1 bg-gray-800 rounded-full h-2">
                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Math.min(100, item.value)}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-10 text-right">{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {insight.chartType === 'metric' && insight.data?.value && (
                    <div className="text-3xl font-bold text-blue-400 mb-4">{insight.data.value}</div>
                  )}

                  <button
                    onClick={() => handleDeepDive(insight.id, insight.title)}
                    disabled={deepDiveLoading}
                    className="text-sm text-blue-400 hover:text-blue-300 transition"
                  >
                    {deepDiveLoading && deepDive === null ? 'Analysing...' : 'Double-click to deep dive'}
                  </button>

                  {/* Phase 4: Deep Dive */}
                  {deepDive?.insightId === insight.id && (
                    <div className="mt-4 pt-4 border-t border-gray-800">
                      <h4 className="text-sm font-medium text-white mb-2">8pod Algorithm Deep Dive</h4>
                      <div className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{deepDive.analysis}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-900 border border-gray-800 rounded-lg">
              <p className="text-gray-400">Insights are being generated...</p>
            </div>
          )}
        </div>
      )}

      {/* Show brief if still in prompt phase */}
      {phase === 1 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-2">Sponsor Brief</h2>
          <p className="text-gray-300 whitespace-pre-wrap">{project.sponsorBrief}</p>
          <p className="text-yellow-400 text-sm mt-4">Blueprint generation in progress. Refresh the page to check status.</p>
        </div>
      )}
    </div>
  );
}
