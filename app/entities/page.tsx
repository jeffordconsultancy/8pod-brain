'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

interface Entity {
  id: string;
  name: string;
  type: string;
  mentionCount: number;
  description?: string;
}

export default function Entities() {
  const { data: session, status } = useSession();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  if (status === 'loading') return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-gray-400">Loading...</p></div>;

  useEffect(() => {
    async function fetchEntities() {
      try {
        const response = await fetch(
          `/api/entities?workspace=${(session as any)?.workspaceId}`
        );

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || 'Failed to fetch entities');
          return;
        }

        const data = await response.json();
        setEntities(data.entities || []);
      } catch (err) {
        setError('An error occurred while fetching entities.');
      } finally {
        setLoading(false);
      }
    }

    if ((session as any)?.workspaceId) {
      fetchEntities();
    }
  }, [session]);

  const getEntityTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      person: 'bg-blue-900/30 text-blue-200 border-blue-700',
      company: 'bg-purple-900/30 text-purple-200 border-purple-700',
      organization: 'bg-green-900/30 text-green-200 border-green-700',
      location: 'bg-yellow-900/30 text-yellow-200 border-yellow-700',
      default: 'bg-gray-800 text-gray-300 border-gray-700',
    };
    return colors[type.toLowerCase()] || colors.default;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Entities</h1>
        <p className="text-gray-400">
          Explore entities and relationships in your knowledge base
        </p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <p className="text-gray-400">Loading entities...</p>
        </div>
      )}

      {!loading && entities.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">
            Entities ({entities.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {entities.map((entity) => (
              <div
                key={entity.id}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-white">{entity.name}</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      {entity.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-medium px-3 py-1 rounded-full border ${getEntityTypeColor(
                      entity.type
                    )}`}
                  >
                    {entity.type}
                  </span>
                  <span className="text-sm font-medium text-gray-400">
                    {entity.mentionCount} mentions
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && entities.length === 0 && !error && (
        <div className="text-center py-8">
          <p className="text-gray-400">No entities found</p>
        </div>
      )}
    </div>
  );
}
