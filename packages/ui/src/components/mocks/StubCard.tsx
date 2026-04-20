import type { Stub, StubMode } from '../../types';
import { useStubStore } from '../../store';
import { MethodBadge } from '../common';
import { StatusBadge } from '../common';

const MODE_LABELS: Record<StubMode, string> = {
  mock:   'Mock',
  proxy:  'Proxy',
  record: 'Record',
};

const MODE_COLORS: Record<StubMode, string> = {
  mock:   'text-indigo-400 bg-indigo-950 ring-indigo-900',
  proxy:  'text-amber-400  bg-amber-950  ring-amber-900',
  record: 'text-emerald-400 bg-emerald-950 ring-emerald-900',
};

export function StubCard({ stub }: { stub: Stub }) {
  const update = useStubStore(s => s.update);
  const deleteStub = useStubStore(s => s.deleteStub);
  const deleteResponse = useStubStore(s => s.deleteResponse);
  const responses = stub.responses.responses;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
        <MethodBadge method={stub.method} />
        <span className="flex-1 font-mono text-sm text-zinc-100 truncate">{stub.pattern}</span>

        <select
          value={stub.mode}
          onChange={e => update(stub.id, { mode: e.target.value as StubMode })}
          className={`text-2xs font-semibold rounded px-2 py-0.5 ring-1 border-0 outline-none cursor-pointer ${MODE_COLORS[stub.mode]}`}
          style={{ background: 'transparent' }}
        >
          {(Object.keys(MODE_LABELS) as StubMode[]).map(m => (
            <option key={m} value={m} className="bg-zinc-900 text-zinc-100">
              {MODE_LABELS[m]}
            </option>
          ))}
        </select>

        <button
          onClick={() => deleteStub(stub.id)}
          title="Delete stub"
          className="text-zinc-600 hover:text-red-400 transition-colors text-sm leading-none"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-px p-2">
        {responses.length === 0 ? (
          <p className="text-xs text-zinc-500 italic px-2 py-1">No responses in pool</p>
        ) : (
          responses.map(r => (
            <div
              key={r.id}
              className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-800 group"
            >
              <StatusBadge status={r.statusCode} />
              <span className="flex-1 font-mono text-xs text-zinc-400 truncate">
                {r.label ?? JSON.stringify(r.body).slice(0, 60)}
              </span>
              <button
                onClick={() => deleteResponse(stub.id, r.id)}
                title="Remove response"
                className="text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs leading-none"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
