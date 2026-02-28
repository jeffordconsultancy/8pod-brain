'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Source {
  source: string;
  id: string;
  summary: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  timestamp: Date;
  responseTimeMs?: number;
  provider?: string;
}

interface KnowledgeRecord {
  id: string;
  sourceSystem: string;
  sourceId: string;
  contentType: string;
  summary: string | null;
  rawContent: string;
  createdAt: string;
  sensitivity: string;
}

interface Entity {
  id: string;
  type: string;
  canonicalName: string;
  aliases: string[];
  role: string | null;
  mentionCount: number;
  firstSeen: string | null;
  lastSeen: string | null;
}

type Tab = 'query' | 'knowledge' | 'entities';

// ---------------------------------------------------------------------------
// Source icon helper
// ---------------------------------------------------------------------------

function SourceIcon({ source, className = 'w-4 h-4' }: { source: string; className?: string }) {
  const s = source.toLowerCase();

  if (s.includes('gmail') || s.includes('email')) {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    );
  }
  if (s.includes('drive') || s.includes('doc')) {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  if (s.includes('calendar')) {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (s.includes('slack')) {
    return (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    );
  }
  // Default: generic data icon
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Entity type icon + color helpers
// ---------------------------------------------------------------------------

function entityColor(type: string): string {
  switch (type.toLowerCase()) {
    case 'person': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    case 'organization':
    case 'company': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    case 'topic':
    case 'keyword': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
    case 'location':
    case 'place': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    case 'event': return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
    default: return 'text-console-text-dim bg-white/5 border-white/10';
  }
}

function entityIcon(type: string) {
  switch (type.toLowerCase()) {
    case 'person':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case 'organization':
    case 'company':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      );
    case 'topic':
    case 'keyword':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      );
    case 'location':
    case 'place':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      );
  }
}

// ---------------------------------------------------------------------------
// Inner component that uses useSearchParams (must be inside Suspense)
// ---------------------------------------------------------------------------

