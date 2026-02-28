'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

// ---------------------------------------------------------------------------
// Mock Pipeline Data
// ---------------------------------------------------------------------------

type PipelineStage = 'discovery' | 'analysis' | 'active' | 'completed';

interface PipelineItem {
  id: string;
  name: string;
  rightsHolder: string;
  sponsor: string;
  valueRange: string;
  stage: PipelineStage;
  status: 'active' | 'pending' | 'error';
  updatedAt: string;
}

const PIPELINE_DATA: PipelineItem[] = [
  {
    id: 'pkg-001',
    name: 'F1 Global Broadcast Rights 2027',
    rightsHolder: 'Formula One Group',
    sponsor: 'Aramco',
    valueRange: '\u00a3180M \u2013 \u00a3220M',
    stage: 'discovery',
    status: 'active',
    updatedAt: '2 hours ago',
  },
  {
    id: 'pkg-002',
    name: 'Premier League Asia-Pacific Digital',
    rightsHolder: 'Premier League',
    sponsor: 'EA Sports',
    valueRange: '\u00a395M \u2013 \u00a3130M',
    stage: 'discovery',
    status: 'pending',
    updatedAt: '1 day ago',
  },
  {
    id: 'pkg-003',
    name: 'Chelsea Women Global Sponsorship',
    rightsHolder: 'Chelsea FC Women',
    sponsor: 'Yokohama',
    valueRange: '\u00a312M \u2013 \u00a318M',
    stage: 'analysis',
    status: 'active',
    updatedAt: '5 hours ago',
  },
  {
    id: 'pkg-004',
    name: 'UEFA Nations League Highlights',
    rightsHolder: 'UEFA',
    sponsor: 'Booking.com',
    valueRange: '\u00a340M \u2013 \u00a355M',
    stage: 'analysis',
    status: 'pending',
    updatedAt: '3 days ago',
  },
  {
    id: 'pkg-005',
    name: 'Six Nations Digital & Social',
    rightsHolder: 'Six Nations Rugby',
    sponsor: 'Guinness',
    valueRange: '\u00a325M \u2013 \u00a335M',
    stage: 'analysis',
    status: 'active',
    updatedAt: '12 hours ago',
  },
  {
    id: 'pkg-006',
    name: 'MotoGP EMEA Streaming Rights',
    rightsHolder: 'Dorna Sports',
    sponsor: 'Red Bull',
    valueRange: '\u00a360M \u2013 \u00a385M',
    stage: 'active',
    status: 'active',
    updatedAt: '30 mins ago',
  },
  {
    id: 'pkg-007',
    name: 'WTA Finals Title Sponsorship',
    rightsHolder: 'WTA',
    sponsor: 'Porsche',
    valueRange: '\u00a315M \u2013 \u00a322M',
    stage: 'active',
    status: 'active',
    updatedAt: '6 hours ago',
  },
  {
    id: 'pkg-008',
    name: 'The Hundred Broadcast Package',
    rightsHolder: 'ECB',
    sponsor: 'KP Snacks',
    valueRange: '\u00a345M \u2013 \u00a358M',
    stage: 'active',
    status: 'pending',
    updatedAt: '2 days ago',
  },
  {
    id: 'pkg-009',
    name: 'Wimbledon International Feed',
    rightsHolder: 'AELTC',
    sponsor: 'Rolex',
    valueRange: '\u00a3110M \u2013 \u00a3150M',
    stage: 'completed',
    status: 'active',
    updatedAt: '2 weeks ago',
  },
  {
    id: 'pkg-010',
    name: 'F1 Academy Title Partnership',
    rightsHolder: 'Formula One Group',
    sponsor: 'Saudi Aramco',
    valueRange: '\u00a38M \u2013 \u00a312M',
    stage: 'completed',
    status: 'active',
    updatedAt: '1 month ago',
  },
];

const STAGE_CONFIG: Record<
  PipelineStage,
  { label: string; color: string; dotClass: string }
> = {
  discovery: {
    label: 'Discovery',
    color: 'text-cyan-400',
    dotClass: 'bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.5)]',
  },
  analysis: {
    label: 'Analysis',
    color: 'text-yellow-400',
    dotClass: 'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.5)]',
  },
  active: {
    label: 'Active',
    color: 'text-emerald-400',
    dotClass: 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]',
  },
  completed: {
    label: 'Completed',
    color: 'text-console-muted',
    dotClass: 'bg-console-muted shadow-[0_0_6px_rgba(100,116,139,0.3)]',
  },
};

const STAGES: PipelineStage[] = ['discovery', 'analysis', 'active', 'completed'];

// ---------------------------------------------------------------------------
// Quick Stats
// ---------------------------------------------------------------------------

const QUICK_STATS = [
  {
    label: 'Active Packages',
    value: '7',
    sub: '+2 this month',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    label: 'Pipeline Value',
    value: '\u00a3890M',
    sub: 'Total estimated',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Entities Tracked',
    value: '1,247',
    sub: 'Across all sources',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    label: 'Data Sources',
    value: '14',
    sub: 'Connected',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
  },
];

