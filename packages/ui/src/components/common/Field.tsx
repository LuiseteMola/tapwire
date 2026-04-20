export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-xs text-zinc-500 w-32 shrink-0">{label}</span>
      {children}
    </div>
  );
}
