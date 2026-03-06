'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

interface ConnectionData {
  id: string;
  provider: string;
  status: string;
  accountEmail?: string;
  lastSyncAt?: string;
  recordsSynced: number;
  errorMessage?: string;
  createdById?: string;
  createdBy?: { id: string; name?: string; email: string };
  autoSyncEnabled?: boolean;
  syncIntervalMin?: number;
  nextSyncAt?: string;
}

const providers = [
  { id: 'gmail', name: 'Gmail', icon: '✉', description: 'Connect your Gmail to index emails and conversations', syncSupported: true },
  { id: 'slack', name: 'Slack', icon: '◎', description: 'Connect your Slack workspace for messaging data', syncSupported: false },
  { id: 'google-drive', name: 'Google Drive', icon: '◈', description: 'Connect Google Drive to index documents', syncSupported: true },
  { id: 'google-calendar', name: 'Google Calendar', icon: '◉', description: 'Connect Google Calendar for event data', syncSupported: true },
  { id: 'github', name: 'GitHub', icon: '⟐', description: 'Connect GitHub for repository and issue data', syncSupported: false },
];

const SYNC_INTERVALS = [
  { label: 'Every hour', value: 60 },
  { label: 'Every 6 hours', value: 360 },
  { label: 'Daily', value: 1440 },
];

