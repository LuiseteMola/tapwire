export function HeadersBlock({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers);
  if (entries.length === 0) return <span className="text-zinc-500 italic text-xs">none</span>;
  return (
    <dl className="text-xs space-y-0.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-2 font-mono">
          <dt className="text-zinc-500 shrink-0">{k}:</dt>
          <dd className="text-zinc-300 break-all">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
