import { memo, forwardRef } from 'react';
import type { FeedItem } from '../../types';
import { useAppStore } from '../../store';
import { MethodBadge } from '../common';
import { StatusBadge } from '../common';
import { ResolutionBadge } from '../common';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDelta(ms: number): string {
  if (ms < 1000) {
    return `+${ms}ms`;
  }
  if (ms < 60_000) {
    return `+${(ms / 1000).toFixed(1)}s`;
  }
  return `+${(ms / 60_000).toFixed(1)}m`;
}

interface CaptureRowProps {
  item: FeedItem;
  deltaMs: number | null;
  isSelected: boolean;
}

export const CaptureRow = memo(forwardRef<HTMLLIElement, CaptureRowProps>(function CaptureRow({ item, deltaMs, isSelected }, ref) {
  const selectCapture = useAppStore(s => s.selectCapture);
  const isPending = item.served === 'in-flight' || item.type === 'pending';
  const isError = item.served === 'error';

  return (
    <li
      ref={ref}
      onClick={() => selectCapture(item.id)}
      className={[
        'flex items-center gap-2 px-3 py-3 cursor-pointer transition-colors text-xs',
        isPending ? 'opacity-60' : '',
        isSelected ? 'bg-zinc-800' : 'hover:bg-zinc-900',
      ].join(' ')}
    >
      <ResolutionBadge type={item.resolutionType} className={isPending ? 'animate-pulse' : ''} />
      <MethodBadge method={item.method} />

      <div className="flex-1 min-w-0">
        <span className={[
          'block truncate font-mono',
          isPending ? 'text-zinc-600'
            : isError && item.networkError?.source === 'abort' ? 'text-amber-400'
              : isError ? 'text-red-400'
                : item.capture?.promoted ? 'text-zinc-500'
                  : 'text-zinc-200',
        ].join(' ')}>
          {item.pathname}
        </span>
        <span className={[
          'block truncate font-mono text-2xs',
          isError && item.networkError?.source === 'abort' ? 'text-amber-400/60'
            : isError ? 'text-red-400/60'
              : 'text-zinc-400',
        ].join(' ')}>
          {(() => { try { return new URL(item.url).host; } catch { return ''; } })()}
        </span>
      </div>

      <StatusBadge status={item.statusCode} networkError={item.networkError} />

      <span className="text-zinc-400 tabular-nums w-12 text-right">
        {item.latencyMs != null ? `${item.latencyMs}ms` : '---'}
      </span>

      <span className="text-zinc-500 tabular-nums w-14 text-right hidden lg:block text-2xs">
        {deltaMs != null && formatDelta(deltaMs)}
      </span>

      <span className="text-zinc-400 tabular-nums w-20 text-right hidden lg:block">
        {formatTime(item.timestamp)}
      </span>
    </li>
  );
}));
