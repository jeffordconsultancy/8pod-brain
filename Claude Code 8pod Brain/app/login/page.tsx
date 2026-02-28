'use client';

import { signIn } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [bootSequence, setBootSequence] = useState(true);
  const [bootLines, setBootLines] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    const lines = [
      'Initializing 8pod OS v3.0...',
      'Loading kernel modules...',
      'Establishing secure connection...',
      'Mounting intelligence layer...',
      'System ready. Awaiting authentication.',
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < lines.length) {
        setBootLines(prev => [...prev, lines[i]]);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => setBootSequence(false), 400);
      }
    }, 300);
    return () => clearInterval(interval);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('Invalid credentials. Access denied.');
      setLoading(false);
    } else {
      router.push('/ctrl');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden console-grid">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md mx-4 animate-fade-in">
        {/* Logo / System ID */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-console-accent/10 border border-console-accent/30 flex items-center justify-center">
              <span className="text-console-accent font-bold text-lg">8</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">8pod</h1>
              <p className="text-xs tracking-[0.3em] uppercase text-console-muted">OS / CTRL</p>
            </div>
          </div>
        </div>

        {/* Boot sequence */}
        {bootSequence && (
          <div className="bg-console-surface border border-console-border rounded-xl p-6 mb-6 font-mono text-xs">
            {bootLines.map((line, i) => (
              <div key={i} className="flex items-center gap-2 mb-1 animate-fade-in">
                <span className="text-console-accent">{'>'}</span>
                <span className="text-console-text-dim">{line}</span>
                {i === bootLines.length - 1 && (
                  <span className="cursor-blink text-console-accent ml-1">_</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Login form */}
        {!bootSequence && (
          <div className="animate-slide-up">
            <div className="bg-console-surface border border-console-border rounded-xl p-8 glow-blue">
              <div className="flex items-center gap-2 mb-6">
                <span className="status-dot status-active" />
                <span className="text-xs font-mono text-console-muted uppercase tracking-wider">Secure Authentication</span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-console-text-dim uppercase tracking-wider mb-2">
                    Identity
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-console-bg border border-console-border rounded-lg text-white placeholder-console-muted focus:border-console-accent transition-colors"
                    placeholder="operator@8pod.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-console-text-dim uppercase tracking-wider mb-2">
                    Access Key
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-console-bg border border-console-border rounded-lg text-white placeholder-console-muted focus:border-console-accent transition-colors"
                    placeholder="Enter secure passphrase"
                    required
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-console-accent hover:bg-blue-600 disabled:opacity-50 text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Access Console</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            </div>

            <p className="text-center mt-6 text-sm text-console-muted">
              No credentials?{' '}
              <a href="/signup" className="text-console-accent hover:text-blue-400 transition-colors">
                Request access
              </a>
            </p>

            {/* System footer */}
            <div className="text-center mt-8 text-xs font-mono text-console-muted/50">
              8pod OS v3.0 | Proprietary Infrastructure | Encrypted
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
