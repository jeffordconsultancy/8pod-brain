'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const brainNav = [
  { label: 'Dashboard', href: '/brain' },
  { label: 'Connections', href: '/brain/connections' },
  { label: 'Query', href: '/brain/query' },
  { label: 'Knowledge', href: '/brain/knowledge' },
  { label: 'Entities', href: '/brain/entities' },
  { label: 'Settings', href: '/brain/settings' },
];

const atlasNav = [
  { label: 'Dashboard', href: '/atlas' },
  { label: 'Forecaster', href: '/atlas/forecaster' },
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
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col min-h-screen">
      <div className="p-6 border-b border-gray-800">
        <Link href="/" className="block">
          <h1 className="text-lg font-bold text-white">
            <span className="text-gray-500 font-light tracking-widest">8pod</span>
            <span className="text-gray-700 mx-1">/</span>
            <span>{modeLabel}</span>
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
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="px-3 pb-2 space-y-1">
        <Link
          href={isBrain ? '/atlas' : '/brain'}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition text-sm"
        >
          Switch to {isBrain ? 'Atlas' : 'Brain'}
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-800 hover:text-gray-400 transition text-sm"
        >
          Console
        </Link>
      </div>

      <div className="p-4 border-t border-gray-800">
        <p className="text-sm text-white truncate mb-2">{session.user?.name}</p>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-sm text-red-400 hover:text-red-300"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
