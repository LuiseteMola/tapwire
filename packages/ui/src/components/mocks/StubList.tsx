import { useAppStore, useStubStore } from '../../store';
import { useStubFilter } from '../../hooks/useStubFilter';
import { StubListItem } from './StubListItem';

export function StubList() {
  const loading = useStubStore(s => s.loading);
  const refresh = useStubStore(s => s.refresh);
  const creatingStub = useAppStore(s => s.creatingStub);
  const setCreatingStub = useAppStore(s => s.setCreatingStub);
  const { filters, setStubFilters, filtered, total } = useStubFilter();

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0">
        <span className="text-xs font-semibold text-zinc-400">Stubs</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 tabular-nums">{total}</span>
          <button
            onClick={() => setCreatingStub(true)}
            className="text-xs cursor-pointer text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
          >
            + New
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="text-xs cursor-pointer text-zinc-500 hover:text-zinc-300 disabled:opacity-40 transition-colors"
          >
            {loading ? '…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-zinc-800 shrink-0">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-600 text-xs pointer-events-none">
            /
          </span>
          <input
            type="text"
            value={filters.query}
            onChange={e => setStubFilters({ query: e.target.value })}
            placeholder="Filter by path or host…"
            className="w-full rounded bg-zinc-800 border border-zinc-700 pl-5 pr-7 py-1 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          />
          {filters.query && (
            <button
              onClick={() => setStubFilters({ query: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {total === 0 && !loading && !creatingStub ? (
        <div className="flex flex-col items-center justify-center flex-1 text-zinc-500 text-sm gap-2">
          <span className="text-2xl">🧩</span>
          <span className="text-center px-4">No stubs yet — promote a capture or create one manually</span>
        </div>
      ) : (
        <ul className="overflow-y-auto flex-1 divide-y divide-zinc-800/60">
          {filtered.map(stub => (
            <StubListItem key={stub.id} stub={stub} />
          ))}
        </ul>
      )}
    </div>
  );
}
