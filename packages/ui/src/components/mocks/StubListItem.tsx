import type { Stub, StubMode } from '../../types';
import { useAppStore } from '../../store';
import { MethodBadge } from '../common';

const MODE_BADGE: Record<StubMode, { label: string; className: string }> = {
  mock:   { label: 'mock',   className: 'text-indigo-400  bg-indigo-950  ring-indigo-900' },
  proxy:  { label: 'proxy',  className: 'text-amber-400   bg-amber-950   ring-amber-900'  },
  record: { label: 'record', className: 'text-emerald-400 bg-emerald-950 ring-emerald-900' },
};

function ModeBadge({ mode }: { mode: StubMode }) {
  const badge = MODE_BADGE[mode];
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-bold tracking-wider ring-1 w-14 justify-center ${badge.className}`}>
      {badge.label}
    </span>
  );
}

export function StubListItem({ stub }: { stub: Stub }) {
  const selectedId = useAppStore(s => s.selectedStubId);
  const selectStub = useAppStore(s => s.selectStub);
  const totalResponses = stub.responses.responses.length + stub.faults.responses.length;

  return (
    <li
      onClick={() => selectStub(stub.id)}
      className={[
        'flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors text-xs',
        selectedId === stub.id ? 'bg-zinc-800' : 'hover:bg-zinc-900',
      ].join(' ')}
    >
      <ModeBadge mode={stub.mode} />
      <MethodBadge method={stub.method} />

      <div className="flex-1 min-w-0">
        <span className="block font-mono text-zinc-200 truncate">{stub.pattern}</span>
        <span className="block text-2xs font-mono text-zinc-500 truncate">{stub.host}</span>
      </div>

      <span className="text-zinc-500 tabular-nums">{totalResponses}r</span>
    </li>
  );
}
