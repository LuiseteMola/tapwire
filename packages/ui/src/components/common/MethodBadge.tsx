import type { HttpMethod } from '../../types';

const COLORS: Record<HttpMethod, string> = {
  GET:     'bg-blue-950    text-blue-400    ring-blue-900',
  POST:    'bg-emerald-950 text-emerald-400 ring-emerald-900',
  PUT:     'bg-amber-950   text-amber-400   ring-amber-900',
  PATCH:   'bg-teal-950    text-teal-400    ring-teal-900',
  DELETE:  'bg-red-950     text-red-400     ring-red-900',
  HEAD:    'bg-purple-950  text-purple-400  ring-purple-900',
  OPTIONS: 'bg-zinc-800    text-zinc-400    ring-zinc-700',
};

export function MethodBadge({ method, className = '' }: { method: HttpMethod; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-2xs font-semibold tracking-wider ring-1 ${COLORS[method]} ${className}`}>
      {method}
    </span>
  );
}
