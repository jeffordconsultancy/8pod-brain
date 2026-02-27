'use client';

import { useSession } from 'next-auth/react';
import { useState } from 'react';

interface Provider {
  id: string;
  name: string;
  icon: string;
  connected: boolean;
  description: string;
}

const providers: Provider[] = [
  {
    id: 'gmail',
    name: 'Gmail',
    icon: '✉️',
    connected: false,
    description: 'Connect your Gmail account',
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '💬',
    connected: false,
    description: 'Connect your Slack workspace',
  },
  {
    id: 'drive',
    name: 'Google Drive',
    icon: '📁',
    connected: false,
    description: 'Connect your Google Drive',
  },
  {
    id: 'calendar',
    name: 'Google Calendar',
    icon: '📅',
    connected: false,
    description: 'Connect your Google Calendar',
  },
  {
    id: 'github',
    name: 'GitHub',
    icon: '🐙',
    connected: false,
    description: 'Connect your GitHub account',
  },
];

export default function Connections() {
  const { data: session, status } = useSession();
  const [providersList, setProvidersList] = useState(providers);

  if (status === 'loading') return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-gray-400">Loading...</p></div>;

  const handleConnect = (providerId: string) => {
    // In a real app, this would open OAuth flow
    setProvidersList(
      providersList.map((p) =>
        p.id === providerId ? { ...p, connected: true } : p
      )
    );
  };

  const handleDisconnect = (providerId: string) => {
    setProvidersList(
      providersList.map((p) =>
        p.id === providerId ? { ...p, connected: false } : p
      )
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Connections</h1>
        <p className="text-gray-400">
          Manage your connected data sources and integrations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {providersList.map((provider) => (
          <div
            key={provider.id}
            className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="text-4xl">{provider.icon}</div>
              <div
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  provider.connected
                    ? 'bg-green-900/30 text-green-200 border border-green-700'
                    : 'bg-gray-800 text-gray-300 border border-gray-700'
                }`}
              >
                {provider.connected ? '✓ Connected' : 'Not connected'}
              </div>
            </div>

            <h3 className="text-lg font-bold text-white mb-2">{provider.name}</h3>
            <p className="text-gray-400 text-sm mb-6">{provider.description}</p>

            <button
              onClick={() =>
                provider.connected
                  ? handleDisconnect(provider.id)
                  : handleConnect(provider.id)
              }
              className={`w-full py-2 px-4 rounded-lg font-medium transition ${
                provider.connected
                  ? 'bg-red-900/30 text-red-200 border border-red-700 hover:bg-red-900/50'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {provider.connected ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
