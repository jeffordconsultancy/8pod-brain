'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

const NAV_ITEMS = [
  {
    label: 'Console',
    href: '/ctrl',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    exact: true,
  },
  {
    label: 'Brain',
    href: '/ctrl/brain',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    description: 'Internal Operations',
  },
  {
    label: 'Atlas',
    href: '/ctrl/atlas',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    description: 'Commercial Engine',
  },
  {
    label: 'Connections',
    href: '/ctrl/connections',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    description: 'Data Sources',
  },
  {
    label: 'Settings',
    href: '/ctrl/settings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    description: 'System Config',
  },
];

export default function ConsoleSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  function isActive(item: typeof NAV_ITEMS[0]) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  return (
    <aside className="w-64 h-screen bg-console-surface border-r border-console-border flex flex-col fixed left-0 top-0 z-40">
      {/* System header */}
      <div className="p-5 border-b border-console-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-console-accent/10 border border-console-accent/30 flex items-center justify-center">
            <span className="text-console-accent font-bold">8</span>
          </div>
          <div>
            <h2 className="font-semibold text-white text-sm">8pod OS</h2>
            <p className="text-[10px] tracking-[0.2em] uppercase text-console-muted">CTRL Console</p>
          </div>
        </div>
      </div>

      {/* System status */}
      <div className="px-5 py-3 border-b border-console-border">
        <div className="flex items-center gap-2">
          <span className="status-dot status-active" />
          <span className="text-xs font-mono text-console-muted">System Online</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto">
        <div className="space-y-1">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                isActive(item)
                  ? 'bg-console-accent/10 text-console-accent border border-console-accent/20'
                  : 'text-console-text-dim hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <span className={isActive(item) ? 'text-console-accent' : 'text-console-muted group-hover:text-white'}>
                {item.icon}
              </span>
              <div>
                <span className="text-sm font-medium block">{item.label}</span>
                {item.description && (
                  <span className="text-[10px] text-console-muted">{item.description}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-console-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-console-accent/20 flex items-center justify-center flex-shrink-0">
              <span className="text-console-accent text-xs font-bold">
                {session?.user?.name?.[0]?.toUpperCase() || 'O'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-white truncate">{session?.user?.name || 'Operator'}</p>
              <p className="text-[10px] text-console-muted truncate">{session?.user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-console-muted hover:text-red-400 transition-colors p-1"
            title="Sign out"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
