import { useAppStore, useCaptureStore } from '../store';

export function useSelectedCapture() {
  const selectedId = useAppStore(s => s.selectedCaptureId);
  const selectCapture = useAppStore(s => s.selectCapture);
  const items = useCaptureStore(s => s.items);

  const selected = selectedId
    ? items.find(i => i.id === selectedId) ?? null
    : null;

  return { selected, selectCapture };
}
