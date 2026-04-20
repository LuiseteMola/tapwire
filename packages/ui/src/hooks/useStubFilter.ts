import { useMemo } from 'react';
import { useAppStore, useStubStore } from '../store';

export function useStubFilter() {
  const stubs = useStubStore(s => s.stubs);
  const filters = useAppStore(s => s.stubFilters);
  const setStubFilters = useAppStore(s => s.setStubFilters);

  const filtered = useMemo(() => {
    let result = [...stubs].sort((a, b) =>
      a.pattern.localeCompare(b.pattern),
    );

    if (filters.query.trim()) {
      const q = filters.query.toLowerCase();
      result = result.filter(s =>
        s.pattern.toLowerCase().includes(q) ||
        s.host.toLowerCase().includes(q),
      );
    }

    return result;
  }, [stubs, filters]);

  return {
    filters,
    setStubFilters,
    filtered,
    total: stubs.length,
  };
}
