'use client';

import { useSession } from 'next-auth/react';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function NewForecast() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [brief, setBrief] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const workspaceId = (session as any)?.workspaceId;

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-gray-400">Loading...</p></div>;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!brief.trim() || !workspaceId) return;

    setLoading(true);
    setError('');

    try {
      // Create project
      const res = await fetch('/api/forecaster/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, sponsorBrief: brief }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create project');
        return;
      }

      const { project } = await res.json();

      // Generate blueprint
      const bpRes = await fetch('/api/forecaster/generate-blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, workspaceId }),
      });

      if (!bpRes.ok) {
        const data = await bpRes.json();
        setError(data.error || 'Blueprint generation failed');
        // Still redirect to project page
        router.push(`/atlas/forecaster/${project.id}`);
        return;
      }

      router.push(`/atlas/forecaster/${project.id}`);
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">New Forecast</h1>
        <p className="text-gray-400">Phase 1: Describe the sponsorship landscape. Tell us about the sponsor, rights holder, market, and objectives in your own words.</p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
          {error}
          {error.includes('API key') && (
            <span className="block mt-1 text-xs text-red-300">
              Go to <a href="/brain/settings" className="underline">Brain &gt; Settings</a> to add your Anthropic API key.
            </span>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">Describe the client&apos;s world</label>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            className="w-full px-5 py-4 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-gray-600 transition resize-none"
            placeholder={"Example: Nike is looking to expand their NBA sponsorship package in the US market. They want to increase brand visibility among Gen Z audiences, drive merchandise sales, and strengthen their association with basketball culture. The rights holder is the NBA. Key objectives include courtside branding, digital engagement, and athlete partnerships."}
            rows={8}
            required
          />
          <p className="text-xs text-gray-500 mt-2">{brief.length} characters</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">What to include:</h3>
          <ul className="text-sm text-gray-500 space-y-1">
            <li>Sponsor name and background</li>
            <li>Rights holder (league, team, event, etc.)</li>
            <li>Target market and geography</li>
            <li>Commercial objectives and goals</li>
            <li>Any specific rights or assets of interest</li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={loading || !brief.trim()}
          className="w-full py-4 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50 text-lg"
        >
          {loading ? 'Generating Blueprint...' : 'Generate Rights Package Blueprint'}
        </button>
      </form>
    </div>
  );
}
