'use client';

interface Phase {
  id: string;
  label: string;
  status: 'complete' | 'active' | 'locked';
}

interface PhaseIndicatorProps {
  phases: Phase[];
  compact?: boolean;
}

export default function PhaseIndicator({ phases, compact = false }: PhaseIndicatorProps) {
  return (
    <div className="flex items-center gap-1">
      {phases.map((phase, index) => (
        <div key={phase.id} className="flex items-center">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
              phase.status === 'active'
                ? 'bg-accent-teal/10 text-accent-teal border border-accent-teal/30'
                : phase.status === 'complete'
                ? 'bg-accent-teal/5 text-accent-teal/60 border border-accent-teal/10'
                : 'bg-console-surface text-text-dim border border-console-border'
            }`}
          >
            {phase.status === 'complete' && <span>✓</span>}
            {phase.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-accent-teal animate-pulse-dot" />}
            {phase.status === 'locked' && <span className="opacity-40">🔒</span>}
            {!compact && <span>{phase.label}</span>}
            {compact && <span>{phase.label.split(' ')[0]}</span>}
          </div>
          {index < phases.length - 1 && (
            <span className={`mx-1 text-xs ${phase.status === 'complete' ? 'text-accent-teal/40' : 'text-text-dim'}`}>→</span>
          )}
        </div>
      ))}
    </div>
  );
}
