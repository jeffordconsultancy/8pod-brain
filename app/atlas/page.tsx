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

const statusBadges: Record<string, { label: string; class: string }> = {
  prompt: { label: 'Brief', class: 'badge-pending' },
  blueprint: { label: 'Blueprint', class: 'bg-blue-400/10 text-blue-400 border border-blue-400/20' },
  insights: { label: 'Insights', class: 'bg-purple-400/10 text-purple-400 border border-purple-400/20' },
  validating: { label: 'Validating', class: 'bg-amber-400/10 text-amber-400 border border-amber-400/20' },
  validated: { label: 'Validated', class: 'badge-pass' },
  'content-plan': { label: 'Content Plan', class: 'bg-cyan-400/10 text-cyan-400 border border-cyan-400/20' },
  'pre-production': { label: 'Pre-Prod', class: 'bg-violet-400/10 text-violet-400 border border-violet-400/20' },
  production: { label: 'Production', class: 'bg-green-400/10 text-green-400 border border-green-400/20' },
  complete: { label: 'Complete', class: 'badge-pass' },
};

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
    return <div className="flex items-center justify-center min-h-[50vh]"><p className="text-text-muted font-mono text-sm">Loading...</p></div>;
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">Atlas</h1>
          <p className="text-text-secondary">The commercial engine. Build rights packages, validate, and generate content plans.</p>
        </div>
        <Link
          href="/atlas/forecaster/new"
          className="px-5 py-2.5 bg-accent-teal/20 text-accent-teal font-medium rounded-xl hover:bg-accent-teal/30 border border-accent-teal/30 transition text-sm"
        >
          New Forecast
        </Link>
      </div>

      {/* Pipeline diagram */}
      <div className="console-card p-4">
        <h3 className="text-xs font-mono tracking-[0.3em] text-text-dim mb-3">CANONICAL LIFECYCLE</h3>
        <div className="flex items-center gap-2 text-xs font-mono text-text-muted flex-wrap">
          {['Forecast', 'Validate', 'Content Plan', 'Pre-Production', 'Capture', 'Post-Production', 'Distribute', 'Learn', 'Recreate'].map((stage, i, arr) => (
            <span key={stage} className="flex items-center gap-2">
              <span className={i < 3 ? 'text-accent-teal' : 'text-text-dim'}>{stage}</span>
              {i < arr.length - 1 && <span className="text-text-dim">→</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Quick Access */}
      <div>
        <h3 className="text-xs font-mono tracking-[0.3em] text-text-dim mb-4">QUICK ACCESS</h3>
        <div className="grid grid-cols-3 gap-4">
          <Link href="/atlas" className="console-card p-5 group">
            <div className="w-10 h-10 flex items-center justify-center bg-console-surface border border-console-border rounded-lg mb-3 text-lg text-text-muted group-hover:text-accent-teal transition">◎</div>
            <h4 className="text-text-primary font-bold mb-1 group-hover:text-accent-teal transition">Rights Package</h4>
            <p className="text-text-muted text-sm">View and manage live rights package lifecycles and phases</p>
          </Link>
          <Link href="/atlas/forecaster/new" className="console-card p-5 group">
            <div className="w-10 h-10 flex items-center justify-center bg-console-surface border border-console-border rounded-lg mb-3 text-lg text-text-muted group-hover:text-accent-teal transition">◉</div>
            <h4 className="text-text-primary font-bold mb-1 group-hover:text-accent-teal transition">Forecaster</h4>
            <p className="text-text-muted text-sm">Launch four-phase value-creation intelligence for any brief</p>
          </Link>
          <div className="console-card p-5 opacity-60">
            <div className="w-10 h-10 flex items-center justify-center bg-console-surface border border-console-border rounded-lg mb-3 text-lg text-text-muted">⊕</div>
            <h4 className="text-text-primary font-bold mb-1">Live Integrations</h4>
            <p className="text-text-muted text-sm">Super Group · BBC Quest · F1 strategic layer · Sovereign</p>
          </div>
        </div>
      </div>

      {/* Active Packages */}
      {loading ? (
        <div className="text-center py-8"><p className="text-text-muted font-mono text-sm">Loading projects...</p></div>
      ) : projects.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-mono tracking-[0.3em] text-text-dim">ACTIVE PACKAGES</h3>
            <span className="text-accent-teal font-bold text-lg">{projects.length}</span>
          </div>
          <div className="space-y-2">
            {projects.map(project => {
              const badge = statusBadges[project.status] || { label: project.status, class: 'bg-console-surface text-text-muted border border-console-border' };
              return (
                <Link
                  key={project.id}
                  href={`/atlas/forecaster/${project.id}`}
                  className="block console-card p-5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-text-primary font-bold">{project.name}</h3>
                      <div className="flex gap-4 mt-1 text-xs text-text-muted font-mono">
                        {project.sponsorName && <span>Sponsor: {project.sponsorName}</span>}
                        {project.rightsHolder && <span>Rights: {project.rightsHolder}</span>}
                        {project.market && <span>Market: {project.market}</span>}
                      </div>
                    </div>
                    <span className={`text-xs font-mono px-2.5 py-1 rounded ${badge.class}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-text-dim font-mono mt-2">
                    Updated {new Date(project.updatedAt).toLocaleDateString()}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 console-card">
          <p className="text-text-muted text-lg mb-2">No forecast projects yet</p>
          <p className="text-text-dim text-sm mb-6">Start by creating your first rights package forecast</p>
          <Link
            href="/atlas/forecaster/new"
            className="px-6 py-3 bg-accent-teal/20 text-accent-teal font-medium rounded-xl hover:bg-accent-teal/30 border border-accent-teal/30 transition"
          >
            Create First Forecast
          </Link>
        </div>
      )}
    </div>
  );
}
