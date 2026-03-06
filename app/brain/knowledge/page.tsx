'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import ScopeToggle from '@/components/ScopeToggle';

interface KnowledgeRecord {
  id: string;
  sourceSystem: string;
  sourceId: string;
  contentType: string;
  rawContent: string;
  summary: string;
  createdAt: string;
  isConfidential: boolean;
  metadata?: any;
  contributedBy?: { id: string; name?: string; email: string };
}

const sourceIcons: Record<string, string> = {
  gmail: '✉',
  'google-drive': '◈',
  'google-calendar': '◉',
  slack: '◎',
  github: '⟐',
};

const sourceColors: Record<string, string> = {
  gmail: 'bg-red-400/10 text-red-400 border-red-400/20',
  'google-drive': 'bg-blue-400/10 text-blue-400 border-blue-400/20',
  'google-calendar': 'bg-green-400/10 text-green-400 border-green-400/20',
  slack: 'bg-purple-400/10 text-purple-400 border-purple-400/20',
  github: 'bg-console-surface text-text-muted border-console-border',
};

export default function Knowledge() {
  const { data: session, status } = useSession();
  const [records, setRecords] = useState<KnowledgeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [scope, setScope] = useState<'mine' | 'team'>('mine');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const currentUserId = (session?.user as any)?.id;

  useEffect(() => {
    async function fetchRecords() {
      try {
        const response = await fetch(
          `/api/knowledge?workspace=${(session as any)?.workspaceId}&scope=${scope}&userId=${currentUserId}`
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
  }, [session, status, scope]);

  async function toggleConfidential(recordId: string, currentState: boolean) {
    setTogglingId(recordId);
    try {
      await fetch(`/api/knowledge/${recordId}/confidential`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, isConfidential: !currentState }),
      });
      setRecords(prev => prev.map(r =>
        r.id === recordId ? { ...r, isConfidential: !currentState } : r
      ));
    } catch {
      setError('Failed to update confidentiality');
    } finally {
      setTogglingId(null);
    }
  }

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-text-muted font-mono text-sm">Loading...</p></div>;
  }

  const sources = Array.from(new Set(records.map(r => r.sourceSystem)));
  const filteredRecords = filter === 'all' ? records : records.filter(r => r.sourceSystem === filter);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">Knowledge</h1>
          <p className="text-text-secondary">
            {scope === 'mine' ? 'Your synced knowledge records' : 'Shared team knowledge (confidential records excluded)'}
          </p>
        </div>
        <ScopeToggle scope={scope} onToggle={setScope} />
      </div>

      {/* Shared Brain explainer */}
      {scope === 'team' && (
        <div className="console-card p-4 border-accent-teal/20">
          <div className="flex items-start gap-3">
            <span className="text-accent-teal text-lg">∞</span>
            <div>
              <h4 className="text-text-primary font-medium text-sm">Shared Brain</h4>
              <p className="text-text-muted text-xs mt-0.5">
                All team members' connected data flows into the shared knowledge pot. Records marked as confidential
                by their contributor are excluded — they never appear in shared queries or AI context.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {!loading && records.length > 0 && sources.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-mono border transition ${
              filter === 'all' ? 'bg-accent-teal/10 text-accent-teal border-accent-teal/30' : 'bg-console-surface text-text-muted border-console-border hover:border-console-border-hover'
            }`}
          >
            All ({records.length})
          </button>
          {sources.map(source => (
            <button
              key={source}
              onClick={() => setFilter(source)}
              className={`px-3 py-1 rounded-full text-xs font-mono border transition ${
                filter === source ? 'bg-accent-teal/10 text-accent-teal border-accent-teal/30' : (sourceColors[source] || 'bg-console-surface text-text-muted border-console-border') + ' hover:opacity-80'
              }`}
            >
              {sourceIcons[source] || '◉'} {source} ({records.filter(r => r.sourceSystem === source).length})
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="text-center py-8"><p className="text-text-muted font-mono text-sm">Loading knowledge records...</p></div>
      )}

      {!loading && filteredRecords.length > 0 && (
        <div className="space-y-3">
          {filteredRecords.map((record) => (
            <div
              key={record.id}
              className={`console-card p-5 ${record.isConfidential ? 'border-amber-500/20' : ''}`}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-text-primary font-bold flex-1 mr-4">{record.summary || '(No summary)'}</h3>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Confidentiality toggle — only for contributor */}
                  {scope === 'mine' && record.contributedBy?.id === currentUserId && (
                    <button
                      onClick={() => toggleConfidential(record.id, record.isConfidential)}
                      disabled={togglingId === record.id}
                      title={record.isConfidential ? 'Confidential — click to unlock' : 'Click to mark confidential'}
                      className={`p-1.5 rounded-lg transition text-xs ${
                        record.isConfidential
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
                          : 'bg-console-surface text-text-dim border border-console-border hover:text-text-muted hover:border-console-border-hover'
                      }`}
                    >
                      {record.isConfidential ? '🔒' : '🔓'}
                    </button>
                  )}
                  <span className={`text-xs font-mono px-2 py-0.5 rounded border ${sourceColors[record.sourceSystem] || 'bg-console-surface text-text-muted border-console-border'}`}>
                    {sourceIcons[record.sourceSystem] || '◉'} {record.sourceSystem}
                  </span>
                </div>
              </div>

              {record.isConfidential && (
                <div className="flex items-center gap-2 mb-2 text-xs text-amber-400 font-mono">
                  <span>🔒</span>
                  <span>Confidential — only visible to you. Excluded from shared brain and AI context.</span>
                </div>
              )}

              <p className="text-text-secondary text-sm mb-3 line-clamp-3 whitespace-pre-line">
                {record.rawContent.length > 300 ? record.rawContent.slice(0, 300) + '...' : record.rawContent}
              </p>
              <div className="flex items-center gap-4">
                <p className="text-xs text-text-dim font-mono">
                  {new Date(record.createdAt).toLocaleDateString()} at {new Date(record.createdAt).toLocaleTimeString()}
                </p>
                <span className="text-xs text-text-dim font-mono">{record.contentType}</span>
                {scope === 'team' && record.contributedBy && (
                  <span className="text-xs text-accent-teal-dim font-mono">
                    via {record.contributedBy.name || record.contributedBy.email}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredRecords.length === 0 && !error && (
        <div className="text-center py-12">
          <p className="text-text-muted text-lg mb-2">No knowledge records yet</p>
          <p className="text-text-dim text-sm">Connect a data source and sync to start building your knowledge base</p>
        </div>
      )}
    </div>
  );
}
