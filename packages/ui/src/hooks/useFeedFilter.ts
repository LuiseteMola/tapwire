import { useMemo } from 'react';
import { useAppStore, useCaptureStore } from '../store';

export function useFeedFilter() {
  const items = useCaptureStore(s => s.items);
  const filters = useAppStore(s => s.feedFilters);
  const setFeedFilters = useAppStore(s => s.setFeedFilters);

  const filtered = useMemo(() => {
    let result = items;

    if (filters.query.trim()) {
      const q = filters.query.toLowerCase();
      result = result.filter(i => i.pathname.toLowerCase().includes(q));
    }

    return result;
  }, [items, filters]);

  return {
    filters,
    setFeedFilters,
    filtered,
    total: items.length,
  };
}
