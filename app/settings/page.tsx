'use client';

import { useSession } from 'next-auth/react';
import { useState } from 'react';

interface ApiKey {
  id: string;
  name: string;
  lastUsed?: string;
  masked: string;
}

export default function Settings() {
  const { data: session, status } = useSession();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    {
      id: '1',
      name: 'Development Key',
      lastUsed: '2024-02-25',
      masked: 'sk_test_****...****',
    },
  ]);
  const [showNewKeyForm, setShowNewKeyForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  if (status === 'loading' || !session) return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-gray-400">Loading...</p></div>;

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Simulate API call
      const newKey: ApiKey = {
        id: Date.now().toString(),
        name: newKeyName,
        lastUsed: undefined,
        masked: 'sk_test_****...****',
      };

      setApiKeys([...apiKeys, newKey]);
      setNewKeyName('');
      setShowNewKeyForm(false);
      setMessage('API key created successfully');

      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to create API key');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKey = (id: string) => {
    setApiKeys(apiKeys.filter((key) => key.id !== id));
    setMessage('API key deleted');
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">
          Manage your account settings and API keys
        </p>
      </div>

      {message && (
        <div className="bg-green-900/30 border border-green-700 text-green-200 px-4 py-3 rounded-lg">
          {message}
        </div>
      )}

      <div className="space-y-6">
        {/* Account Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">Account</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-400">Name</label>
              <p className="text-white mt-1">{session.user?.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-400">Email</label>
              <p className="text-white mt-1">{session.user?.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-400">Workspace ID</label>
              <p className="text-white mt-1 font-mono text-xs">
                {(session as any)?.workspaceId || 'Not set'}
              </p>
            </div>
          </div>
        </div>

        {/* API Keys Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">API Keys</h2>
            <button
              onClick={() => setShowNewKeyForm(!showNewKeyForm)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
            >
              {showNewKeyForm ? 'Cancel' : 'Create New Key'}
            </button>
          </div>

          {showNewKeyForm && (
            <form
              onSubmit={handleCreateKey}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6"
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Key Name
                  </label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-600"
                    placeholder="e.g., Production API Key"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !newKeyName}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Key'}
                </button>
              </div>
            </form>
          )}

          {apiKeys.length > 0 ? (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="bg-gray-800 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <p className="font-medium text-white">{key.name}</p>
                    <p className="text-sm text-gray-400 mt-1 font-mono">
                      {key.masked}
                    </p>
                    {key.lastUsed && (
                      <p className="text-xs text-gray-500 mt-2">
                        Last used: {new Date(key.lastUsed).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteKey(key.id)}
                    className="px-3 py-1 text-sm font-medium text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">No API keys created yet</p>
          )}
        </div>

        {/* Preferences Section */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">Preferences</h2>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded bg-gray-800 border border-gray-700"
                defaultChecked
              />
              <span className="text-white">Email notifications</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded bg-gray-800 border border-gray-700"
                defaultChecked
              />
              <span className="text-white">Allow data collection</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
