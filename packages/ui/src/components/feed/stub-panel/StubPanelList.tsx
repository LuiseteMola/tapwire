import { useStubStore } from '../../../store';
import { StubPanelItem } from './StubPanelItem';

export function StubPanelList() {
  const stubs = useStubStore(s => s.stubs);

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 shrink-0">
        <span className="text-xs font-semibold text-zinc-400">Stubs</span>
        <span className="text-xs text-zinc-500 tabular-nums">{stubs.length}</span>
      </div>

      {stubs.length === 0 ? (
        <div className="flex items-center justify-center flex-1 text-zinc-500 text-xs px-3 text-center">
          No stubs yet
        </div>
      ) : (
        <ul className="overflow-y-auto flex-1 divide-y divide-zinc-800/60">
          {stubs.map(stub => (
            <StubPanelItem key={stub.id} stub={stub} />
          ))}
        </ul>
      )}
    </>
  );
}
