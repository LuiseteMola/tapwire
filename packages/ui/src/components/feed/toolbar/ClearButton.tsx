import { useCaptureStore } from '../../../store';

export function ClearButton() {
  const clearAll = useCaptureStore(s => s.clearAll);

  return (
    <button
      onClick={clearAll}
      title="Clear all captures"
      className="text-xs text-zinc-500 hover:text-red-400 transition-colors shrink-0 cursor-pointer"
    >
      Clear
    </button>
  );
}
