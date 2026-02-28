'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export default function Settings() {
  const { data: session, status } = useSession();
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicMasked, setAnthropicMasked] = useState<string | null>(null);
  const [openaiMasked, setOpenaiMasked] = useState<string | null>(null);
  const [anthropicConfigured, setAnthropicConfigured] = useState(false);
  const [openaiConfigured, setOpenaiConfigured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [loading, setLoading] = useState(true);

  const workspaceId = (session as any)?.workspaceId;

  useEffect(() => {
    if (status === 'authenticated' && workspaceId) {
      fetchKeyStatus();
    }
  }, [status, workspaceId]);

  async function fetchKeyStatus() {
    try {
      const res = await fetch(`/api/settings/keys?workspace=${workspaceId}`);
      if (res.ok) {
        const data = await res.json();
        setAnthropicConfigured(data.anthropic?.configured || false);
        setAnthropicMasked(data.anthropic?.maskedKey || null);
        setOpenaiConfigured(data.openai?.configured || false);
        setOpenaiMasked(data.openai?.maskedKey || null);
      }
    } catch (err) {
      console.error('Failed to fetch key status:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveKeys(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;

    setSaving(true);
    setMessage('');

    try {
      const body: Record<string, string> = {};
      if (anthropicKey) body.anthropicApiKey = anthropicKey;
      if (openaiKey) body.openaiApiKey = openaiKey;

      if (Object.keys(body).length === 0) {
        setMessage('Enter at least one API key to save');
        setMessageType('error');
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/settings/keys?workspace=${workspaceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setMessage('API keys saved successfully');
        setMessageType('success');
        setAnthropicKey('');
        setOpenaiKey('');
        await fetchKeyStatus();
      } else {
        const data = await res.json();
        setMessage(data.error || 'Failed to save keys');
        setMessageType('error');
      }
    } catch (err) {
      setMessage('An error occurred while saving keys');
      setMessageType('error');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 5000);
    }
  }

  async function handleRemoveKey(provider: 'anthropic' | 'openai') {
    if (!workspaceId) return;
    setSaving(true);

    try {
      const body: Record<string, null> = {};
      if (provider === 'anthropic') body.anthropicApiKey = null;
      if (provider === 'openai') body.openaiApiKey = null;

      const res = await fetch(`/api/settings/keys?workspace=${workspaceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setMessage(`${provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} key removed`);
        setMessageType('success');
        await fetchKeyStatus();
      }
    } catch (err) {
      setMessage('Failed to remove key');
      setMessageType('error');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 5000);
    }
  }

  if (status === 'loading' || !session || loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-gray-400">Loading...</p></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">Manage your account and API keys</p>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-lg ${
          messageType === 'success'
            ? 'bg-green-900/30 border border-green-700 text-green-200'
            : 'bg-red-900/30 border border-red-700 text-red-200'
        }`}>
          {message}
        </div>
      )}

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
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-2">API Keys</h2>
        <p className="text-gray-400 text-sm mb-6">
          Enter your own API keys to power the AI query engine. Keys are encrypted and stored securely.
        </p>

        <form onSubmit={handleSaveKeys} className="space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">Anthropic API Key (Claude)</label>
              {anthropicConfigured && (
                <span className="text-xs text-green-400 flex items-center gap-1">✓ Configured</span>
              )}
            </div>
            {anthropicMasked && (
              <div className="flex items-center gap-2 mb-2">
                <code className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">{anthropicMasked}</code>
                <button type="button" onClick={() => handleRemoveKey('anthropic')}
                  className="text-xs text-red-400 hover:text-red-300">Remove</button>
              </div>
            )}
            <input
              type="password"
              value={anthropicKey}
              onChange={(e) => setAnthropicKey(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-600"
              placeholder={anthropicConfigured ? 'Enter new key to replace...' : 'sk-ant-...'}
            />
            <p className="text-xs text-gray-500 mt-1">
              Get your key from{' '}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300">console.anthropic.com</a>
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">OpenAI API Key</label>
              {openaiConfigured && (
                <span className="text-xs text-green-400 flex items-center gap-1">✓ Configured</span>
              )}
            </div>
            {openaiMasked && (
              <div className="flex items-center gap-2 mb-2">
                <code className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">{openaiMasked}</code>
                <button type="button" onClick={() => handleRemoveKey('openai')}
                  className="text-xs text-red-400 hover:text-red-300">Remove</button>
              </div>
            )}
            <input
              type="password"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-600"
              placeholder={openaiConfigured ? 'Enter new key to replace...' : 'sk-...'}
            />
            <p className="text-xs text-gray-500 mt-1">
              Get your key from{' '}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300">platform.openai.com</a>
            </p>
          </div>

          <button type="submit" disabled={saving || (!anthropicKey && !openaiKey)}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
            {saving ? 'Saving...' : 'Save API Keys'}
          </button>
        </form>
      </div>
    </div>
  );
}
