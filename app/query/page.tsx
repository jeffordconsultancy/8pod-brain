'use client';

import { useSession } from 'next-auth/react';
import { FormEvent, useState } from 'react';

export default function Query() {
  const { data: session, status } = useSession();
  const [queryText, setQueryText] = useState('');
  const [response, setResponse] = useState('');
  const [sources, setSources] = useState<{ source: string; id: string }[]>([]);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (status === 'loading') return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-gray-400">Loading...</p></div>;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setResponse('');
    setSources([]);
    setResponseTime(null);
    setLoading(true);

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          workspaceId: (session as any)?.workspaceId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Query failed');
        return;
      }

      const data = await res.json();
      setResponse(data.response || '');
      setSources(data.sources || []);
      setResponseTime(data.responseTimeMs || null);
    } catch (err) {
      setError('An error occurred while querying.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Query</h1>
        <p className="text-gray-400">Ask questions about your connected data</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Your Question</label>
          <textarea
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-600"
            placeholder="Ask anything about your knowledge base..."
            rows={4}
            required
          />
        </div>

        <button type="submit" disabled={loading || !queryText}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
          {loading ? 'Thinking...' : 'Ask'}
        </button>
      </form>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg">{error}</div>
      )}

      {response && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Response</h2>
              {responseTime && (
                <span className="text-xs text-gray-500">{(responseTime / 1000).toFixed(1)}s</span>
              )}
            </div>
            <div className="text-gray-300 whitespace-pre-wrap">{response}</div>
          </div>

          {sources.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Sources</h3>
              <div className="flex flex-wrap gap-2">
                {sources.map((s, i) => (
                  <span key={i} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                    {s.source}: {s.id}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
