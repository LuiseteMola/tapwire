import { useState } from 'react';
import type { FeedItem } from '../../../types';
import { useAppStore, useCaptureStore, useStubStore } from '../../../store';
import { PromoteForm } from '../PromoteForm';

export function PromoteActions({ item }: { item: FeedItem }) {
  const addToStub = useCaptureStore(s => s.addToStub);
  const matchedStub = useStubStore(s => s.stubs.find(st => st.id === item.stubId)) ?? null;
  const promoting = useAppStore(s => s.promotingCapture);
  const setPromoting = useAppStore(s => s.setPromotingCapture);
  const [addingToStub, setAddingToStub] = useState(false);

  const { capture } = item;
  if (!capture) {
    return null;
  }

  const hasResponse = capture.served === 'served';
  const isError = capture.served === 'error';
  const isMocked = item.resolutionType === 'mock';
  const isRecording = item.resolutionType === 'record';
  const hasMatchingStub = !!matchedStub && !isMocked && !isRecording;
  const canPromote = hasResponse && !isError && !capture.promoted && !isMocked && !isRecording;
  const stubLabel = matchedStub ? `${matchedStub.method} ${matchedStub.pattern}` : undefined;

  const handleAddToStub = async () => {
    if (!item.stubId) {
      return;
    }
    setAddingToStub(true);
    try {
      await addToStub(item.id, item.stubId);
      setPromoting(false);
    } catch { /* ignore */ }
    finally { setAddingToStub(false); }
  };

  if (capture.promoted) {
    return (
      <div className="px-4 pb-3 shrink-0">
        <div className="flex items-center gap-2 rounded-md bg-emerald-950 border border-emerald-800 px-3 py-2 text-xs text-emerald-400">
          <span>✓</span>
          <span>Response added to <span className="font-mono">{stubLabel ?? 'stub'}</span></span>
        </div>
      </div>
    );
  }

  if (promoting) {
    return (
      <div className="px-4 pb-3 shrink-0">
        <PromoteForm capture={capture} />
      </div>
    );
  }

  if (!canPromote) {
    return null;
  }

  return (
    <div className="px-4 pb-3 shrink-0 flex flex-col gap-2">
      {hasMatchingStub && (
        <button
          onClick={handleAddToStub}
          disabled={addingToStub}
          className="w-full px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-xs font-medium text-white transition-colors"
        >
          {addingToStub ? 'Adding…' : `Add response to ${stubLabel}`}
        </button>
      )}
      <button
        onClick={() => setPromoting(true)}
        className={[
          'w-full px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer',
          hasMatchingStub
            ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
            : 'bg-indigo-600 hover:bg-indigo-500 text-white',
        ].join(' ')}
      >
        Create new stub
      </button>
    </div>
  );
}
