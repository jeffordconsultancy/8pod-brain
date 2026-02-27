'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const nav = [
  { label: 'Home', href: '/', icon: '🏠' },
  { label: 'Connections', href: '/connections', icon: '🔗' },
  { label: 'Query', href: '/query', icon: '🔍' },
  { label: 'Knowledge', href: '/knowledge', icon: '📚' },
  { label: 'Entities', href: '/entities', icon: '🏢' },
  { label: 'Settings', href: '/settings', icon: '⚙️' },
];

export default function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session) return null;

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col min-h-screen">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-lg font-bold text-white flex items-center gap-2">
          🧠 8pod Brain
        </h1>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
              pathname === item.href
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <span>{item.icon}</span>
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>

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
