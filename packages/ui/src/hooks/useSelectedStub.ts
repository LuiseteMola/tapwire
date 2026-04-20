import { useAppStore, useStubStore } from '../store';

export function useSelectedStub() {
  const selectedId = useAppStore(s => s.selectedStubId);
  const selectStub = useAppStore(s => s.selectStub);
  const stubs = useStubStore(s => s.stubs);

  const selected = selectedId
    ? stubs.find(s => s.id === selectedId) ?? null
    : null;

  return { selected, selectedId, selectStub };
}
