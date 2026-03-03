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
  teamLabel = 'Team Brain',
}: ScopeToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg bg-gray-800 p-1">
      <button
        onClick={() => onToggle('mine')}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          scope === 'mine'
            ? 'bg-white text-black'
            : 'text-gray-400 hover:text-white'
        }`}
      >
        {mineLabel}
      </button>
      <button
        onClick={() => onToggle('team')}
        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          scope === 'team'
            ? 'bg-white text-black'
            : 'text-gray-400 hover:text-white'
        }`}
      >
        {teamLabel}
      </button>
    </div>
  );
}
