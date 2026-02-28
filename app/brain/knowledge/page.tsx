'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

interface KnowledgeRecord {
  id: string;
  sourceSystem: string;
  sourceId: string;
  contentType: string;
  rawContent: string;
  summary: string;
  createdAt: string;
  metadata?: any;
}

const sourceIcons: Record<string, string> = {
  gmail: '✉️',
  'google-drive': '📁',
  'google-calendar': '📅',
  slack: '💬',
  github: '🐙',
};

const sourceColors: Record<string, string> = {
  gmail: 'bg-red-900/30 text-red-200 border-red-700',
  'google-drive': 'bg-blue-900/30 text-blue-200 border-blue-700',
  'google-calendar': 'bg-green-900/30 text-green-200 border-green-700',
  slack: 'bg-purple-900/30 text-purple-200 border-purple-700',
  github: 'bg-gray-800 text-gray-300 border-gray-700',
};

export default function Knowledge() {
  const { data: session, status } = useSession();
  const [records, setRecords] = useState<KnowledgeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    async function fetchRecords() {
      try {
        const response = await fetch(
          `/api/knowledge?workspace=${(session as any)?.workspaceId}`
        );

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || 'Failed to fetch records');
          return;
        }

        const data = await response.json();
        setRecords(data.records || []);
      } catch (err) {
        setError('An error occurred while fetching records.');
      } finally {
        setLoading(false);
      }
    }

    if (status === 'authenticated' && (session as any)?.workspaceId) {
      fetchRecords();
    }
  }, [session, status]);

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-gray-400">Loading...</p></div>;
  }

  const sources = Array.from(new Set(records.map(r => r.sourceSystem)));
  const filteredRecords = filter === 'all' ? records : records.filter(r => r.sourceSystem === filter);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Knowledge</h1>
        <p className="text-gray-400">View and manage your knowledge records</p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg">{error}</div>
      )}

      {!loading && records.length > 0 && sources.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
              filter === 'all' ? 'bg-white text-black border-white' : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-600'
            }`}
          >
            All ({records.length})
          </button>
          {sources.map(source => (
            <button
              key={source}
              onClick={() => setFilter(source)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                filter === source ? 'bg-white text-black border-white' : (sourceColors[source] || 'bg-gray-800 text-gray-300 border-gray-700') + ' hover:opacity-80'
              }`}
            >
              {sourceIcons[source] || '📄'} {source} ({records.filter(r => r.sourceSystem === source).length})
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="text-center py-8"><p className="text-gray-400">Loading knowledge records...</p></div>
      )}

      {!loading && filteredRecords.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">Records ({filteredRecords.length})</h2>
          <div className="space-y-3">
            {filteredRecords.map((record) => (
              <div key={record.id} className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-bold text-white flex-1 mr-4">{record.summary || '(No summary)'}</h3>
                  <span className={`text-xs font-medium px-3 py-1 rounded-full border whitespace-nowrap ${sourceColors[record.sourceSystem] || 'bg-gray-800 text-gray-300 border-gray-700'}`}>
                    {sourceIcons[record.sourceSystem] || '📄'} {record.sourceSystem}
                  </span>
                </div>
                <p className="text-gray-400 text-sm mb-4 line-clamp-3 whitespace-pre-line">
                  {record.rawContent.length > 300 ? record.rawContent.slice(0, 300) + '...' : record.rawContent}
                </p>
                <div className="flex items-center gap-4">
                  <p className="text-xs text-gray-500">
                    {new Date(record.createdAt).toLocaleDateString()} at {new Date(record.createdAt).toLocaleTimeString()}
                  </p>
                  <span className="text-xs text-gray-600">{record.contentType}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && filteredRecords.length === 0 && !error && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg mb-2">No knowledge records yet</p>
          <p className="text-gray-500 text-sm">Connect a data source and sync to start building your knowledge base</p>
        </div>
      )}
    </div>
  );
}
