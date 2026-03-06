'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';

const cards = [
  { icon: '⟐', title: 'Connections', desc: 'Manage Gmail, Google Drive, Calendar, Slack, and GitHub data sources. Configure auto-sync.', href: '/brain/connections' },
  { icon: '◈', title: 'Knowledge', desc: 'Browse synced records. Mark confidential conversations. View shared brain.', href: '/brain/knowledge' },
  { icon: '⟡', title: 'Query', desc: 'Ask questions about your connected data using AI. Scope to personal or team.', href: '/brain/query' },
  { icon: '⬡', title: 'Entities', desc: 'People, companies, topics extracted automatically from your data.', href: '/brain/entities' },
];

export default function BrainDashboard() {
  const { status } = useSession();

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-text-muted font-mono text-sm">Loading...</p></div>;
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-2">Brain</h1>
        <p className="text-text-secondary">Internal intelligence hub. Connect data sources, build shared knowledge, and query everything.</p>
      </div>

      {/* Shared Brain explanation */}
      <div className="console-card p-5 border-accent-teal/20">
        <div className="flex items-start gap-4">
          <span className="text-accent-teal text-3xl">∞</span>
          <div>
            <h3 className="text-text-primary font-bold mb-1">How Shared Brain Works</h3>
            <p className="text-text-secondary text-sm leading-relaxed">
              When team members connect their data sources (Gmail, Drive, Calendar, etc.), their synced records flow into
              the shared workspace brain. Everyone can query across the full team's knowledge.
              Individual records can be locked as <span className="text-amber-400">confidential</span> — confidential records
              are never visible to others and are excluded from all shared queries and AI context.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="console-card p-6 group">
            <div className="w-10 h-10 flex items-center justify-center bg-console-surface border border-console-border rounded-lg mb-4 text-lg text-text-muted group-hover:text-accent-teal group-hover:border-accent-teal/20 transition">
              {card.icon}
            </div>
            <h2 className="text-text-primary font-bold text-lg mb-2 group-hover:text-accent-teal transition">{card.title}</h2>
            <p className="text-text-secondary text-sm">{card.desc}</p>
          </Link>
        ))}
      </div>

      <Link href="/brain/settings" className="console-card p-4 flex items-center gap-3 group">
        <span className="text-text-muted group-hover:text-accent-teal transition">⚙</span>
        <div>
          <h3 className="text-text-primary font-medium text-sm group-hover:text-accent-teal transition">Settings</h3>
          <p className="text-text-muted text-xs">API keys, team management, workspace configuration</p>
        </div>
      </Link>
    </div>
  );
}
