import type { ResolutionType } from '../../types';

const COLORS: Record<ResolutionType, string> = {
  'mock':          'text-indigo-400  bg-indigo-950  ring-indigo-900',
  'network-error': 'text-red-400     bg-red-950     ring-red-900',
  'proxy':         'text-amber-400   bg-amber-950   ring-amber-900',
  'record':        'text-emerald-400 bg-emerald-950 ring-emerald-900',
  'passthrough':   'text-zinc-400    bg-zinc-800    ring-zinc-700',
  'rejected':      'text-red-400     bg-red-950     ring-red-900',
};

const LABELS: Record<ResolutionType, string> = {
  'mock':          'Mock',
  'network-error': 'Net Err',
  'proxy':         'Proxy',
  'record':        'Record',
  'passthrough':   'Pass',
  'rejected':      'Reject',
};

export function ResolutionBadge({ type, className = '' }: { type?: ResolutionType; className?: string }) {
  if (!type) {
    return null;
  }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-sm font-semibold text-2xs ring-1 w-12 justify-center ${COLORS[type]} ${className}`}>
      {LABELS[type]}
    </span>
  );
}
