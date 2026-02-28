'use client';

import { useSession } from 'next-auth/react';
import { FormEvent, useState } from 'react';

const sourceIcons: Record<string, string> = {
  gmail: '✉️',
  'google-drive': '📁',
  'google-calendar': '📅',
  slack: '💬',
  github: '🐙',
};

export default function Query() {
  const { data: session, status } = useSession();
  const [queryText, setQueryText] = useState('');
  const [response, setResponse] = useState('');
  const [sources, setSources] = useState<{ source: string; id: string; summary?: string }[]>([]);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (status === 'loading') return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-gray-400">Loading...</p></div>;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setResponse('');
    setSources([]);
    setResponseTime(null);
    setProvider(null);
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
      setProvider(data.provider || null);
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
        <p className="text-gray-400">Ask questions about your connected data — emails, documents, calendar events</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Your Question</label>
          <textarea
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-600"
            placeholder="e.g. What meetings do I have this week? Who emailed me about the project? Summarize the latest documents..."
            rows={3}
            required
          />
        </div>

        <button type="submit" disabled={loading || !queryText.trim()}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
          {loading ? 'Thinking...' : 'Ask'}
        </button>
      </form>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
          {error}
          {error.includes('API key') && (
            <span className="block mt-1 text-xs text-red-300">
              Go to <a href="/settings" className="underline hover:text-white">Settings</a> to add your API key.
            </span>
          )}
        </div>
      )}

      {response && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Response</h2>
              <div className="flex items-center gap-3">
                {provider && (
                  <span className="text-xs text-gray-500">via {provider}</span>
                )}
                {responseTime && (
                  <span className="text-xs text-gray-500">{(responseTime / 1000).toFixed(1)}s</span>
                )}
              </div>
            </div>
            <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">{response}</div>
          </div>

          {sources.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Sources ({sources.length} records used)</h3>
              <div className="space-y-1">
                {sources.slice(0, 10).map((s, i) => (
                  <div key={i} className="text-xs text-gray-400 flex items-center gap-2">
                    <span>{sourceIcons[s.source] || '📄'}</span>
                    <span className="text-gray-500">[{s.source}]</span>
                    <span className="truncate">{s.summary || s.id}</span>
                  </div>
                ))}
                {sources.length > 10 && (
                  <p className="text-xs text-gray-500 mt-1">+ {sources.length - 10} more sources</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
