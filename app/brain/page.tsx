'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';

export default function BrainDashboard() {
  const { status } = useSession();

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-gray-400">Loading...</p></div>;
  }

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Brain</h1>
        <p className="text-gray-400">Your internal operations hub. Connect data sources, build knowledge, extract entities, and query everything.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/brain/connections" className="p-6 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition">
          <h2 className="text-xl font-bold text-white mb-2">Connections</h2>
          <p className="text-gray-400 text-sm">Manage Gmail, Google Drive, Calendar, and other data sources</p>
        </Link>
        <Link href="/brain/query" className="p-6 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition">
          <h2 className="text-xl font-bold text-white mb-2">Query</h2>
          <p className="text-gray-400 text-sm">Ask questions about your connected data using AI</p>
        </Link>
        <Link href="/brain/knowledge" className="p-6 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition">
          <h2 className="text-xl font-bold text-white mb-2">Knowledge</h2>
          <p className="text-gray-400 text-sm">Browse synced emails, documents, and events</p>
        </Link>
        <Link href="/brain/entities" className="p-6 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-700 transition">
          <h2 className="text-xl font-bold text-white mb-2">Entities</h2>
          <p className="text-gray-400 text-sm">People, companies, topics extracted from your data</p>
        </Link>
      </div>
    </div>
  );
}
