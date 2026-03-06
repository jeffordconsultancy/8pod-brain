'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, FormEvent, useEffect } from 'react';

const brainChips = ['Ops report', 'Team alignment', 'Brief draft', 'Weekly sync'];
const atlasChips = ['F1 activation', 'Chelsea Women', 'Parley Series A', 'New rights package'];

const brainCards = [
  { icon: '⚙', title: 'Ops Sync', desc: 'Align team pipelines and active workstreams in real time', href: '/brain/connections' },
  { icon: '◈', title: 'Brief Intelligence', desc: 'Draft and refine internal strategic documents with context', href: '/brain/knowledge' },
  { icon: '⟐', title: 'System Connectors', desc: 'Manage integrations and data flows across the 8pod stack', href: '/brain/connections' },
];

const atlasCards = [
  { icon: '◎', title: 'Rights Package', desc: 'View and manage live rights package lifecycles and phases', href: '/atlas' },
  { icon: '◉', title: 'Forecaster', desc: 'Launch four-phase value-creation intelligence for any brief', href: '/atlas/forecaster/new' },
  { icon: '⊕', title: 'Live Integrations', desc: 'Super Group · BBC Quest · F1 strategic layer · Sovereign', href: '/atlas' },
];

export default function Console() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [command, setCommand] = useState('');
  const [mode, setMode] = useState<'brain' | 'atlas'>('brain');
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 bg-console-bg flex items-center justify-center">
        <div className="text-text-dim text-sm font-mono">Loading...</div>
      </div>
    );
  }

  if (!session) {
    router.replace('/login');
    return null;
  }

  function handleCommand(e: FormEvent) {
    e.preventDefault();
    const cmd = command.toLowerCase().trim();
    if (mode === 'brain') {
      if (cmd.includes('setting') || cmd.includes('key') || cmd.includes('config')) {
        router.push('/brain/settings');
      } else if (cmd.includes('query') || cmd.includes('ask') || cmd.includes('search')) {
        router.push('/brain/query');
      } else {
        router.push('/brain');
      }
    } else {
      if (cmd.includes('new') || cmd.includes('forecast') || cmd.includes('package')) {
        router.push('/atlas/forecaster/new');
      } else {
        router.push('/atlas');
      }
    }
  }

  function handleChipClick(chip: string) {
    setCommand(chip);
    if (mode === 'brain') {
      router.push('/brain');
    } else {
      router.push('/atlas/forecaster/new');
    }
  }

  const chips = mode === 'brain' ? brainChips : atlasChips;
  const cards = mode === 'brain' ? brainCards : atlasCards;

  return (
    <div className="fixed inset-0 bg-console-bg flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-console-border">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-text-primary tracking-wide">8pod</span>
          <span className="text-text-dim">|</span>
          <span className="text-xs font-mono tracking-widest text-text-muted">{mode.toUpperCase()}</span>
        </div>

        <div className="flex items-center bg-console-surface rounded-full p-1 gap-1">
          <button
            onClick={() => setMode('brain')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all ${
              mode === 'brain'
                ? 'bg-console-card text-accent-teal shadow-glow-teal'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${mode === 'brain' ? 'bg-accent-teal animate-pulse-dot' : 'bg-text-dim'}`} />
            BRAIN
          </button>
          <button
            onClick={() => setMode('atlas')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all ${
              mode === 'atlas'
                ? 'bg-console-card text-accent-teal shadow-glow-teal'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${mode === 'atlas' ? 'bg-accent-teal animate-pulse-dot' : 'bg-text-dim'}`} />
            ATLAS
          </button>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-console-surface rounded-lg border border-console-border">
          <span className="w-2 h-2 rounded-full bg-accent-teal animate-pulse-dot" />
          <span className="text-xs font-mono text-text-muted tracking-wide">SYSTEM ONLINE</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-16">
        {/* Infinity logo */}
        <div className="text-accent-teal text-5xl mb-8 font-light">∞</div>

        {/* Hero text */}
        <div className="text-center mb-12">
          {mode === 'brain' ? (
            <>
              <h1 className="text-4xl font-light text-text-primary mb-2">
                Internal <em className="text-accent-teal font-light not-italic">intelligence.</em>
              </h1>
              <h2 className="text-4xl font-light text-text-primary">Unified context.</h2>
              <p className="text-text-secondary mt-6 max-w-lg mx-auto">
                Organisational alignment, operational intelligence and active pipeline management — in a single command surface.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-4xl font-light text-text-primary mb-2">
                The commercial <em className="text-accent-teal font-light not-italic">engine.</em>
              </h1>
              <h2 className="text-4xl font-light text-text-primary">Rights at scale.</h2>
              <p className="text-text-secondary mt-6 max-w-lg mx-auto">
                Rights packages. Forecaster intelligence. Live activation across Super Group, BBC Quest, F1 and beyond.
              </p>
            </>
          )}
        </div>

        {/* Command input */}
        <form onSubmit={handleCommand} className="w-full max-w-2xl mb-4">
          <div className="relative bg-console-surface border border-console-border rounded-2xl overflow-hidden">
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              className="w-full px-6 py-5 bg-transparent text-text-primary text-lg placeholder-text-muted focus:outline-none font-light italic"
              placeholder="Describe your objective or brief..."
              autoFocus
            />
            <button
              type="submit"
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-accent-teal/20 text-accent-teal rounded-lg hover:bg-accent-teal/30 transition"
            >
              ▶
            </button>
          </div>

          {/* Action chips */}
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleChipClick(chip)}
                className="action-chip"
              >
                {chip}
              </button>
            ))}
            <span className="text-xs font-mono text-text-dim ml-auto tracking-widest">{mode.toUpperCase()}</span>
          </div>
        </form>
      </div>

      {/* Quick Access */}
      <div className="px-8 pb-16">
        <h3 className="text-xs font-mono tracking-[0.3em] text-text-dim mb-4">QUICK ACCESS</h3>
        <div className="grid grid-cols-3 gap-4">
          {cards.map((card) => (
            <button
              key={card.title}
              onClick={() => router.push(card.href)}
              className="console-card p-6 text-left"
            >
              <div className="w-10 h-10 flex items-center justify-center bg-console-surface border border-console-border rounded-lg mb-4 text-lg text-text-muted">
                {card.icon}
              </div>
              <h4 className="text-text-primary font-bold mb-2">{card.title}</h4>
              <p className="text-text-secondary text-sm leading-relaxed">{card.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-2 border-t border-console-border">
        <div className="flex items-center gap-2">
          <span className="text-yellow-600 text-xs">🔒</span>
          <span className="text-xs font-mono text-text-dim">8pod.com/CTRL</span>
        </div>
        <span className="text-xs font-mono text-text-dim">{time}</span>
        <span className="text-xs font-mono text-text-dim">{mode === 'brain' ? 'Brain v1.2' : 'Atlas v1.0'} · Agentic layer</span>
        <span className="text-xs font-mono text-accent-teal-dim">Session encrypted</span>
      </div>
    </div>
  );
}
