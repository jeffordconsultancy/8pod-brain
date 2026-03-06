'use client';

import { useSession } from 'next-auth/react';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function NewForecast() {
  const { data: session } = useSession();
  const router = useRouter();
  const [brief, setBrief] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const workspaceId = (session as any)?.workspaceId;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!brief.trim() || !workspaceId) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/forecaster/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sponsorBrief: brief.trim(), workspaceId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create project');
        return;
      }
      const data = await res.json();
      router.push(`/atlas/forecaster/${data.project.id}`);
    } catch {
      setError('Failed to create forecast project');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">New Forecast</h1>
        <p className="text-text-secondary">Describe the sponsorship landscape or rights package opportunity. The Forecaster will generate a commercial blueprint.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="text-xs font-mono text-text-dim uppercase tracking-wide mb-2 block">Sponsor Brief</label>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={10}
            className="w-full px-5 py-4 bg-console-surface border border-console-border rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-teal/30 focus:shadow-glow-teal transition resize-none"
            placeholder="Describe the sponsor, rights holder, market, target audiences, commercial objectives, and any specific requirements..."
            autoFocus
          />
        </div>

        <div className="console-card p-4">
          <h4 className="text-xs font-mono text-text-dim uppercase tracking-wide mb-2">What to include</h4>
          <div className="grid grid-cols-2 gap-2 text-sm text-text-muted">
            <span>• Sponsor name and profile</span>
            <span>• Rights holder / property</span>
            <span>• Target market / geography</span>
            <span>• Audience segments</span>
            <span>• Commercial objectives</span>
            <span>• Budget range (if known)</span>
            <span>• Content formats of interest</span>
            <span>• Competitive context</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading || !brief.trim()}
          className="w-full py-4 bg-accent-teal/20 text-accent-teal font-medium rounded-xl hover:bg-accent-teal/30 border border-accent-teal/30 transition disabled:opacity-50 text-lg"
        >
          {loading ? 'Generating Blueprint...' : 'Launch Forecaster'}
        </button>
      </form>
    </div>
  );
}
