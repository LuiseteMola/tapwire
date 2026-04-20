import { useAppStore } from '../../store';
import { useFeedFilter } from '../../hooks/useFeedFilter';
import { useAutoScroll } from '../../hooks/useAutoScroll';
import { CaptureRow } from './CaptureRow';

export function CaptureList() {
  const { filtered } = useFeedFilter();
  const selectedId = useAppStore(s => s.selectedCaptureId);
  const { scrollRef, bottomRef } = useAutoScroll<HTMLUListElement, HTMLLIElement>(filtered.length);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500 text-sm gap-2">
        <span>Waiting for requests…</span>
      </div>
    );
  }

  return (
    <ul ref={scrollRef} className="overflow-y-auto h-full divide-y divide-zinc-800/60">
      {filtered.map((item, i) => {
        const prevTimestamp = i > 0 ? filtered[i - 1].timestamp : null;
        const deltaMs = prevTimestamp
          ? new Date(item.timestamp).getTime() - new Date(prevTimestamp).getTime()
          : null;
        return (
          <CaptureRow
            ref={i === filtered.length - 1 ? bottomRef : null}
            key={item.id}
            item={item}
            deltaMs={deltaMs}
            isSelected={selectedId === item.id}
          />
        );
      })}
    </ul>
  );
}
