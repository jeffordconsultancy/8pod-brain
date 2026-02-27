'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useEffect, useState } from 'react';

interface KnowledgeRecord {
  id: string;
  title: string;
  content: string;
  source: string;
  createdAt: string;
}

export default function Knowledge() {
  const { data: session } = useSession();
  const [records, setRecords] = useState<KnowledgeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  if (!session) {
    redirect('/login');
  }

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

    if ((session as any)?.workspaceId) {
      fetchRecords();
    }
  }, [session]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Knowledge</h1>
        <p className="text-gray-400">
          View and manage your knowledge records
        </p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <p className="text-gray-400">Loading knowledge records...</p>
        </div>
      )}

      {!loading && records.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">
            Records ({records.length})
          </h2>
          <div className="space-y-3">
            {records.map((record) => (
              <div
                key={record.id}
                className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-bold text-white">{record.title}</h3>
                  <span className="text-xs font-medium text-gray-400 bg-gray-800 px-3 py-1 rounded-full">
                    {record.source}
                  </span>
                </div>
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                  {record.content}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(record.createdAt).toLocaleDateString()} at{' '}
                  {new Date(record.createdAt).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && records.length === 0 && !error && (
        <div className="text-center py-8">
          <p className="text-gray-400">No knowledge records yet</p>
        </div>
      )}
    </div>
  );
}
