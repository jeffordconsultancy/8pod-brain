'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PhaseIndicator from '@/components/ui/PhaseIndicator';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface ContentPiece {
  id: string;
  briefId: string | null;
  storyUnitId: string | null;
  headline: string;
  bodyContent: string;
  summary: string | null;
  assemblyMethod: string | null;
  assetSource: string | null;
  atlasStoryType: string | null;
  funnelStage: string | null;
  toneBand: string | null;
  valueFrame: string | null;
  audienceLabel: string | null;
  format: string | null;
  sponsorRatio: string | null;
  sponsorPresence: boolean;
  qualityScore: number | null;
  editorialNotes: string | null;
  revisionCount: number;
  status: string;
  assignedTo: string | null;
  generatedBy: string;
  externalSystem: string | null;
  externalUrl: string | null;
  variantOf: string | null;
  variantLabel: string | null;
  distributions: Distribution[];
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
}

interface Distribution {
  id: string;
  channel: string;
  destination: string | null;
  status: string;
  externalUrl: string | null;
  publishedAt: string | null;
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const STATUS_FLOW = ['DRAFT', 'IN_REVIEW', 'REVISION_REQUESTED', 'APPROVED', 'READY_FOR_DISTRIBUTION', 'DISTRIBUTED', 'LIVE', 'ARCHIVED'];

const STATUS_CONFIG: Record<string, { label: string; color: string; next?: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-zinc-400/10 text-zinc-400 border-zinc-400/20', next: 'IN_REVIEW' },
  IN_REVIEW: { label: 'In Review', color: 'bg-amber-400/10 text-amber-400 border-amber-400/20', next: 'APPROVED' },
  REVISION_REQUESTED: { label: 'Revisions', color: 'bg-orange-400/10 text-orange-400 border-orange-400/20', next: 'IN_REVIEW' },
  APPROVED: { label: 'Approved', color: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20', next: 'READY_FOR_DISTRIBUTION' },
  READY_FOR_DISTRIBUTION: { label: 'Ready', color: 'bg-blue-400/10 text-blue-400 border-blue-400/20', next: 'DISTRIBUTED' },
  DISTRIBUTED: { label: 'Distributed', color: 'bg-purple-400/10 text-purple-400 border-purple-400/20', next: 'LIVE' },
  LIVE: { label: 'Live', color: 'bg-accent-teal/10 text-accent-teal border-accent-teal/20' },
  ARCHIVED: { label: 'Archived', color: 'bg-zinc-600/10 text-zinc-500 border-zinc-600/20' },
};

const ASSEMBLY_COLORS: Record<string, string> = {
  Newsroom: 'text-blue-400',
  Generative: 'text-cyan-400',
};

const FUNNEL_COLORS: Record<string, string> = {
  Inspiration: 'text-violet-400',
  Aspiration: 'text-rose-400',
  Immersion: 'text-amber-400',
  Conversion: 'text-emerald-400',
};

const DISTRIBUTION_CHANNELS = [
  { id: 'adobe_express', label: 'Adobe Express', icon: '🎨' },
  { id: 'adobe_premiere', label: 'Adobe Premiere', icon: '🎬' },
  { id: 'wordpress', label: 'WordPress / CMS', icon: '📝' },
  { id: 'social_media', label: 'Social Media', icon: '📱' },
  { id: 'publisher_network', label: 'Publisher Network', icon: '🌐' },
  { id: 'email', label: 'Email / Newsletter', icon: '📧' },
  { id: 'download', label: 'Download Package', icon: '📦' },
];

const BRIEF_TYPE_OPTIONS = [
  { value: '', label: 'All Approved Briefs' },
  { value: 'CAPTURE_BRIEF', label: 'Capture Briefs' },
  { value: 'SHOOTING_SCRIPT', label: 'Shooting Scripts' },
  { value: 'NEWSROOM_BRIEF', label: 'Newsroom Briefs' },
  { value: 'GENERATIVE_BRIEF', label: 'Generative Briefs' },
];

const phases = [
  { id: 'forecast', label: 'Forecast', status: 'complete' as const },
  { id: 'validate', label: 'Validate', status: 'complete' as const },
  { id: 'content-plan', label: 'Content Plan', status: 'complete' as const },
  { id: 'pre-production', label: 'Pre-Production', status: 'complete' as const },
  { id: 'production', label: 'Production', status: 'complete' as const },
  { id: 'studio', label: 'Studio', status: 'active' as const },
];

type ViewMode = 'factory' | 'editorial' | 'distribution';

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────

export default function StudioPage() {
  const { data: session, status: authStatus } = useSession();
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const workspaceId = (session as any)?.workspaceId;

  const [pieces, setPieces] = useState<ContentPiece[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('factory');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterAssembly, setFilterAssembly] = useState<string>('');
  const [expandedPiece, setExpandedPiece] = useState<string | null>(null);
  const [editingPiece, setEditingPiece] = useState<string | null>(null);
  const [editHeadline, setEditHeadline] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [selectedPieces, setSelectedPieces] = useState<Set<string>>(new Set());
  const [briefTypeFilter, setBriefTypeFilter] = useState('');
  const [distributingPiece, setDistributingPiece] = useState<string | null>(null);
  const [regeneratingPiece, setRegeneratingPiece] = useState<string | null>(null);
  const [editorialDirection, setEditorialDirection] = useState('');

  // ─────────────────────────────────────────────────────────────
  // DATA LOADING
  // ─────────────────────────────────────────────────────────────

  const loadPieces = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const params = new URLSearchParams({ projectId, workspace: workspaceId });
      if (filterStatus) params.append('status', filterStatus);
      if (filterAssembly) params.append('assemblyMethod', filterAssembly);

      const res = await fetch(`/api/atlas/studio?${params}`);
      const data = await res.json();
      setPieces(data.pieces || []);
      setStatusCounts(data.statusCounts || {});
    } catch (err) {
      console.error('Failed to load content pieces:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, workspaceId, filterStatus, filterAssembly]);

  useEffect(() => { loadPieces(); }, [loadPieces]);

  // ─────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────

  const generateContent = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/atlas/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          workspaceId,
          action: 'generate-content',
          briefType: briefTypeFilter || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadPieces();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const updatePieceStatus = async (pieceId: string, newStatus: string) => {
    try {
      const res = await fetch('/api/atlas/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          workspaceId,
          action: 'update-piece',
          pieceId,
          updates: { status: newStatus },
        }),
      });
      if (!res.ok) throw new Error('Failed to update');
      await loadPieces();
    } catch (err) {
      console.error('Failed to update piece status:', err);
    }
  };

