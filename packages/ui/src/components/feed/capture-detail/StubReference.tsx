import type { FeedItem } from '../../../types';
import { useAppStore, useStubStore } from '../../../store';

export function StubReference({ item }: { item: FeedItem }) {
  const navigateToStub = useAppStore(s => s.navigateToStub);
  const matchedStub = useStubStore(s => s.stubs.find(st => st.id === item.stubId)) ?? null;

  if (!matchedStub) {
    return null;
  }

  const isMocked = item.resolutionType === 'mock';
  const isRecording = item.resolutionType === 'record';
  const stubLabel = `${matchedStub.method} ${matchedStub.pattern}`;

  return (
    <div className="px-4 pb-3 shrink-0">
      <button
        onClick={() => item.stubId && navigateToStub(item.stubId)}
        className={[
          'flex items-center gap-2 rounded-md px-3 py-2 w-full text-left transition-colors cursor-pointer',
          isMocked
            ? 'bg-indigo-950 border border-indigo-900 hover:bg-indigo-900/60'
            : isRecording
              ? 'bg-emerald-950 border border-emerald-900 hover:bg-emerald-900/60'
              : 'bg-amber-950 border border-amber-900 hover:bg-amber-900/60',
        ].join(' ')}
      >
        <span className={[
          'text-2xs font-bold tracking-wider',
          isMocked ? 'text-indigo-400' : isRecording ? 'text-emerald-400' : 'text-amber-400',
        ].join(' ')}>
          {item.resolutionType?.toUpperCase()}
        </span>
        <span className={[
          'text-xs font-mono flex-1',
          isMocked ? 'text-indigo-300' : isRecording ? 'text-emerald-300' : 'text-amber-300',
        ].join(' ')}>
          {stubLabel}
        </span>

      </button>
    </div>
  );
}
