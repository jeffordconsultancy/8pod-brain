'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', workspaceName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        setLoading(false);
        return;
      }

      router.push('/login');
    } catch {
      setError('Network error. Try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center console-grid">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md mx-4 animate-fade-in">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-console-accent/10 border border-console-accent/30 flex items-center justify-center">
              <span className="text-console-accent font-bold text-lg">8</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">8pod</h1>
              <p className="text-xs tracking-[0.3em] uppercase text-console-muted">Operator Registration</p>
            </div>
          </div>
        </div>

        <div className="bg-console-surface border border-console-border rounded-xl p-8 glow-blue">
          <div className="flex items-center gap-2 mb-6">
            <span className="status-dot status-pending" />
            <span className="text-xs font-mono text-console-muted uppercase tracking-wider">New Operator Setup</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-console-text-dim uppercase tracking-wider mb-2">Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 bg-console-bg border border-console-border rounded-lg text-white placeholder-console-muted focus:border-console-accent transition-colors"
                placeholder="Operator name"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-console-text-dim uppercase tracking-wider mb-2">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 bg-console-bg border border-console-border rounded-lg text-white placeholder-console-muted focus:border-console-accent transition-colors"
                placeholder="operator@8pod.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-console-text-dim uppercase tracking-wider mb-2">Access Key</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-3 bg-console-bg border border-console-border rounded-lg text-white placeholder-console-muted focus:border-console-accent transition-colors"
                placeholder="Secure passphrase"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-console-text-dim uppercase tracking-wider mb-2">Workspace</label>
              <input
                type="text"
                value={form.workspaceName}
                onChange={e => setForm({ ...form, workspaceName: e.target.value })}
                className="w-full px-4 py-3 bg-console-bg border border-console-border rounded-lg text-white placeholder-console-muted focus:border-console-accent transition-colors"
                placeholder="8pod (optional)"
              />
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-console-accent hover:bg-blue-600 disabled:opacity-50 text-white font-medium rounded-lg transition-all"
            >
              {loading ? 'Provisioning...' : 'Create Operator Account'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm text-console-muted">
          Already registered?{' '}
          <a href="/login" className="text-console-accent hover:text-blue-400 transition-colors">
            Access console
          </a>
        </p>
      </div>
    </div>
  );
}
