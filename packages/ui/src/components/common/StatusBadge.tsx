import type { CapturedNetworkError } from '../../types';

function colorFor(status: number): string {
  if (status >= 500) return 'text-red-400';
  if (status >= 400) return 'text-amber-400';
  if (status >= 300) return 'text-blue-400';
  return 'text-emerald-400';
}

export function StatusBadge({ status, networkError, className = '' }: {
  status?: number;
  networkError?: CapturedNetworkError;
  className?: string;
}) {
  if (networkError) {
    const color = networkError.source === 'abort' ? 'text-amber-400' : 'text-red-400';
    return (
      <span className={`font-mono text-xs font-semibold ${color} ${className}`} title={networkError.message}>
        {networkError.code}
      </span>
    );
  }
  if (status == null) return null;
  return (
    <span className={`font-mono text-xs font-semibold tabular-nums ${colorFor(status)} ${className}`}>
      {status}
    </span>
  );
}
