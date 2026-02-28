'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Project {
  id: string;
  name: string;
  status: string;
  sponsorName?: string;
  rightsHolder?: string;
  market?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AtlasDashboard() {
  const { data: session, status } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const workspaceId = (session as any)?.workspaceId;

  useEffect(() => {
    if (status === 'authenticated' && workspaceId) {
      fetch(`/api/forecaster/projects?workspace=${workspaceId}`)
        .then(r => r.ok ? r.json() : { projects: [] })
        .then(data => setProjects(data.projects || []))
        .finally(() => setLoading(false));
    }
  }, [status, workspaceId]);

  if (status === 'loading') {
    return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-gray-400">Loading...</p></div>;
  }

  const statusColors: Record<string, string> = {
    prompt: 'bg-yellow-900/30 text-yellow-200 border-yellow-700',
    blueprint: 'bg-blue-900/30 text-blue-200 border-blue-700',
    insights: 'bg-green-900/30 text-green-200 border-green-700',
    complete: 'bg-purple-900/30 text-purple-200 border-purple-700',
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Atlas</h1>
          <p className="text-gray-400">Your commercial intelligence engine. Build and analyse rights packages with the Forecaster.</p>
        </div>
        <Link
          href="/atlas/forecaster/new"
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
        >
          New Forecast
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-8"><p className="text-gray-400">Loading projects...</p></div>
      ) : projects.length > 0 ? (
        <div className="space-y-3">
          {projects.map(project => (
            <Link
              key={project.id}
              href={`/atlas/forecaster/${project.id}`}
              className="block bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">{project.name}</h3>
                  <div className="flex gap-4 mt-2 text-sm text-gray-400">
                    {project.sponsorName && <span>Sponsor: {project.sponsorName}</span>}
                    {project.rightsHolder && <span>Rights: {project.rightsHolder}</span>}
                    {project.market && <span>Market: {project.market}</span>}
                  </div>
                </div>
                <span className={`text-xs font-medium px-3 py-1 rounded-full border ${statusColors[project.status] || 'bg-gray-800 text-gray-300 border-gray-700'}`}>
                  {project.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Updated {new Date(project.updatedAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border border-gray-800 rounded-lg bg-gray-900/50">
          <p className="text-gray-400 text-lg mb-2">No forecast projects yet</p>
          <p className="text-gray-500 text-sm mb-6">Start by creating your first rights package forecast</p>
          <Link
            href="/atlas/forecaster/new"
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
          >
            Create First Forecast
          </Link>
        </div>
      )}
    </div>
  );
}
