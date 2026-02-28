'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const EXAMPLE_PROMPTS = [
  'Show me all upcoming meetings this week with external stakeholders',
  'What were the key discussion points in the latest F1 rights package emails?',
  'Summarize all documents related to Chelsea Women partnership',
  'Who are the most mentioned people across our recent communications?',
];

const MODULES = [
  {
    id: 'brain',
    label: 'Brain',
    description: 'Internal Operations — Agentic layer for organizational alignment',
    href: '/ctrl/brain',
    color: 'blue',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    status: 'online',
  },
  {
    id: 'atlas',
    label: 'Atlas',
    description: 'Commercial Engine — Rights packages, System 1 & 2, Forecaster',
    href: '/ctrl/atlas',
    color: 'emerald',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    status: 'online',
  },
];

export default function ConsolePage() {
  const { data: session } = useSession();
  const [command, setCommand] = useState('');
  const [processing, setProcessing] = useState(false);
  const router = useRouter();
  const workspaceId = (session as any)?.workspaceId;

  async function handleCommand(e: React.FormEvent) {
    e.preventDefault();
    if (!command.trim()) return;

    setProcessing(true);

    // Route command to Brain by default (query engine)
    router.push(`/ctrl/brain?q=${encodeURIComponent(command.trim())}`);
  }

  function handleExampleClick(prompt: string) {
    setCommand(prompt);
  }

  return (
    <div className="min-h-screen flex flex-col console-grid relative">
      {/* Ambient effect */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main content - centered command area */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 pb-32">
        {/* Greeting */}
        <div className="text-center mb-10 animate-fade-in">
          <h1 className="text-4xl font-bold text-white mb-2">
            8pod <span className="text-gradient">CTRL</span>
          </h1>
          <p className="text-console-text-dim text-lg">
            Welcome back, {session?.user?.name?.split(' ')[0] || 'Operator'}
          </p>
        </div>

        {/* Central command prompt */}
        <div className="w-full max-w-2xl animate-slide-up">
          <form onSubmit={handleCommand}>
            <div className="relative group">
              <div className="absolute inset-0 bg-console-accent/5 rounded-2xl blur-xl group-focus-within:bg-console-accent/10 transition-all duration-500" />
              <div className="relative bg-console-surface border border-console-border rounded-2xl p-2 group-focus-within:border-console-accent/40 transition-all duration-300 glow-blue">
                <div className="flex items-center gap-3 px-4">
                  <svg className="w-5 h-5 text-console-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <input
                    type="text"
                    value={command}
                    onChange={e => setCommand(e.target.value)}
                    placeholder="Enter command or ask a question..."
                    className="flex-1 bg-transparent border-none py-4 text-white placeholder-console-muted focus:outline-none text-lg"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={processing || !command.trim()}
                    className="px-5 py-2.5 bg-console-accent hover:bg-blue-600 disabled:opacity-30 text-white text-sm font-medium rounded-xl transition-all"
                  >
                    {processing ? (
                      <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Example prompts */}
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            {EXAMPLE_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleExampleClick(prompt)}
                className="px-3 py-1.5 text-xs text-console-text-dim bg-console-surface border border-console-border rounded-full hover:border-console-accent/30 hover:text-white transition-all"
              >
                {prompt.length > 50 ? prompt.slice(0, 50) + '...' : prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Module cards */}
        <div className="mt-16 grid grid-cols-2 gap-4 w-full max-w-2xl animate-slide-up">
          {MODULES.map(mod => (
            <Link
              key={mod.id}
              href={mod.href}
              className="group bg-console-surface border border-console-border rounded-xl p-6 hover:border-console-accent/30 transition-all duration-300 hover:glow-blue"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`text-console-muted group-hover:text-console-accent transition-colors`}>
                  {mod.icon}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="status-dot status-active" />
                  <span className="text-[10px] font-mono text-console-muted uppercase">{mod.status}</span>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">{mod.label}</h3>
              <p className="text-sm text-console-text-dim">{mod.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="fixed bottom-0 left-64 right-0 bg-console-surface/80 backdrop-blur-sm border-t border-console-border px-6 py-2 flex items-center justify-between text-xs font-mono text-console-muted">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="status-dot status-active" />
            Connected
          </span>
          <span>Workspace: {workspaceId ? workspaceId.slice(0, 8) + '...' : 'Loading'}</span>
        </div>
        <div className="flex items-center gap-4">
          <span>8pod OS v3.0</span>
          <span>Encrypted</span>
        </div>
      </div>
    </div>
  );
}
