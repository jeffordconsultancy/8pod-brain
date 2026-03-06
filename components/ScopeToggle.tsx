'use client';

interface ScopeToggleProps {
  scope: 'mine' | 'team';
  onToggle: (scope: 'mine' | 'team') => void;
  mineLabel?: string;
  teamLabel?: string;
}

export default function ScopeToggle({
  scope,
  onToggle,
  mineLabel = 'My Brain',
  teamLabel = 'Shared Brain',
}: ScopeToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-console-surface p-1 border border-console-border">
      <button
        onClick={() => onToggle('mine')}
        className={`rounded-md px-3 py-1.5 text-sm font-mono transition-colors ${
          scope === 'mine'
            ? 'bg-accent-teal/10 text-accent-teal border border-accent-teal/20'
            : 'text-text-muted hover:text-text-secondary'
        }`}
      >
        {mineLabel}
      </button>
      <button
        onClick={() => onToggle('team')}
        className={`rounded-md px-3 py-1.5 text-sm font-mono transition-colors ${
          scope === 'team'
            ? 'bg-accent-teal/10 text-accent-teal border border-accent-teal/20'
            : 'text-text-muted hover:text-text-secondary'
        }`}
      >
        {teamLabel}
      </button>
    </div>
  );
}
