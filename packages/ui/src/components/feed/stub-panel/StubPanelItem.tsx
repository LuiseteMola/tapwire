import type { Stub, StubMode } from '../../../types';
import { useAppStore, useStubStore } from '../../../store';
import { MethodBadge } from '../../common';

const MODES: StubMode[] = ['mock', 'proxy', 'record'];

const MODE_COLORS: Record<StubMode, { active: string; inactive: string; disabled: string }> = {
  mock:   { active: 'bg-indigo-600 text-white',   inactive: 'text-zinc-500 hover:text-indigo-400', disabled: 'bg-indigo-600/40 text-indigo-300/50' },
  proxy:  { active: 'bg-amber-600 text-white',    inactive: 'text-zinc-500 hover:text-amber-400',  disabled: 'bg-amber-600/40 text-amber-300/50' },
  record: { active: 'bg-emerald-600 text-white',  inactive: 'text-zinc-500 hover:text-emerald-400', disabled: 'bg-emerald-600/40 text-emerald-300/50' },
};

export function StubPanelItem({ stub }: { stub: Stub }) {
  const update = useStubStore(s => s.update);
  const serverMode = useStubStore(s => s.serverMode);
  const navigateToStub = useAppStore(s => s.navigateToStub);
  const isOverridden = serverMode !== 'default';
  const effectiveMode = isOverridden ? serverMode as StubMode : stub.mode;

  return (
    <li className="px-3 py-2 space-y-1.5 w-full">
      <button
        onClick={() => navigateToStub(stub.id)}
        className="flex flex-col gap-0.5 min-w-0 w-full text-left cursor-pointer hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <MethodBadge method={stub.method} />
          <span className="text-xs font-mono text-zinc-300 truncate">
            {stub.pattern}
          </span>
        </div>
        <span className="text-2xs font-mono text-zinc-500 truncate pl-0.5">
          {stub.host}
        </span>
      </button>

      <div className="flex gap-1">
        {MODES.map(mode => {
          const isActive = effectiveMode === mode;
          const colors = MODE_COLORS[mode];
          return (
            <button
              key={mode}
              disabled={isOverridden}
              onClick={() => { if (!isActive && !isOverridden) update(stub.id, { mode }); }}
              className={[
                'rounded px-1.5 py-0.5 text-2xs font-semibold capitalize transition-colors',
                isOverridden
                  ? (isActive ? colors.disabled : 'text-zinc-700')
                  : (isActive ? colors.active : `${colors.inactive} cursor-pointer`),
              ].join(' ')}
            >
              {mode}
            </button>
          );
        })}
      </div>
    </li>
  );
}
