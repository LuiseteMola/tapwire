import type { ServerMode } from '../../../types';
import { useStubStore } from '../../../store';
import { Switch } from '../../common';

const MODES: { value: ServerMode; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'mock',    label: 'Mock' },
  { value: 'proxy',   label: 'Proxy' },
  { value: 'record',  label: 'Record' },
];

export function ModeSelector({ className = '' }: { className?: string }) {
  const mode = useStubStore(s => s.serverMode);
  const strict = useStubStore(s => s.strict);
  const setServerSettings = useStubStore(s => s.setServerSettings);
  const strictApplicable = mode === 'mock' || mode === 'record';

  return (
    <div className={`flex flex-col gap-2 px-3 py-2 border-b border-zinc-800 ${className}`}>
      <div className="flex items-center gap-1">
        <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-500 mr-2">Mode</span>
        {MODES.map(opt => (
          <button
            key={opt.value}
            onClick={() => setServerSettings({ mode: opt.value })}
            className={[
              'px-2 py-0.5 rounded text-2xs font-medium transition-colors cursor-pointer',
              mode === opt.value
                ? 'bg-indigo-600 text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800',
            ].join(' ')}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {strictApplicable && (
        <Switch
          checked={strict}
          onChange={(checked) => setServerSettings({ strict: checked })}
          label="Strict — reject unmatched requests (501)"
        />
      )}
    </div>
  );
}
