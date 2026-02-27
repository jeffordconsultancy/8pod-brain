'use client';

import { useSession } from 'next-auth/react';
import { FormEvent, useState } from 'react';

interface QueryResult {
  id: string;
  title: string;
  description: string;
  source: string;
  relevance: number;
}

export default function Query() {
  const { data: session, status } = useSession();
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState<QueryResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (status === 'loading') return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-gray-400">Loading...</p></div>;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setResults([]);
    setLoading(true);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          workspace: (session as any)?.workspaceId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Query failed');
        return;
      }

      const data = await response.json();
      setResults(data.results || []);
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
        <p className="text-gray-400">
          Search and query your knowledge base
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Search Query
          </label>
          <textarea
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-600"
            placeholder="Ask anything about your knowledge base..."
            rows={4}
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading || !queryText}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">
            Results ({results.length})
          </h2>
          <div className="space-y-3">
            {results.map((result) => (
              <div
                key={result.id}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-bold text-white">{result.title}</h3>
                  <div className="text-xs font-medium text-blue-400">
                    {Math.round(result.relevance * 100)}% match
                  </div>
                </div>
                <p className="text-gray-400 text-sm mb-2">{result.description}</p>
                <p className="text-xs text-gray-500">Source: {result.source}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && results.length === 0 && queryText && !error && (
        <div className="text-center py-8">
          <p className="text-gray-400">No results found</p>
        </div>
      )}
    </div>
  );
}
