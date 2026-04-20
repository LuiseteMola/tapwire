import { useFeedFilter } from '../../../hooks/useFeedFilter';

export function FilterInput() {
  const { filters, setFeedFilters } = useFeedFilter();

  return (
    <div className="relative flex-1 min-w-0">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-600 text-xs pointer-events-none">
        /
      </span>
      <input
        type="text"
        value={filters.query}
        onChange={e => setFeedFilters({ query: e.target.value })}
        placeholder="Filter by path…"
        className="w-full rounded bg-zinc-800 border border-zinc-700 pl-5 pr-7 py-1 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
      />
      {filters.query && (
        <button
          onClick={() => setFeedFilters({ query: '' })}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 text-xs cursor-pointer"
        >
          ✕
        </button>
      )}
    </div>
  );
}
