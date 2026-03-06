'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function TopNav() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  if (!session) return null;
  if (pathname === '/' || pathname === '/login' || pathname === '/signup') return null;

  const isAtlas = pathname.startsWith('/atlas');
  const isBrain = pathname.startsWith('/brain');
  const modeLabel = isAtlas ? 'ATLAS' : 'BRAIN';

  return (
    <header className="sticky top-0 z-50 bg-console-bg/95 backdrop-blur-sm border-b border-console-border">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Left: Logo + mode label */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold text-text-primary tracking-wide">8pod</span>
            <span className="text-text-dim">|</span>
            <span className="text-xs font-mono tracking-widest text-text-muted">{modeLabel}</span>
          </Link>
        </div>

        {/* Center: Mode toggle pills */}
        <div className="flex items-center bg-console-surface rounded-full p-1 gap-1">
          <button
            onClick={() => router.push('/brain')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
              isBrain
                ? 'bg-console-card text-accent-teal shadow-glow-teal'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isBrain ? 'bg-accent-teal animate-pulse-dot' : 'bg-text-dim'}`} />
            BRAIN
          </button>
          <button
            onClick={() => router.push('/atlas')}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all cursor-pointer ${
              isAtlas
                ? 'bg-console-card text-accent-teal shadow-glow-teal'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isAtlas ? 'bg-accent-teal animate-pulse-dot' : 'bg-text-dim'}`} />
            ATLAS
          </button>
        </div>

        {/* Right: System status + user */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-console-surface rounded-lg border border-console-border">
            <span className="w-2 h-2 rounded-full bg-accent-teal animate-pulse-dot" />
            <span className="text-xs font-mono text-text-muted tracking-wide">SYSTEM ONLINE</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted">{session.user?.name}</span>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-xs text-text-dim hover:text-red-400 transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
