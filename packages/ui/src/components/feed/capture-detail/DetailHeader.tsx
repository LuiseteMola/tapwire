import type { FeedItem } from '../../../types';
import { useAppStore } from '../../../store';
import { MethodBadge } from '../../common';
import { StatusBadge } from '../../common';

export function DetailHeader({ item }: { item: FeedItem }) {
  const selectCapture = useAppStore(s => s.selectCapture);

  return (
    <div className="flex items-start gap-3 p-4 pb-3 shrink-0">
      <MethodBadge method={item.method} />
      <div className="flex-1 min-w-0">
        <p className="font-mono text-sm text-zinc-100 truncate">{item.url}</p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {new Date(item.timestamp).toLocaleString()}{item.latencyMs != null ? ` · ${item.latencyMs}ms` : ''}
        </p>
      </div>
      <StatusBadge status={item.statusCode} networkError={item.capture?.networkError} />
      <button
        onClick={() => selectCapture(null)}
        title="Close"
        className="text-zinc-600 hover:text-zinc-300 transition-colors text-sm leading-none ml-1 cursor-pointer"
      >
        ✕
      </button>
    </div>
  );
}