export default function Connections() {
  const { data: session, status } = useSession();
  const [connections, setConnections] = useState<ConnectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState('');
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const workspaceId = (session as any)?.workspaceId;
  const currentUserId = (session?.user as any)?.id;

  useEffect(() => {
    if (status === 'authenticated' && workspaceId) fetchConnections();
  }, [status, workspaceId]);

  async function fetchConnections() {
    try {
      const res = await fetch(`/api/connections?workspace=${workspaceId}`);
      if (res.ok) setConnections(await res.json());
    } catch (err) {
      console.error('Failed to fetch connections:', err);
    } finally {
      setLoading(false);
    }
  }

  function getMyConnection(providerId: string): ConnectionData | undefined {
    const providerMap: Record<string, string> = { 'gmail': 'GMAIL', 'slack': 'SLACK', 'google-drive': 'GOOGLE_DRIVE', 'google-calendar': 'GOOGLE_CALENDAR', 'github': 'GITHUB' };
    return connections.find(c => c.provider === providerMap[providerId] && c.status === 'ACTIVE' && c.createdById === currentUserId);
  }

  function getTeamConnections(providerId: string): ConnectionData[] {
    const providerMap: Record<string, string> = { 'gmail': 'GMAIL', 'slack': 'SLACK', 'google-drive': 'GOOGLE_DRIVE', 'google-calendar': 'GOOGLE_CALENDAR', 'github': 'GITHUB' };
    return connections.filter(c => c.provider === providerMap[providerId] && c.status === 'ACTIVE' && c.createdById !== currentUserId);
  }

  function handleConnect(providerId: string) {
    if (!workspaceId) return;
    window.location.href = `/api/oauth/connect/${providerId}?workspace=${workspaceId}&userId=${currentUserId}`;
  }

  async function handleDisconnect(connectionId: string) {
    setDisconnecting(connectionId);
    try {
      const res = await fetch(`/api/connections?id=${connectionId}`, { method: 'DELETE' });
      if (res.ok) await fetchConnections();
    } finally {
      setDisconnecting(null);
    }
  }

  async function handleSync(connectionId: string) {
    setSyncing(connectionId);
    setSyncMessage('');
    try {
      const res = await fetch(`/api/connections/${connectionId}/sync`, { method: 'POST' });
      const data = await res.json();
      setSyncMessage(res.ok ? `✓ ${data.message}` : `✗ ${data.error || 'Sync failed'}`);
      await fetchConnections();
    } catch {
      setSyncMessage('✗ Sync failed');
    } finally {
      setSyncing(null);
      setTimeout(() => setSyncMessage(''), 8000);
    }
  }

  async function handleAutoSyncToggle(connectionId: string, currentState: boolean, interval?: number) {
    try {
      await fetch(`/api/connections/${connectionId}/auto-sync`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoSyncEnabled: !currentState, syncIntervalMin: interval }),
      });
      await fetchConnections();
    } catch {
      setSyncMessage('✗ Failed to update auto-sync');
    }
  }

  async function handleIntervalChange(connectionId: string, interval: number) {
    try {
      await fetch(`/api/connections/${connectionId}/auto-sync`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoSyncEnabled: true, syncIntervalMin: interval }),
      });
      await fetchConnections();
    } catch {
      setSyncMessage('✗ Failed to update interval');
    }
  }

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-text-muted font-mono text-sm">Loading...</p></div>;
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">System Connectors</h1>
        <p className="text-text-secondary">Connect your data sources. Connected data flows into your personal brain and the shared workspace brain.</p>
      </div>

      {/* Shared Brain notice */}
      <div className="console-card p-4 border-accent-teal/20">
        <div className="flex items-start gap-3">
          <span className="text-accent-teal text-lg">∞</span>
          <div>
            <h4 className="text-text-primary font-medium text-sm">Shared Brain</h4>
            <p className="text-text-muted text-xs mt-0.5">
              When you connect and sync a data source, your records become available to the shared workspace brain.
              You can mark individual records as confidential in the Knowledge page to prevent sharing.
              Auto-sync keeps your data fresh automatically.
            </p>
          </div>
        </div>
      </div>

      {syncMessage && (
        <div className={`px-4 py-3 rounded-lg text-sm ${
          syncMessage.startsWith('✓')
            ? 'bg-accent-teal/10 border border-accent-teal/20 text-accent-teal'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {syncMessage}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8"><p className="text-text-muted font-mono text-sm">Loading connections...</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((provider) => {
            const myConnection = getMyConnection(provider.id);
            const teamConns = getTeamConnections(provider.id);
            const isConnected = !!myConnection;

            return (
              <div key={provider.id} className="console-card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 flex items-center justify-center bg-console-surface border border-console-border rounded-lg text-lg text-text-muted">
                    {provider.icon}
                  </div>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded border ${
                    isConnected ? 'badge-pass' : 'bg-console-surface text-text-dim border-console-border'
                  }`}>
                    {isConnected ? '✓ Connected' : 'Not connected'}
                  </span>
                </div>

                <h3 className="text-text-primary font-bold mb-1">{provider.name}</h3>
                <p className="text-text-muted text-sm mb-3">{provider.description}</p>

                {isConnected && myConnection?.accountEmail && (
                  <p className="text-xs text-text-dim font-mono mb-1">Account: {myConnection.accountEmail}</p>
                )}
                {isConnected && myConnection?.lastSyncAt && (
                  <p className="text-xs text-text-dim font-mono mb-1">
                    Last sync: {new Date(myConnection.lastSyncAt).toLocaleDateString()} · {myConnection.recordsSynced} records
                  </p>
                )}
                {isConnected && !myConnection?.lastSyncAt && (
                  <p className="text-xs text-yellow-400 font-mono mb-1">Connected — not synced yet</p>
                )}
                {myConnection?.errorMessage && (
                  <p className="text-xs text-red-400 font-mono mb-1">{myConnection.errorMessage}</p>
                )}

                {/* Auto-sync controls */}
                {isConnected && provider.syncSupported && (
                  <div className="mt-3 pt-3 border-t border-console-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-text-muted">Auto-sync</span>
                      <button
                        onClick={() => handleAutoSyncToggle(myConnection!.id, myConnection!.autoSyncEnabled || false)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          myConnection!.autoSyncEnabled ? 'bg-accent-teal' : 'bg-console-muted'
                        }`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          myConnection!.autoSyncEnabled ? 'translate-x-5' : ''
                        }`} />
                      </button>
                    </div>
                    {myConnection!.autoSyncEnabled && (
                      <>
                        <div className="flex gap-1">
                          {SYNC_INTERVALS.map(si => (
                            <button
                              key={si.value}
                              onClick={() => handleIntervalChange(myConnection!.id, si.value)}
                              className={`px-2 py-1 rounded text-xs font-mono transition ${
                                myConnection!.syncIntervalMin === si.value
                                  ? 'bg-accent-teal/10 text-accent-teal border border-accent-teal/20'
                                  : 'bg-console-surface text-text-dim border border-console-border hover:text-text-muted'
                              }`}
                            >
                              {si.label}
                            </button>
                          ))}
                        </div>
                        {myConnection!.nextSyncAt && (
                          <p className="text-xs font-mono text-text-dim">
                            Next sync: {new Date(myConnection!.nextSyncAt).toLocaleTimeString()}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Team connections */}
                {teamConns.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-console-border">
                    {teamConns.map(tc => (
                      <p key={tc.id} className="text-xs text-text-dim font-mono mb-1">
                        Team: {tc.createdBy?.name || tc.createdBy?.email || 'teammate'} — {tc.accountEmail || 'connected'}
                        {tc.recordsSynced > 0 && ` · ${tc.recordsSynced} records`}
                      </p>
                    ))}
                  </div>
                )}

                <div className="space-y-2 mt-4">
                  {isConnected && provider.syncSupported && (
                    <button
                      onClick={() => handleSync(myConnection!.id)}
                      disabled={syncing === myConnection!.id}
                      className="w-full py-2 px-4 rounded-lg font-medium transition bg-accent-teal/20 text-accent-teal border border-accent-teal/30 hover:bg-accent-teal/30 disabled:opacity-50 text-sm"
                    >
                      {syncing === myConnection!.id ? 'Syncing...' : 'Sync Now'}
                    </button>
                  )}
                  <button
                    onClick={() => isConnected ? handleDisconnect(myConnection!.id) : handleConnect(provider.id)}
                    disabled={disconnecting === myConnection?.id}
                    className={`w-full py-2 px-4 rounded-lg font-medium transition text-sm ${
                      isConnected
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                        : 'bg-accent-teal/20 text-accent-teal border border-accent-teal/30 hover:bg-accent-teal/30'
                    } disabled:opacity-50`}
                  >
                    {disconnecting === myConnection?.id ? 'Disconnecting...' : isConnected ? 'Disconnect' : 'Connect'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
