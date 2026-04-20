import { useSelectedCapture } from '../../hooks/useSelectedCapture';
import { CaptureList } from './CaptureList';
import { CaptureDetail } from './capture-detail';
import { StubPanel } from './stub-panel';

export function FeedContent() {
  const { selected } = useSelectedCapture();

  return (
    <div className="flex flex-1 min-h-0">
      <StubPanel />

      <aside className={[
        'flex flex-col min-h-0 shrink-0',
        selected ? 'w-2/5 min-w-70 border-r border-zinc-800' : 'flex-1',
      ].join(' ')}>
        <div className="flex-1 min-h-0">
          <CaptureList />
        </div>
      </aside>

      {selected && (
        <main className="flex-1 min-w-0">
          <CaptureDetail />
        </main>
      )}
    </div>
  );
}
