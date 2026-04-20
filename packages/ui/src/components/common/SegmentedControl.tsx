export function SegmentedControl<T extends string>({
  value, options, onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-md overflow-hidden border border-zinc-700">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={[
            'px-3 py-1 text-xs font-medium transition-colors cursor-pointer',
            value === opt.value
              ? 'bg-zinc-700 text-zinc-100'
              : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
