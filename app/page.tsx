'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, FormEvent } from 'react';

export default function Console() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [command, setCommand] = useState('');

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading...</div>
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
    if (cmd.includes('brain') || cmd.includes('knowledge') || cmd.includes('email') || cmd.includes('sync') || cmd.includes('connect')) {
      router.push('/brain');
    } else if (cmd.includes('atlas') || cmd.includes('forecast') || cmd.includes('sponsor') || cmd.includes('rights') || cmd.includes('package')) {
      router.push('/atlas');
    } else if (cmd.includes('setting') || cmd.includes('key') || cmd.includes('config')) {
      router.push('/brain/settings');
    } else if (cmd.includes('query') || cmd.includes('ask') || cmd.includes('search')) {
      router.push('/brain/query');
    } else {
      router.push('/brain');
    }
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-16 text-center">
        <h1 className="text-5xl font-extralight text-white tracking-widest mb-2">
          8pod
        </h1>
        <div className="text-[10px] uppercase tracking-[0.4em] text-gray-600">
          OS / CTRL
        </div>
      </div>

      {/* Command prompt */}
      <form onSubmit={handleCommand} className="w-full max-w-2xl mb-16">
        <div className="relative">
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            className="w-full px-6 py-4 bg-transparent border border-gray-800 rounded-2xl text-white text-lg placeholder-gray-600 focus:outline-none focus:border-gray-600 transition"
            placeholder="What would you like to do?"
            autoFocus
          />
          <button
            type="submit"
            className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-2 text-gray-500 hover:text-white transition text-sm"
          >
            &rarr;
          </button>
        </div>
      </form>

      {/* Mode selector */}
      <div className="flex gap-6">
        <button
          onClick={() => router.push('/brain')}
          className="group relative px-10 py-6 border border-gray-800 rounded-2xl hover:border-gray-600 transition bg-transparent"
        >
          <div className="text-2xl mb-2">&#x1F9E0;</div>
          <div className="text-white text-lg font-light tracking-wide">Brain</div>
          <div className="text-gray-600 text-xs mt-1">Internal Operations</div>
        </button>

        <button
          onClick={() => router.push('/atlas')}
          className="group relative px-10 py-6 border border-gray-800 rounded-2xl hover:border-gray-600 transition bg-transparent"
        >
          <div className="text-2xl mb-2">&#x1F30D;</div>
          <div className="text-white text-lg font-light tracking-wide">Atlas</div>
          <div className="text-gray-600 text-xs mt-1">Commercial Engine</div>
        </button>
      </div>

      {/* User info */}
      <div className="absolute bottom-6 text-gray-700 text-xs">
        {session.user?.name} &middot; {session.user?.email}
      </div>
    </div>
  );
}
