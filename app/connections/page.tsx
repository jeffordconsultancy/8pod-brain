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
}

const providers = [
  { id: 'gmail', name: 'Gmail', icon: '✉️', description: 'Connect your Gmail to index emails and conversations', syncSupported: true },
  { id: 'slack', name: 'Slack', icon: '💬', description: 'Connect your Slack workspace for messaging data', syncSupported: false },
  { id: 'google-drive', name: 'Google Drive', icon: '📁', description: 'Connect Google Drive to index documents', syncSupported: true },
  { id: 'google-calendar', name: 'Google Calendar', icon: '📅', description: 'Connect Google Calendar for event data', syncSupported: true },
  { id: 'github', name: 'GitHub', icon: '🐙', description: 'Connect GitHub for repository and issue data', syncSupported: false },
];

export default function Connections() {
  const { data: session, status } = useSession();
  const [connections, setConnections] = useState<ConnectionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState('');
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  const workspaceId = (session as any)?.workspaceId;

  useEffect(() => {
    if (status === 'authenticated' && workspaceId) {
      fetchConnections();
    }
  }, [status, workspaceId]);

  async function fetchConnections() {
    try {
      const res = await fetch(`/api/connections?workspace=${workspaceId}`);
      if (res.ok) {
        const data = await res.json();
        setConnections(data);
      }
    } catch (err) {
      console.error('Failed to fetch connections:', err);
    } finally {
      setLoading(false);
    }
  }

  function getConnection(providerId: string): ConnectionData | undefined {
    const providerMap: Record<string, string> = {
      'gmail': 'GMAIL',
      'slack': 'SLACK',
      'google-drive': 'GOOGLE_DRIVE',
      'google-calendar': 'GOOGLE_CALENDAR',
      'github': 'GITHUB',
    };
    return connections.find(c => c.provider === providerMap[providerId] && c.status === 'ACTIVE');
  }

  function handleConnect(providerId: string) {
    if (!workspaceId) return;
    window.location.href = `/api/oauth/connect/${providerId}?workspace=${workspaceId}`;
  }

  async function handleDisconnect(connectionId: string) {
    setDisconnecting(connectionId);
    try {
      const res = await fetch(`/api/connections?id=${connectionId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchConnections();
      }
    } catch (err) {
      console.error('Failed to disconnect:', err);
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
      if (res.ok) {
        setSyncMessage(`✓ ${data.message}`);
        await fetchConnections();
      } else {
        setSyncMessage(`✗ ${data.error || 'Sync failed'}`);
      }
    } catch (err) {
      setSyncMessage('✗ Sync failed — check console for details');
    } finally {
      setSyncing(null);
      setTimeout(() => setSyncMessage(''), 8000);
    }
  }

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-gray-400">Loading...</p></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Connections</h1>
        <p className="text-gray-400">Connect your data sources to start building your knowledge base</p>
      </div>

      {syncMessage && (
        <div className={`px-4 py-3 rounded-lg ${
          syncMessage.startsWith('✓')
            ? 'bg-green-900/30 border border-green-700 text-green-200'
            : 'bg-red-900/30 border border-red-700 text-red-200'
        }`}>
          {syncMessage}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8"><p className="text-gray-400">Loading connections...</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {providers.map((provider) => {
            const connection = getConnection(provider.id);
            const isConnected = !!connection;

            return (
              <div key={provider.id} className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition">
                <div className="flex items-start justify-between mb-4">
                  <div className="text-4xl">{provider.icon}</div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    isConnected
                      ? 'bg-green-900/30 text-green-200 border border-green-700'
                      : 'bg-gray-800 text-gray-300 border border-gray-700'
                  }`}>
                    {isConnected ? '✓ Connected' : 'Not connected'}
                  </div>
                </div>

                <h3 className="text-lg font-bold text-white mb-2">{provider.name}</h3>
                <p className="text-gray-400 text-sm mb-4">{provider.description}</p>

                {isConnected && connection?.accountEmail && (
                  <p className="text-xs text-gray-500 mb-2">Connected as: {connection.accountEmail}</p>
                )}

                {isConnected && connection?.lastSyncAt && (
                  <p className="text-xs text-gray-500 mb-2">
                    Last sync: {new Date(connection.lastSyncAt).toLocaleDateString()} · {connection.recordsSynced} records
                  </p>
                )}

                {isConnected && !connection?.lastSyncAt && (
                  <p className="text-xs text-yellow-400 mb-2">Connected — not synced yet</p>
                )}

                {connection?.errorMessage && (
                  <p className="text-xs text-red-400 mb-2">{connection.errorMessage}</p>
                )}

                <div className="space-y-2 mt-4">
                  {isConnected && provider.syncSupported && (
                    <button
                      onClick={() => handleSync(connection!.id)}
                      disabled={syncing === connection!.id}
                      className="w-full py-2 px-4 rounded-lg font-medium transition bg-green-700 text-white hover:bg-green-600 disabled:opacity-50"
                    >
                      {syncing === connection!.id ? 'Syncing...' : 'Sync Now'}
                    </button>
                  )}

                  <button
                    onClick={() => isConnected ? handleDisconnect(connection!.id) : handleConnect(provider.id)}
                    disabled={disconnecting === connection?.id}
                    className={`w-full py-2 px-4 rounded-lg font-medium transition ${
                      isConnected
                        ? 'bg-red-900/30 text-red-200 border border-red-700 hover:bg-red-900/50'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    } disabled:opacity-50`}
                  >
                    {disconnecting === connection?.id ? 'Disconnecting...' : isConnected ? 'Disconnect' : 'Connect'}
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
