import Link from 'next/link';

export default function Home() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">Welcome to 8pod Brain</h1>
        <p className="text-gray-400">Your central intelligence layer for managing connections, knowledge, and entities</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/connections" className="p-6 bg-gray-900 border border-gray-800 rounded-lg hover:border-blue-600 transition cursor-pointer">
          <div className="text-3xl mb-3">🔗</div>
          <h2 className="text-xl font-bold text-white mb-2">Connections</h2>
          <p className="text-gray-400 text-sm">Manage your connected data sources and integrations</p>
        </Link>
        <Link href="/query" className="p-6 bg-gray-900 border border-gray-800 rounded-lg hover:border-blue-600 transition cursor-pointer">
          <div className="text-3xl mb-3">🔍</div>
          <h2 className="text-xl font-bold text-white mb-2">Query</h2>
          <p className="text-gray-400 text-sm">Search and query your knowledge base</p>
        </Link>
        <Link href="/knowledge" className="p-6 bg-gray-900 border border-gray-800 rounded-lg hover:border-blue-600 transition cursor-pointer">
          <div className="text-3xl mb-3">📚</div>
          <h2 className="text-xl font-bold text-white mb-2">Knowledge</h2>
          <p className="text-gray-400 text-sm">View and manage your knowledge records</p>
        </Link>
        <Link href="/entities" className="p-6 bg-gray-900 border border-gray-800 rounded-lg hover:border-blue-600 transition cursor-pointer">
          <div className="text-3xl mb-3">🏢</div>
          <h2 className="text-xl font-bold text-white mb-2">Entities</h2>
          <p className="text-gray-400 text-sm">Explore entities and relationships</p>
        </Link>
        <Link href="/settings" className="p-6 bg-gray-900 border border-gray-800 rounded-lg hover:border-blue-600 transition cursor-pointer">
          <div className="text-3xl mb-3">⚙️</div>
          <h2 className="text-xl font-bold text-white mb-2">Settings</h2>
          <p className="text-gray-400 text-sm">Configure API keys and preferences</p>
        </Link>
      </div>
    </div>
  );
}
