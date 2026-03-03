'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import ScopeToggle from '@/components/ScopeToggle';

interface Entity {
  id: string;
  canonicalName: string;
  type: string;
  role?: string;
  mentionCount: number;
  firstSeen?: string;
  lastSeen?: string;
}

export default function Entities() {
  const { data: session, status } = useSession();
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [scope, setScope] = useState<'mine' | 'team'>('team');

  useEffect(() => {
    async function fetchEntities() {
      try {
        const userId = (session?.user as any)?.id;
        const response = await fetch(
          `/api/entities?workspace=${(session as any)?.workspaceId}&scope=${scope}&userId=${userId}`
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

    if (status === 'authenticated' && (session as any)?.workspaceId) {
      fetchEntities();
    }
  }, [session, status, scope]);

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-gray-400">Loading...</p></div>;
  }

  const getEntityTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      person: 'bg-blue-900/30 text-blue-200 border-blue-700',
      company: 'bg-purple-900/30 text-purple-200 border-purple-700',
      topic: 'bg-green-900/30 text-green-200 border-green-700',
      location: 'bg-yellow-900/30 text-yellow-200 border-yellow-700',
    };
    return colors[type.toLowerCase()] || 'bg-gray-800 text-gray-300 border-gray-700';
  };

  const getEntityIcon = (type: string): string => {
    const icons: Record<string, string> = {
      person: '👤',
      company: '🏢',
      topic: '💡',
      location: '📍',
    };
    return icons[type.toLowerCase()] || '🔹';
  };

  const types = Array.from(new Set(entities.map(e => e.type)));
  const filteredEntities = typeFilter === 'all' ? entities : entities.filter(e => e.type === typeFilter);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Entities</h1>
          <p className="text-gray-400">{scope === 'team' ? 'All team entities' : 'Entities from your data'}</p>
        </div>
        <ScopeToggle scope={scope} onToggle={setScope} mineLabel="My Entities" teamLabel="All Entities" />
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-200 px-4 py-3 rounded-lg">{error}</div>
      )}

      {!loading && entities.length > 0 && types.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
              typeFilter === 'all' ? 'bg-white text-black border-white' : 'bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-600'
            }`}
          >
            All ({entities.length})
          </button>
          {types.map(type => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                typeFilter === type ? 'bg-white text-black border-white' : getEntityTypeColor(type) + ' hover:opacity-80'
              }`}
            >
              {getEntityIcon(type)} {type} ({entities.filter(e => e.type === type).length})
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="text-center py-8"><p className="text-gray-400">Loading entities...</p></div>
      )}

      {!loading && filteredEntities.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">Entities ({filteredEntities.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEntities.map((entity) => (
              <div key={entity.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white">{getEntityIcon(entity.type)} {entity.canonicalName}</h3>
                    {entity.role && (
                      <p className="text-sm text-gray-400 mt-1">{entity.role}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-medium px-3 py-1 rounded-full border ${getEntityTypeColor(entity.type)}`}>
                    {entity.type}
                  </span>
                  <span className="text-sm font-medium text-gray-400">{entity.mentionCount} mention{entity.mentionCount !== 1 ? 's' : ''}</span>
                </div>
                {entity.lastSeen && (
                  <p className="text-xs text-gray-500 mt-2">Last seen: {new Date(entity.lastSeen).toLocaleDateString()}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && filteredEntities.length === 0 && !error && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg mb-2">No entities found yet</p>
          <p className="text-gray-500 text-sm">Entities are automatically extracted when you sync data sources. Make sure you have an Anthropic API key configured in Settings.</p>
        </div>
      )}
    </div>
  );
}
