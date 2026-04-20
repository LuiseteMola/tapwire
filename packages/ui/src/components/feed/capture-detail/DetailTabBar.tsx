import { useAppStore, type DetailTab } from '../../../store';

const TABS: { value: DetailTab; label: string }[] = [
  { value: 'headers', label: 'Headers' },
  { value: 'payload', label: 'Payload' },
  { value: 'response', label: 'Response' },
  { value: 'stack-trace', label: 'Stack Trace' },
];

export function DetailTabBar() {
  const active = useAppStore(s => s.detailTab);
  const setDetailTab = useAppStore(s => s.setDetailTab);

  return (
    <div className="flex border-b border-zinc-800 shrink-0">
      {TABS.map(t => (
        <button
          key={t.value}
          onClick={() => setDetailTab(t.value)}
          className={[
            'px-4 py-2 text-xs font-medium transition-colors cursor-pointer',
            active === t.value
              ? 'text-zinc-100 border-b-2 border-zinc-400 -mb-px'
              : 'text-zinc-500 hover:text-zinc-300',
          ].join(' ')}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
