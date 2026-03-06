'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const brainNav = [
  { label: 'Dashboard', href: '/brain', icon: '◉' },
  { label: 'Connections', href: '/brain/connections', icon: '⟐' },
  { label: 'Knowledge', href: '/brain/knowledge', icon: '◈' },
  { label: 'Query', href: '/brain/query', icon: '⟡' },
  { label: 'Entities', href: '/brain/entities', icon: '⬡' },
  { label: 'Settings', href: '/brain/settings', icon: '⚙' },
];

const atlasNav = [
  { label: 'Dashboard', href: '/atlas', icon: '◉' },
  { label: 'Forecaster', href: '/atlas/forecaster', icon: '◎' },
];

export default function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session) return null;
  if (pathname === '/' || pathname === '/login' || pathname === '/signup') return null;

  const isBrain = pathname.startsWith('/brain');
  const isAtlas = pathname.startsWith('/atlas');
  const nav = isBrain ? brainNav : isAtlas ? atlasNav : brainNav;
  const modeLabel = isAtlas ? 'Atlas' : 'Brain';

  function isActive(href: string): boolean {
    if (href === '/brain' || href === '/atlas') return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-64 bg-console-surface border-r border-console-border flex flex-col min-h-screen">
      <div className="p-6 border-b border-console-border">
        <Link href="/" className="block">
          <h1 className="text-lg font-bold text-text-primary">
            <span className="text-text-muted font-light tracking-widest">8pod</span>
            <span className="text-console-muted mx-1">/</span>
            <span className="text-accent-teal">{modeLabel}</span>
          </h1>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition text-sm font-medium ${
              isActive(item.href)
                ? 'bg-accent-teal/10 text-accent-teal border border-accent-teal/20'
                : 'text-text-secondary hover:bg-console-card hover:text-text-primary'
            }`}
          >
            <span className="text-base opacity-70">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="px-3 pb-2 space-y-1">
        <Link
          href={isBrain ? '/atlas' : '/brain'}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-text-muted hover:bg-console-card hover:text-text-secondary transition text-sm"
        >
          Switch to {isBrain ? 'Atlas' : 'Brain'}
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-text-dim hover:bg-console-card hover:text-text-muted transition text-sm"
        >
          Console
        </Link>
      </div>

      <div className="p-4 border-t border-console-border">
        <p className="text-sm text-text-secondary truncate mb-2">{session.user?.name}</p>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-sm text-red-400/60 hover:text-red-400 transition"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
