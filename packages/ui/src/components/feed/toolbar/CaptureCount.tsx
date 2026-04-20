import { useFeedFilter } from '../../../hooks/useFeedFilter';

export function CaptureCount() {
  const { filters, filtered, total } = useFeedFilter();
  const isFiltering = filters.query.trim().length > 0;

  return (
    <span className="text-xs text-zinc-500 tabular-nums shrink-0">
      {filtered.length}{isFiltering ? `/${total}` : ''}
    </span>
  );
}
