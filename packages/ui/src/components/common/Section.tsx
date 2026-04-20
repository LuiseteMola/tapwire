export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-2xs font-semibold uppercase tracking-wider text-zinc-500">{title}</h3>
      <div className="rounded-md bg-zinc-900 border border-zinc-800 p-3 overflow-auto max-h-48">
        {children}
      </div>
    </div>
  );
}