function BrainPageInner() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const workspaceId = (session as any)?.workspaceId as string | undefined;

  // ---- Tab state ----
  const [activeTab, setActiveTab] = useState<Tab>('query');

  // ---- Query / Chat state ----
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initialQueryHandled = useRef(false);

  // ---- Knowledge state ----
  const [knowledgeRecords, setKnowledgeRecords] = useState<KnowledgeRecord[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [knowledgeFilter, setKnowledgeFilter] = useState('all');

  // ---- Entities state ----
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(false);
  const [entityTypeFilter, setEntityTypeFilter] = useState('all');

  // ------------------------------------------------------------------
  // Scroll to bottom whenever messages change
  // ------------------------------------------------------------------
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ------------------------------------------------------------------
  // Auto-resize textarea
  // ------------------------------------------------------------------
  function autoResize() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }

  // ------------------------------------------------------------------
  // Send query
  // ------------------------------------------------------------------
  const sendQuery = useCallback(
    async (queryText: string) => {
      if (!queryText.trim() || !workspaceId || isQuerying) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: queryText.trim(),
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, userMsg]);
      setInput('');
      setIsQuerying(true);

      // Reset textarea height
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }

      try {
        const res = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: queryText.trim(), workspaceId }),
        });

        const data = await res.json();

        if (!res.ok) {
          const errMsg: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.error || 'Something went wrong. Please try again.',
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, errMsg]);
        } else {
          const aiMsg: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.response,
            sources: data.sources,
            timestamp: new Date(),
            responseTimeMs: data.responseTimeMs,
            provider: data.provider,
          };
          setMessages(prev => [...prev, aiMsg]);
        }
      } catch {
        const errMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Network error. Please check your connection and try again.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errMsg]);
      } finally {
        setIsQuerying(false);
      }
    },
    [workspaceId, isQuerying],
  );

  // ------------------------------------------------------------------
  // Handle initial ?q= from console
  // ------------------------------------------------------------------
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && workspaceId && !initialQueryHandled.current) {
      initialQueryHandled.current = true;
      sendQuery(q);
    }
  }, [searchParams, workspaceId, sendQuery]);

  // ------------------------------------------------------------------
  // Fetch knowledge records when tab activates
  // ------------------------------------------------------------------
  useEffect(() => {
    if (activeTab === 'knowledge' && workspaceId && knowledgeRecords.length === 0) {
      setKnowledgeLoading(true);
      fetch(`/api/knowledge?workspace=${workspaceId}`)
        .then(r => r.json())
        .then(data => setKnowledgeRecords(data.records || []))
        .catch(() => {})
        .finally(() => setKnowledgeLoading(false));
    }
  }, [activeTab, workspaceId, knowledgeRecords.length]);

  // ------------------------------------------------------------------
  // Fetch entities when tab activates
  // ------------------------------------------------------------------
  useEffect(() => {
    if (activeTab === 'entities' && workspaceId && entities.length === 0) {
      setEntitiesLoading(true);
      fetch(`/api/entities?workspace=${workspaceId}`)
        .then(r => r.json())
        .then(data => setEntities(data.entities || []))
        .catch(() => {})
        .finally(() => setEntitiesLoading(false));
    }
  }, [activeTab, workspaceId, entities.length]);

  // ------------------------------------------------------------------
  // Form submit handler
  // ------------------------------------------------------------------
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendQuery(input);
  }

  // Handle enter key (shift+enter for new line)
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuery(input);
    }
  }

  // ------------------------------------------------------------------
  // Filtered knowledge records
  // ------------------------------------------------------------------
  const filteredRecords =
    knowledgeFilter === 'all'
      ? knowledgeRecords
      : knowledgeRecords.filter(r => r.sourceSystem.toLowerCase().includes(knowledgeFilter));

  // ------------------------------------------------------------------
  // Grouped entities
  // ------------------------------------------------------------------
  const entityTypes = [...new Set(entities.map(e => e.type))];
  const filteredEntities =
    entityTypeFilter === 'all'
      ? entities
      : entities.filter(e => e.type === entityTypeFilter);

  const groupedEntities = filteredEntities.reduce<Record<string, Entity[]>>((acc, e) => {
    (acc[e.type] = acc[e.type] || []).push(e);
    return acc;
  }, {});

  // ------------------------------------------------------------------
  // Source label helper
  // ------------------------------------------------------------------
  function sourceLabel(src: string): string {
    switch (src.toLowerCase()) {
      case 'gmail': return 'Gmail';
      case 'google-drive': return 'Google Drive';
      case 'google-calendar': return 'Calendar';
      case 'slack': return 'Slack';
      case 'github': return 'GitHub';
      default: return src;
    }
  }

  // ------------------------------------------------------------------
  // Format timestamp
  // ------------------------------------------------------------------
  function formatTime(d: Date | string): string {
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(d: string): string {
    return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ==================================================================
  // RENDER
  // ==================================================================

  return (
    <div className="h-screen flex flex-col bg-console-bg relative">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* ---- Header ---- */}
      <header className="flex-shrink-0 border-b border-console-border bg-console-surface/80 backdrop-blur-sm relative z-10">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-console-accent/10 border border-console-accent/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-console-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Brain</h1>
              <p className="text-xs text-console-muted font-mono">Internal Operations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="status-dot status-active" />
            <span className="text-xs font-mono text-console-muted">Online</span>
          </div>
        </div>

        {/* ---- Tabs ---- */}
        <div className="px-6 flex gap-1">
          {([
            { key: 'query' as Tab, label: 'Query', icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            )},
            { key: 'knowledge' as Tab, label: 'Knowledge', icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            )},
            { key: 'entities' as Tab, label: 'Entities', icon: (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            )},
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-console-bg text-console-accent border-t border-l border-r border-console-accent/30'
                  : 'text-console-muted hover:text-console-text-dim hover:bg-white/5'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* ---- Tab Content ---- */}
      <div className="flex-1 overflow-hidden relative z-0">
        {/* ============================================================ */}
        {/* QUERY TAB                                                     */}
        {/* ============================================================ */}
        {activeTab === 'query' && (
          <div className="h-full flex flex-col">
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center animate-fade-in">
                  <div className="w-16 h-16 rounded-2xl bg-console-accent/10 border border-console-accent/20 flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-console-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-white mb-2">Query the Brain</h2>
                  <p className="text-console-text-dim text-sm max-w-md text-center mb-8">
                    Ask questions about your connected data sources. The Brain searches across emails,
                    documents, and calendar events to find answers.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
                    {[
                      'What meetings do I have this week?',
                      'Summarize recent emails about partnerships',
                      'Who are the key contacts in my inbox?',
                      'What documents were shared recently?',
                    ].map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => sendQuery(suggestion)}
                        className="text-left px-4 py-3 text-sm text-console-text-dim bg-console-surface border border-console-border rounded-xl hover:border-console-accent/30 hover:text-white transition-all duration-200"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto space-y-6">
                  {messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex animate-slide-up ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] ${
                          msg.role === 'user'
                            ? 'bg-console-accent text-white rounded-2xl rounded-br-md px-5 py-3'
                            : 'bg-console-surface border border-console-border text-console-text rounded-2xl rounded-bl-md px-5 py-4'
                        }`}
                      >
                        {/* Message content */}
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </div>

                        {/* Sources (AI messages only) */}
                        {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-console-border">
                            <p className="text-[10px] uppercase tracking-wider text-console-muted mb-2 font-mono">
                              Sources
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.sources.slice(0, 8).map((src, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] bg-console-accent/10 text-console-accent border border-console-accent/20 rounded-full"
                                  title={src.summary || src.id}
                                >
                                  <SourceIcon source={src.source} className="w-3 h-3" />
                                  {sourceLabel(src.source)}
                                </span>
                              ))}
                              {msg.sources.length > 8 && (
                                <span className="inline-flex items-center px-2.5 py-1 text-[11px] text-console-muted">
                                  +{msg.sources.length - 8} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Metadata line */}
                        <div className={`mt-2 flex items-center gap-3 text-[10px] ${
                          msg.role === 'user' ? 'text-blue-200' : 'text-console-muted'
                        }`}>
                          <span>{formatTime(msg.timestamp)}</span>
                          {msg.responseTimeMs && (
                            <span>{msg.responseTimeMs}ms</span>
                          )}
                          {msg.provider && (
                            <span className="uppercase font-mono">{msg.provider}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {isQuerying && (
                    <div className="flex justify-start animate-fade-in">
                      <div className="bg-console-surface border border-console-border rounded-2xl rounded-bl-md px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-console-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 rounded-full bg-console-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 rounded-full bg-console-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input area */}
            <div className="flex-shrink-0 border-t border-console-border bg-console-surface/80 backdrop-blur-sm px-6 py-4">
              <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
                <div className="relative group">
                  <div className="absolute inset-0 bg-console-accent/5 rounded-xl blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
                  <div className="relative flex items-end gap-3 bg-console-bg border border-console-border rounded-xl p-3 group-focus-within:border-console-accent/40 transition-all duration-300">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e => { setInput(e.target.value); autoResize(); }}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask the Brain anything..."
                      rows={1}
                      className="flex-1 bg-transparent border-none text-sm text-white placeholder-console-muted focus:outline-none resize-none leading-relaxed"
                      disabled={isQuerying}
                    />
                    <button
                      type="submit"
                      disabled={isQuerying || !input.trim()}
                      className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg bg-console-accent hover:bg-blue-600 disabled:opacity-30 disabled:hover:bg-console-accent text-white transition-all"
                    >
                      {isQuerying ? (
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-console-muted text-center font-mono">
                  Shift + Enter for new line
                </p>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* KNOWLEDGE TAB                                                 */}
        {/* ============================================================ */}
        {activeTab === 'knowledge' && (
          <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-console-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-console-text-dim">
                  {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {['all', 'gmail', 'google-drive', 'google-calendar'].map(f => (
                  <button
                    key={f}
                    onClick={() => setKnowledgeFilter(f)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                      knowledgeFilter === f
                        ? 'bg-console-accent/10 text-console-accent border border-console-accent/30'
                        : 'text-console-muted hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    {f === 'all' ? 'All' : sourceLabel(f)}
                  </button>
                ))}
                <button
                  onClick={() => {
                    if (!workspaceId) return;
                    setKnowledgeLoading(true);
                    fetch(`/api/knowledge?workspace=${workspaceId}`)
                      .then(r => r.json())
                      .then(data => setKnowledgeRecords(data.records || []))
                      .catch(() => {})
                      .finally(() => setKnowledgeLoading(false));
                  }}
                  className="p-1.5 text-console-muted hover:text-white transition-colors"
                  title="Refresh"
                >
                  <svg className={`w-4 h-4 ${knowledgeLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Records list */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {knowledgeLoading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="flex items-center gap-3 text-console-muted">
                    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm">Loading knowledge base...</span>
                  </div>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-console-muted">
                  <svg className="w-10 h-10 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                  <p className="text-sm">No records found</p>
                  <p className="text-xs mt-1">Connect and sync data sources to populate the knowledge base</p>
                </div>
              ) : (
                <div className="space-y-2 max-w-4xl mx-auto">
                  {filteredRecords.map(record => (
                    <div
                      key={record.id}
                      className="bg-console-surface border border-console-border rounded-xl p-4 hover:border-console-accent/20 transition-all duration-200 animate-fade-in group"
                    >
                      <div className="flex items-start gap-3">
                        {/* Source icon */}
                        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-console-accent/10 border border-console-accent/20 flex items-center justify-center text-console-accent">
                          <SourceIcon source={record.sourceSystem} className="w-4 h-4" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-console-accent uppercase">
                              {sourceLabel(record.sourceSystem)}
                            </span>
                            <span className="text-console-muted text-[10px]">
                              {formatDate(record.createdAt)}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                              record.sensitivity === 'internal'
                                ? 'bg-amber-400/10 text-amber-400'
                                : record.sensitivity === 'public'
                                ? 'bg-green-400/10 text-green-400'
                                : 'bg-red-400/10 text-red-400'
                            }`}>
                              {record.sensitivity}
                            </span>
                          </div>
                          <p className="text-sm text-console-text leading-relaxed line-clamp-2">
                            {record.summary || record.rawContent.slice(0, 200)}
                          </p>
                          <p className="text-xs text-console-muted mt-1.5 font-mono truncate">
                            {record.contentType} / {record.sourceId.slice(0, 24)}...
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* ENTITIES TAB                                                  */}
        {/* ============================================================ */}
        {activeTab === 'entities' && (
          <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-console-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-console-text-dim">
                  {filteredEntities.length} entit{filteredEntities.length !== 1 ? 'ies' : 'y'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEntityTypeFilter('all')}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                    entityTypeFilter === 'all'
                      ? 'bg-console-accent/10 text-console-accent border border-console-accent/30'
                      : 'text-console-muted hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  All
                </button>
                {entityTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => setEntityTypeFilter(type)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-all capitalize ${
                      entityTypeFilter === type
                        ? 'bg-console-accent/10 text-console-accent border border-console-accent/30'
                        : 'text-console-muted hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    {type}
                  </button>
                ))}
                <button
                  onClick={() => {
                    if (!workspaceId) return;
                    setEntitiesLoading(true);
                    fetch(`/api/entities?workspace=${workspaceId}`)
                      .then(r => r.json())
                      .then(data => setEntities(data.entities || []))
                      .catch(() => {})
                      .finally(() => setEntitiesLoading(false));
                  }}
                  className="p-1.5 text-console-muted hover:text-white transition-colors"
                  title="Refresh"
                >
                  <svg className={`w-4 h-4 ${entitiesLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Entity cards */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {entitiesLoading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="flex items-center gap-3 text-console-muted">
                    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="text-sm">Loading entities...</span>
                  </div>
                </div>
              ) : filteredEntities.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-console-muted">
                  <svg className="w-10 h-10 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-sm">No entities extracted yet</p>
                  <p className="text-xs mt-1">Entities are automatically extracted when data sources are synced</p>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto space-y-8">
                  {Object.entries(groupedEntities).map(([type, group]) => (
                    <div key={type} className="animate-fade-in">
                      {/* Group header */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`${entityColor(type)} p-1 rounded border`}>
                          {entityIcon(type)}
                        </span>
                        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                          {type}
                        </h3>
                        <span className="text-xs text-console-muted font-mono">
                          ({group.length})
                        </span>
                      </div>

                      {/* Cards grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {group.map(entity => (
                          <div
                            key={entity.id}
                            className={`bg-console-surface border border-console-border rounded-xl p-4 hover:border-console-accent/20 transition-all duration-200 group`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`flex-shrink-0 p-1.5 rounded-lg border ${entityColor(entity.type)}`}>
                                  {entityIcon(entity.type)}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-white truncate">
                                    {entity.canonicalName}
                                  </p>
                                  {entity.role && (
                                    <p className="text-[10px] text-console-muted truncate">
                                      {entity.role}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <span className="flex-shrink-0 text-xs font-mono text-console-accent bg-console-accent/10 px-2 py-0.5 rounded-full">
                                {entity.mentionCount}
                              </span>
                            </div>

                            {/* Aliases */}
                            {entity.aliases && entity.aliases.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {entity.aliases.slice(0, 3).map((alias, i) => (
                                  <span
                                    key={i}
                                    className="text-[10px] px-1.5 py-0.5 bg-white/5 text-console-text-dim rounded"
                                  >
                                    {alias}
                                  </span>
                                ))}
                                {entity.aliases.length > 3 && (
                                  <span className="text-[10px] text-console-muted">
                                    +{entity.aliases.length - 3}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Date range */}
                            {(entity.firstSeen || entity.lastSeen) && (
                              <div className="mt-2 text-[10px] text-console-muted font-mono">
                                {entity.firstSeen && formatDate(entity.firstSeen)}
                                {entity.firstSeen && entity.lastSeen && ' - '}
                                {entity.lastSeen && formatDate(entity.lastSeen)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Exported page component wraps inner content in Suspense for useSearchParams
// ---------------------------------------------------------------------------

export default function BrainPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-console-bg">
          <div className="flex items-center gap-3 text-console-muted">
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm font-mono">Initializing Brain...</span>
          </div>
        </div>
      }
    >
      <BrainPageInner />
    </Suspense>
  );
}
