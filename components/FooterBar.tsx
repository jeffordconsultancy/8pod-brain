'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export default function FooterBar() {
  const { data: session } = useSession();
  const pathname = usePathname();
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

  if (!session) return null;
  if (pathname === '/' || pathname === '/login' || pathname === '/signup') return null;

  const isAtlas = pathname.startsWith('/atlas');
  const modeVersion = isAtlas ? 'Atlas v1.0' : 'Brain v1.2';

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 bg-console-bg/95 backdrop-blur-sm border-t border-console-border">
      <div className="flex items-center justify-between px-6 py-2">
        <div className="flex items-center gap-2">
          <span className="text-yellow-600 text-xs">🔒</span>
          <span className="text-xs font-mono text-text-dim">8pod.com/CTRL</span>
        </div>
        <span className="text-xs font-mono text-text-dim">{time}</span>
        <span className="text-xs font-mono text-text-dim">{modeVersion} · Agentic layer</span>
        <span className="text-xs font-mono text-accent-teal-dim">Session encrypted</span>
      </div>
    </footer>
  );
}
