import { useAppStore } from '../../store';
import { useSelectedStub } from '../../hooks/useSelectedStub';
import { StubList } from './StubList';
import { StubConfigPanel } from './StubConfigPanel';

export function MocksTab() {
  const { selected } = useSelectedStub();
  const creatingStub = useAppStore(s => s.creatingStub);
  const showDetail = selected || creatingStub;

  return (
    <div className="flex flex-1 min-h-0">
      <aside className={[
        'flex flex-col min-h-0 shrink-0',
        showDetail ? 'w-2/5 min-w-70 border-r border-zinc-800' : 'flex-1',
      ].join(' ')}>
        <StubList />
      </aside>

      {showDetail && (
        <main className="flex-1 min-w-0">
          <StubConfigPanel />
        </main>
      )}
    </div>
  );
}
