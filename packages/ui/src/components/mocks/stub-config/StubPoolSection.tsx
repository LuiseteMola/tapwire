import type { Stub, ResponseMode } from '../../../types';
import { useStubStore } from '../../../store';
import { SegmentedControl } from '../../common';
import { StubResponseRow } from './StubResponseRow';

const MODES: { value: ResponseMode; label: string }[] = [
  { value: 'fixed',      label: 'Fixed' },
  { value: 'sequential', label: 'Sequential' },
  { value: 'random',     label: 'Random' },
];

interface StubPoolSectionProps {
  stub: Stub;
  pool: 'responses' | 'faults';
  title: string;
}

export function StubPoolSection({ stub, pool, title }: StubPoolSectionProps) {
  const update = useStubStore(s => s.update);
  const addResponse = useStubStore(s => s.addResponse);
  const resetCursor = useStubStore(s => s.resetCursor);

  const responsePool = stub[pool];
  const responses = responsePool.responses;
  const modeKey = pool === 'responses' ? 'responsesMode' : 'faultsMode';

  const handleModeChange = (mode: ResponseMode) => {
    update(stub.id, { [modeKey]: mode });
  };

  const handleAdd = () => {
    addResponse(stub.id, pool, {
      statusCode: pool === 'responses' ? 200 : 500,
      headers: {},
      body: {},
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-500">{title}</span>
          {responsePool.mode === 'sequential' && (
            <button
              onClick={() => resetCursor(stub.id, pool)}
              title="Reset sequential cursor to start"
              className="px-1.5 py-0.5 rounded cursor-pointer text-2xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              ↺ Reset cursor
            </button>
          )}
        </div>
        <SegmentedControl value={responsePool.mode} options={MODES} onChange={handleModeChange} />
      </div>

      {responses.length > 0 && (
        <div className="flex items-center gap-2 px-2 text-2xs text-zinc-500">
          <span className="w-8">Status</span>
          <span className="flex-1">Body</span>
          <span className="w-16" />
        </div>
      )}

      <div className="border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
        {responses.map((response, index) => {
          const isActive = responsePool.activeResponseId
            ? response.id === responsePool.activeResponseId
            : index === 0;
          const nextCursorIndex = (responsePool.cursor + 1) % responses.length;
          const isNext = responsePool.mode === 'sequential' && index === nextCursorIndex;
          return (
            <StubResponseRow
              key={`${response.id}-${response.statusCode}`}
              stubId={stub.id}
              pool={pool}
              response={response}
              index={index}
              isActive={isActive}
              isNext={isNext}
              mode={responsePool.mode}
              isFirst={index === 0}
              isLast={index === responses.length - 1}
            />
          );
        })}
        <button
          onClick={handleAdd}
          className="w-full px-3 py-2 text-xs text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors flex items-center gap-1.5 border-dashed"
        >
          <span className="text-sm leading-none">+</span> Add response
        </button>
      </div>
    </div>
  );
}