  const savePieceEdits = async (pieceId: string) => {
    try {
      const res = await fetch('/api/atlas/studio', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pieceId,
          headline: editHeadline,
          bodyContent: editBody,
          editorialNotes: editNotes || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setEditingPiece(null);
      await loadPieces();
    } catch (err) {
      console.error('Failed to save edits:', err);
    }
  };

  const bulkUpdateStatus = async (newStatus: string) => {
    if (selectedPieces.size === 0) return;
    try {
      const res = await fetch('/api/atlas/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          workspaceId,
          action: 'bulk-status',
          pieceIds: Array.from(selectedPieces),
          newStatus,
        }),
      });
      if (!res.ok) throw new Error('Failed to bulk update');
      setSelectedPieces(new Set());
      await loadPieces();
    } catch (err) {
      console.error('Failed to bulk update:', err);
    }
  };

  const distributePiece = async (pieceId: string, channel: string) => {
    try {
      const res = await fetch('/api/atlas/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          workspaceId,
          action: 'distribute',
          pieceId,
          channel,
          destination: channel,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setDistributingPiece(null);
      await loadPieces();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const regeneratePiece = async (pieceId: string) => {
    setRegeneratingPiece(pieceId);
    try {
      const res = await fetch('/api/atlas/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          workspaceId,
          action: 'regenerate',
          pieceId,
          editorialDirection: editorialDirection || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setEditorialDirection('');
      await loadPieces();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRegeneratingPiece(null);
    }
  };

  const startEditing = (piece: ContentPiece) => {
    setEditingPiece(piece.id);
    setEditHeadline(piece.headline);
    setEditBody(piece.bodyContent);
    setEditNotes(piece.editorialNotes || '');
  };

  const toggleSelect = (id: string) => {
    setSelectedPieces(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ─────────────────────────────────────────────────────────────
  // COMPUTED
  // ─────────────────────────────────────────────────────────────

  const totalPieces = pieces.length;
  const totalByStatus = (s: string) => statusCounts[s] || 0;
  const filteredPieces = pieces.filter(p => {
    if (viewMode === 'distribution') {
      return ['APPROVED', 'READY_FOR_DISTRIBUTION', 'DISTRIBUTED', 'LIVE'].includes(p.status);
    }
    if (viewMode === 'editorial') {
      return ['DRAFT', 'IN_REVIEW', 'REVISION_REQUESTED', 'APPROVED'].includes(p.status);
    }
    return true;
  });

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-console-bg flex items-center justify-center">
        <div className="text-text-dim font-mono text-sm animate-pulse">Loading Studio...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-console-bg text-text-primary p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => router.push(`/atlas/forecaster/${projectId}`)} className="text-text-dim hover:text-text-secondary text-sm font-mono">
                ← Project
              </button>
              <span className="text-text-dim">|</span>
              <button onClick={() => router.push(`/atlas/forecaster/${projectId}/production`)} className="text-text-dim hover:text-text-secondary text-sm font-mono">
                ← Production
              </button>
            </div>
            <h1 className="text-2xl font-bold text-text-primary font-mono">Content Studio</h1>
            <p className="text-text-dim text-sm mt-1">
              Generate, edit, approve, and distribute content from production briefs
            </p>
          </div>
          <PhaseIndicator phases={phases} compact />
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-mono flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400/60 hover:text-red-400">✕</button>
          </div>
        )}

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-6">
          {[
            { label: 'Total', value: totalPieces, color: 'text-text-primary' },
            { label: 'Draft', value: totalByStatus('DRAFT'), color: 'text-zinc-400' },
            { label: 'In Review', value: totalByStatus('IN_REVIEW'), color: 'text-amber-400' },
            { label: 'Revisions', value: totalByStatus('REVISION_REQUESTED'), color: 'text-orange-400' },
            { label: 'Approved', value: totalByStatus('APPROVED'), color: 'text-emerald-400' },
            { label: 'Ready', value: totalByStatus('READY_FOR_DISTRIBUTION'), color: 'text-blue-400' },
            { label: 'Distributed', value: totalByStatus('DISTRIBUTED'), color: 'text-purple-400' },
            { label: 'Live', value: totalByStatus('LIVE'), color: 'text-accent-teal' },
          ].map(stat => (
            <div key={stat.label} className="bg-console-surface border border-console-border rounded-lg p-3 text-center">
              <div className={`text-xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
              <div className="text-text-dim text-xs font-mono">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* View mode tabs */}
        <div className="flex items-center gap-4 mb-6 border-b border-console-border pb-4">
          <div className="flex gap-1">
            {[
              { id: 'factory' as ViewMode, label: 'Content Factory', icon: '⚡' },
              { id: 'editorial' as ViewMode, label: 'Editorial Desk', icon: '✏️' },
              { id: 'distribution' as ViewMode, label: 'Distribution Hub', icon: '🚀' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setViewMode(tab.id); setSelectedPieces(new Set()); }}
                className={`px-4 py-2 rounded-lg text-sm font-mono transition-all ${
                  viewMode === tab.id
                    ? 'bg-accent-teal/10 text-accent-teal border border-accent-teal/30'
                    : 'text-text-dim hover:text-text-secondary border border-transparent'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Bulk actions when pieces are selected */}
          {selectedPieces.size > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-text-dim text-xs font-mono">{selectedPieces.size} selected</span>
              {viewMode === 'editorial' && (
                <>
                  <button onClick={() => bulkUpdateStatus('IN_REVIEW')} className="px-3 py-1 rounded text-xs font-mono bg-amber-400/10 text-amber-400 border border-amber-400/20 hover:bg-amber-400/20">
                    → Review
                  </button>
                  <button onClick={() => bulkUpdateStatus('APPROVED')} className="px-3 py-1 rounded text-xs font-mono bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 hover:bg-emerald-400/20">
                    → Approve
                  </button>
                  <button onClick={() => bulkUpdateStatus('REVISION_REQUESTED')} className="px-3 py-1 rounded text-xs font-mono bg-orange-400/10 text-orange-400 border border-orange-400/20 hover:bg-orange-400/20">
                    → Revisions
                  </button>
                </>
              )}
              {viewMode === 'distribution' && (
                <button onClick={() => bulkUpdateStatus('READY_FOR_DISTRIBUTION')} className="px-3 py-1 rounded text-xs font-mono bg-blue-400/10 text-blue-400 border border-blue-400/20 hover:bg-blue-400/20">
                  → Ready for Distribution
                </button>
              )}
              <button onClick={() => setSelectedPieces(new Set())} className="text-text-dim text-xs hover:text-text-secondary">Clear</button>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* FACTORY VIEW — Generate content from briefs */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {viewMode === 'factory' && (
          <div>
            {/* Generation controls */}
            <div className="bg-console-surface border border-console-border rounded-lg p-6 mb-6">
              <h2 className="text-lg font-bold font-mono text-text-primary mb-3">Generate Content from Briefs</h2>
              <p className="text-text-dim text-sm mb-4">
                Select which approved production briefs to generate content from. Each brief produces a publication-ready content piece following the system's rules — tone band, sponsor ratio, audience targeting, and format constraints.
              </p>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="text-text-dim text-xs font-mono mb-1 block">Brief Type</label>
                  <select
                    value={briefTypeFilter}
                    onChange={(e) => setBriefTypeFilter(e.target.value)}
                    className="w-full bg-console-bg border border-console-border rounded-lg px-3 py-2 text-sm font-mono text-text-primary"
                  >
                    {BRIEF_TYPE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={generateContent}
                  disabled={generating}
                  className="px-6 py-2 rounded-lg font-mono text-sm font-bold bg-accent-teal/10 text-accent-teal border border-accent-teal/30 hover:bg-accent-teal/20 disabled:opacity-50 transition-all whitespace-nowrap"
                >
                  {generating ? (
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-accent-teal animate-pulse" />
                      Generating...
                    </span>
                  ) : (
                    '⚡ Generate Content'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* CONTENT PIECES LIST */}
        {/* ═══════════════════════════════════════════════════════════ */}
        {filteredPieces.length === 0 && !loading ? (
          <div className="text-center py-16">
            <div className="text-text-dim font-mono text-sm">
              {totalPieces === 0 ? (
                <>No content pieces yet. Generate content from approved production briefs to get started.</>
              ) : (
                <>No content pieces match current filters.</>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPieces.map(piece => {
              const isExpanded = expandedPiece === piece.id;
              const isEditing = editingPiece === piece.id;
              const isSelected = selectedPieces.has(piece.id);
              const statusConf = STATUS_CONFIG[piece.status] || STATUS_CONFIG.DRAFT;

              return (
                <div key={piece.id} className={`bg-console-surface border rounded-lg transition-all ${
                  isSelected ? 'border-accent-teal/40' : 'border-console-border'
                }`}>
                  {/* Card header */}
                  <div className="flex items-center gap-3 p-4">
                    {/* Selection checkbox */}
                    {(viewMode === 'editorial' || viewMode === 'distribution') && (
                      <button
                        onClick={() => toggleSelect(piece.id)}
                        className={`w-5 h-5 rounded border flex items-center justify-center text-xs transition-all ${
                          isSelected
                            ? 'bg-accent-teal/20 border-accent-teal/40 text-accent-teal'
                            : 'border-console-border text-transparent hover:border-text-dim'
                        }`}
                      >
                        ✓
                      </button>
                    )}

                    {/* Quality score */}
                    {piece.qualityScore !== null && (
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold font-mono border ${
                        piece.qualityScore >= 80 ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' :
                        piece.qualityScore >= 60 ? 'bg-amber-400/10 text-amber-400 border-amber-400/20' :
                        'bg-red-400/10 text-red-400 border-red-400/20'
                      }`}>
                        {piece.qualityScore}
                      </div>
                    )}

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3
                          className="font-bold text-text-primary truncate cursor-pointer hover:text-accent-teal transition-colors"
                          onClick={() => setExpandedPiece(isExpanded ? null : piece.id)}
                        >
                          {piece.headline}
                        </h3>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono text-text-dim">
                        {piece.assemblyMethod && (
                          <span className={ASSEMBLY_COLORS[piece.assemblyMethod] || 'text-text-dim'}>
                            {piece.assemblyMethod}
                          </span>
                        )}
                        {piece.funnelStage && (
                          <span className={FUNNEL_COLORS[piece.funnelStage] || 'text-text-dim'}>
                            {piece.funnelStage}
                          </span>
                        )}
                        {piece.audienceLabel && <span>{piece.audienceLabel}</span>}
                        {piece.format && <span className="text-text-dim/60">{piece.format}</span>}
                        {piece.revisionCount > 0 && <span className="text-orange-400">v{piece.revisionCount + 1}</span>}
                        {piece.generatedBy === 'fallback' && <span className="text-amber-500">fallback</span>}
                      </div>
                    </div>

                    {/* Status badge */}
                    <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${statusConf.color}`}>
                      {statusConf.label}
                    </span>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      {statusConf.next && (
                        <button
                          onClick={() => updatePieceStatus(piece.id, statusConf.next!)}
                          className="px-3 py-1 rounded text-xs font-mono bg-console-bg border border-console-border hover:border-accent-teal/30 hover:text-accent-teal transition-all"
                          title={`Move to ${STATUS_CONFIG[statusConf.next]?.label}`}
                        >
                          → {STATUS_CONFIG[statusConf.next]?.label}
                        </button>
                      )}
                      {piece.status === 'IN_REVIEW' && (
                        <button
                          onClick={() => updatePieceStatus(piece.id, 'REVISION_REQUESTED')}
                          className="px-3 py-1 rounded text-xs font-mono bg-console-bg border border-console-border hover:border-orange-400/30 hover:text-orange-400 transition-all"
                        >
                          ↩ Revisions
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedPiece(isExpanded ? null : piece.id)}
                        className="px-2 py-1 rounded text-xs font-mono text-text-dim hover:text-text-secondary"
                      >
                        {isExpanded ? '▲' : '▼'}
                      </button>
                    </div>
                  </div>

                  {/* Summary line */}
                  {piece.summary && !isExpanded && (
                    <div className="px-4 pb-3 -mt-1">
                      <p className="text-text-dim text-xs line-clamp-1">{piece.summary}</p>
                    </div>
                  )}

                  {/* ═══ EXPANDED VIEW ═══ */}
                  {isExpanded && (
                    <div className="border-t border-console-border">
                      {/* Metadata bar */}
                      <div className="flex flex-wrap gap-4 px-4 py-3 bg-console-bg/50 text-xs font-mono">
                        {piece.atlasStoryType && (
                          <div><span className="text-text-dim">Story Type:</span> <span className="text-text-secondary">{piece.atlasStoryType}</span></div>
                        )}
                        {piece.toneBand && (
                          <div><span className="text-text-dim">Tone:</span> <span className="text-text-secondary">{piece.toneBand}</span></div>
                        )}
                        {piece.valueFrame && (
                          <div><span className="text-text-dim">Value Frame:</span> <span className="text-text-secondary">{piece.valueFrame}</span></div>
                        )}
                        {piece.sponsorRatio && (
                          <div><span className="text-text-dim">Sponsor Ratio:</span> <span className="text-text-secondary">{piece.sponsorRatio}</span></div>
                        )}
                        {piece.assetSource && (
                          <div><span className="text-text-dim">Asset Source:</span> <span className="text-text-secondary">{piece.assetSource}</span></div>
                        )}
                      </div>

                      {/* Content body or editor */}
                      <div className="p-4">
                        {isEditing ? (
                          <div className="space-y-4">
                            <div>
                              <label className="text-text-dim text-xs font-mono mb-1 block">Headline</label>
                              <input
                                value={editHeadline}
                                onChange={(e) => setEditHeadline(e.target.value)}
                                className="w-full bg-console-bg border border-console-border rounded-lg px-3 py-2 text-sm font-mono text-text-primary"
                              />
                            </div>
                            <div>
                              <label className="text-text-dim text-xs font-mono mb-1 block">Content Body</label>
                              <textarea
                                value={editBody}
                                onChange={(e) => setEditBody(e.target.value)}
                                rows={16}
                                className="w-full bg-console-bg border border-console-border rounded-lg px-3 py-2 text-sm font-mono text-text-primary resize-y"
                              />
                            </div>
                            <div>
                              <label className="text-text-dim text-xs font-mono mb-1 block">Editorial Notes</label>
                              <textarea
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                rows={3}
                                placeholder="Notes for the editorial team..."
                                className="w-full bg-console-bg border border-console-border rounded-lg px-3 py-2 text-sm font-mono text-text-primary resize-y"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => savePieceEdits(piece.id)}
                                className="px-4 py-2 rounded-lg text-sm font-mono font-bold bg-accent-teal/10 text-accent-teal border border-accent-teal/30 hover:bg-accent-teal/20"
                              >
                                Save Changes
                              </button>
                              <button
                                onClick={() => setEditingPiece(null)}
                                className="px-4 py-2 rounded-lg text-sm font-mono text-text-dim hover:text-text-secondary"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Rendered content */}
                            <div className="prose prose-invert prose-sm max-w-none mb-4">
                              <div className="whitespace-pre-wrap text-text-secondary text-sm leading-relaxed font-mono">
                                {piece.bodyContent.length > 2000
                                  ? piece.bodyContent.substring(0, 2000) + '\n\n[... content truncated in preview ...]'
                                  : piece.bodyContent
                                }
                              </div>
                            </div>

                            {/* Editorial notes */}
                            {piece.editorialNotes && (
                              <div className="mt-4 p-3 bg-amber-400/5 border border-amber-400/20 rounded-lg">
                                <div className="text-amber-400 text-xs font-mono font-bold mb-1">Editorial Notes</div>
                                <div className="text-text-secondary text-sm">{piece.editorialNotes}</div>
                              </div>
                            )}

                            {/* Distribution records */}
                            {piece.distributions.length > 0 && (
                              <div className="mt-4 p-3 bg-purple-400/5 border border-purple-400/20 rounded-lg">
                                <div className="text-purple-400 text-xs font-mono font-bold mb-2">Distribution History</div>
                                {piece.distributions.map(d => (
                                  <div key={d.id} className="flex items-center gap-3 text-xs font-mono text-text-dim mb-1">
                                    <span>{DISTRIBUTION_CHANNELS.find(c => c.id === d.channel)?.icon || '📤'}</span>
                                    <span className="text-text-secondary">{d.channel}</span>
                                    <span className={
                                      d.status === 'LIVE' ? 'text-accent-teal' :
                                      d.status === 'SENT' ? 'text-blue-400' :
                                      d.status === 'FAILED' ? 'text-red-400' : 'text-text-dim'
                                    }>{d.status}</span>
                                    {d.externalUrl && (
                                      <a href={d.externalUrl} target="_blank" rel="noopener noreferrer" className="text-accent-teal hover:underline">View ↗</a>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Action bar */}
                            <div className="mt-4 flex items-center gap-2 pt-4 border-t border-console-border">
                              <button
                                onClick={() => startEditing(piece)}
                                className="px-3 py-1.5 rounded text-xs font-mono bg-console-bg border border-console-border hover:border-accent-teal/30 hover:text-accent-teal transition-all"
                              >
                                ✏️ Edit
                              </button>

                              {/* Regenerate with AI */}
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  placeholder="Editorial direction for AI..."
                                  value={regeneratingPiece === piece.id ? editorialDirection : ''}
                                  onChange={(e) => { setRegeneratingPiece(piece.id); setEditorialDirection(e.target.value); }}
                                  className="w-48 bg-console-bg border border-console-border rounded-l-lg px-2 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-dim/50"
                                />
                                <button
                                  onClick={() => regeneratePiece(piece.id)}
                                  disabled={regeneratingPiece === piece.id && !editorialDirection}
                                  className="px-3 py-1.5 rounded-r-lg text-xs font-mono bg-console-bg border border-console-border border-l-0 hover:border-cyan-400/30 hover:text-cyan-400 transition-all disabled:opacity-50"
                                >
                                  {regeneratingPiece === piece.id ? '⟳ Regenerating...' : '🔄 Regenerate'}
                                </button>
                              </div>

                              {/* Distribution trigger */}
                              {['APPROVED', 'READY_FOR_DISTRIBUTION'].includes(piece.status) && (
                                <>
                                  {distributingPiece === piece.id ? (
                                    <div className="flex items-center gap-1 ml-auto">
                                      {DISTRIBUTION_CHANNELS.map(ch => (
                                        <button
                                          key={ch.id}
                                          onClick={() => distributePiece(piece.id, ch.id)}
                                          className="px-2 py-1.5 rounded text-xs font-mono bg-console-bg border border-console-border hover:border-purple-400/30 hover:text-purple-400 transition-all"
                                          title={ch.label}
                                        >
                                          {ch.icon}
                                        </button>
                                      ))}
                                      <button
                                        onClick={() => setDistributingPiece(null)}
                                        className="text-text-dim text-xs hover:text-text-secondary ml-1"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setDistributingPiece(piece.id)}
                                      className="px-3 py-1.5 rounded text-xs font-mono bg-purple-400/10 text-purple-400 border border-purple-400/20 hover:bg-purple-400/20 transition-all ml-auto"
                                    >
                                      🚀 Distribute
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