// ---------------------------------------------------------------------------
// System 1 & 2 Data
// ---------------------------------------------------------------------------

const SYSTEMS = [
  {
    id: 1,
    label: 'System 1',
    description: 'Real-time signals — market feeds, social sentiment, live event data',
    status: 'online' as const,
    latency: '42ms',
    sources: 8,
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    glowColor: 'shadow-[0_0_15px_rgba(52,211,153,0.1)]',
  },
  {
    id: 2,
    label: 'System 2',
    description: 'Deep analytics — historical benchmarks, predictive models, valuations',
    status: 'online' as const,
    latency: '180ms',
    sources: 6,
    color: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    glowColor: 'shadow-[0_0_15px_rgba(59,130,246,0.1)]',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AtlasPage() {
  const { data: session } = useSession();
  const workspaceId = (session as any)?.workspaceId;
  const [selectedStage, setSelectedStage] = useState<PipelineStage | null>(null);

  const filteredPipeline = selectedStage
    ? PIPELINE_DATA.filter((item) => item.stage === selectedStage)
    : PIPELINE_DATA;

  const itemsByStage = (stage: PipelineStage) =>
    filteredPipeline.filter((item) => item.stage === stage);

  return (
    <div className="min-h-screen console-grid relative pb-20">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6 py-10 space-y-10">
        {/* ----------------------------------------------------------------- */}
        {/* Header                                                            */}
        {/* ----------------------------------------------------------------- */}
        <header className="animate-fade-in">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Link
                  href="/ctrl"
                  className="text-console-muted hover:text-console-accent transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </Link>
                <h1 className="text-3xl font-bold text-white tracking-tight">
                  Atlas
                </h1>
                <span className="ml-2 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider bg-console-accent/10 text-console-accent border border-console-accent/20 rounded-full">
                  Commercial Engine
                </span>
              </div>
              <p className="text-console-text-dim text-sm ml-8">
                Commercial Engine &mdash; System 1 &amp; 2 Intelligence
              </p>
            </div>

            {/* System status indicators (header level) */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-console-surface border border-console-border rounded-lg text-xs font-mono">
                <span className="status-dot status-active" />
                <span className="text-console-text-dim">Pipeline Online</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-console-surface border border-console-border rounded-lg text-xs font-mono">
                <span className="status-dot status-active" />
                <span className="text-console-text-dim">
                  WS: {workspaceId ? workspaceId.slice(0, 8) + '...' : 'Loading'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* ----------------------------------------------------------------- */}
        {/* Quick Stats Row                                                   */}
        {/* ----------------------------------------------------------------- */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up">
          {QUICK_STATS.map((stat) => (
            <div
              key={stat.label}
              className="bg-console-surface border border-console-border rounded-xl p-5 hover:border-console-accent/20 transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-console-muted">{stat.icon}</span>
                <span className="text-[10px] font-mono text-console-muted uppercase">
                  {stat.sub}
                </span>
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-console-text-dim mt-1">{stat.label}</p>
            </div>
          ))}
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Pipeline Kanban                                                   */}
        {/* ----------------------------------------------------------------- */}
        <section className="animate-slide-up">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Rights Pipeline
              </h2>
              <p className="text-xs text-console-text-dim mt-0.5">
                Active rights packages across all stages
              </p>
            </div>

            {/* Stage filter pills */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedStage(null)}
                className={`px-3 py-1 text-xs rounded-full border transition-all ${
                  selectedStage === null
                    ? 'bg-console-accent/10 border-console-accent/40 text-console-accent'
                    : 'border-console-border text-console-muted hover:border-console-accent/20 hover:text-console-text-dim'
                }`}
              >
                All
              </button>
              {STAGES.map((stage) => (
                <button
                  key={stage}
                  onClick={() =>
                    setSelectedStage(selectedStage === stage ? null : stage)
                  }
                  className={`px-3 py-1 text-xs rounded-full border transition-all ${
                    selectedStage === stage
                      ? 'bg-console-accent/10 border-console-accent/40 text-console-accent'
                      : 'border-console-border text-console-muted hover:border-console-accent/20 hover:text-console-text-dim'
                  }`}
                >
                  {STAGE_CONFIG[stage].label}
                </button>
              ))}
            </div>
          </div>

          {/* Kanban columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {STAGES.map((stage) => {
              const items = itemsByStage(stage);
              const config = STAGE_CONFIG[stage];
              return (
                <div key={stage} className="space-y-3">
                  {/* Column header */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${config.dotClass}`}
                      />
                      <span
                        className={`text-sm font-medium ${config.color}`}
                      >
                        {config.label}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-console-muted">
                      {items.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-3">
                    {items.length === 0 ? (
                      <div className="bg-console-surface/50 border border-dashed border-console-border rounded-xl p-6 text-center">
                        <p className="text-xs text-console-muted">
                          No items
                        </p>
                      </div>
                    ) : (
                      items.map((item) => (
                        <div
                          key={item.id}
                          className="group bg-console-surface border border-console-border rounded-xl p-4 hover:border-console-accent/30 hover:glow-blue transition-all duration-300 cursor-pointer"
                        >
                          {/* Card header */}
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <h3 className="text-sm font-medium text-white group-hover:text-console-accent transition-colors leading-tight">
                              {item.name}
                            </h3>
                            <span
                              className={`status-dot flex-shrink-0 mt-1 ${
                                item.status === 'active'
                                  ? 'status-active'
                                  : item.status === 'pending'
                                  ? 'status-pending'
                                  : 'status-error'
                              }`}
                            />
                          </div>

                          {/* Meta rows */}
                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-console-muted">
                                Rights Holder
                              </span>
                              <span className="text-console-text-dim font-mono">
                                {item.rightsHolder}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-console-muted">
                                Sponsor
                              </span>
                              <span className="text-console-text-dim font-mono">
                                {item.sponsor}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-console-muted">
                                Value
                              </span>
                              <span className="text-white font-semibold font-mono">
                                {item.valueRange}
                              </span>
                            </div>
                          </div>

                          {/* Card footer */}
                          <div className="mt-3 pt-2 border-t border-console-border/50 flex items-center justify-between">
                            <span className="text-[10px] font-mono text-console-muted">
                              {item.id.toUpperCase()}
                            </span>
                            <span className="text-[10px] text-console-muted">
                              {item.updatedAt}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* System 1 & 2 Indicators                                           */}
        {/* ----------------------------------------------------------------- */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-up">
          {SYSTEMS.map((sys) => (
            <div
              key={sys.id}
              className={`bg-console-surface border ${sys.borderColor} rounded-xl p-6 ${sys.glowColor} transition-all duration-300`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg border ${sys.borderColor} flex items-center justify-center ${sys.color}`}
                  >
                    <span className="text-lg font-bold font-mono">
                      S{sys.id}
                    </span>
                  </div>
                  <div>
                    <h3 className={`text-base font-semibold ${sys.color}`}>
                      {sys.label}
                    </h3>
                    <p className="text-xs text-console-text-dim">
                      {sys.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="status-dot status-active" />
                  <span className="text-[10px] font-mono text-console-muted uppercase">
                    {sys.status}
                  </span>
                </div>
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-console-border/50">
                <div>
                  <p className="text-xs text-console-muted mb-1">Latency</p>
                  <p className="text-sm font-mono text-white">{sys.latency}</p>
                </div>
                <div>
                  <p className="text-xs text-console-muted mb-1">
                    Sources Connected
                  </p>
                  <p className="text-sm font-mono text-white">{sys.sources}</p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* ----------------------------------------------------------------- */}
        {/* Forecaster Entry Point                                            */}
        {/* ----------------------------------------------------------------- */}
        <section className="animate-slide-up">
          <Link
            href="/ctrl/atlas/forecaster"
            className="group block bg-console-surface border border-console-border rounded-xl p-6 hover:border-console-accent/40 hover:glow-blue-strong transition-all duration-500 relative overflow-hidden"
          >
            {/* Background shimmer */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-console-accent/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />

            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-5">
                {/* Icon */}
                <div className="w-14 h-14 rounded-xl bg-console-accent/10 border border-console-accent/20 flex items-center justify-center text-console-accent group-hover:bg-console-accent/20 transition-colors">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white group-hover:text-console-accent transition-colors">
                    Launch Forecaster
                  </h3>
                  <p className="text-sm text-console-text-dim mt-0.5">
                    Predictive modeling and rights package analysis
                  </p>
                </div>
              </div>

              {/* Arrow */}
              <div className="text-console-muted group-hover:text-console-accent group-hover:translate-x-1 transition-all duration-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </div>

            {/* Feature tags */}
            <div className="relative mt-4 flex flex-wrap gap-2">
              {[
                'Rights Valuation',
                'Audience Projections',
                'Sponsor Match',
                'ROI Modeling',
                'Market Comparables',
              ].map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-console-muted bg-console-bg border border-console-border rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </Link>
        </section>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Bottom Status Bar                                                    */}
      {/* ------------------------------------------------------------------- */}
      <div className="fixed bottom-0 left-64 right-0 bg-console-surface/80 backdrop-blur-sm border-t border-console-border px-6 py-2 flex items-center justify-between text-xs font-mono text-console-muted z-50">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="status-dot status-active" />
            Atlas Online
          </span>
          <span>
            Workspace: {workspaceId ? workspaceId.slice(0, 8) + '...' : 'Loading'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>S1: 42ms</span>
          <span>S2: 180ms</span>
          <span>8pod OS v3.0</span>
        </div>
      </div>
    </div>
  );
}
