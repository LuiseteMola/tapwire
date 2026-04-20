import { useAppStore, type Tab } from '../../store';

export function TabNav() {
  const activeTab = useAppStore(s => s.tab);
  const setTab = useAppStore(s => s.setTab);

  return (
    <nav className="flex gap-1">
      {(['feed', 'mocks'] as Tab[]).map(tab => (
        <button
          key={tab}
          onClick={() => setTab(tab)}
          className={[
            'px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer',
            activeTab === tab
              ? 'bg-zinc-800 text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300',
          ].join(' ')}
        >
          {tab === 'feed' ? 'Feed' : 'Mocks'}
        </button>
      ))}
    </nav>
  );
}
