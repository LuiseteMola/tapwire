interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer select-none">
      <div
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'relative w-7 h-4 rounded-full transition-colors cursor-pointer',
          checked ? 'bg-emerald-600' : 'bg-zinc-600',
        ].join(' ')}
      >
        <div
          className={[
            'absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform',
            checked ? 'translate-x-3' : '',
          ].join(' ')}
        />
      </div>
      <span className="text-2xs text-zinc-500">{label}</span>
    </label>
  );
}
