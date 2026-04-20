import { useSelectedStub } from '../../../hooks/useSelectedStub';
import { useAppStore, useStubStore } from '../../../store';
import { StubConfigHeader } from './StubConfigHeader';
import { BehaviorSection } from './BehaviorSection';
import { StubPoolSection } from './StubPoolSection';
import { FailureRateSection } from './FailureRateSection';

export function StubConfig() {
  const { selected } = useSelectedStub();
  const deleteStub = useStubStore(s => s.deleteStub);
  const selectStub = useAppStore(s => s.selectStub);

  if (!selected) {
    return null;
  }

  const handleRemove = async () => {
    await deleteStub(selected.id);
    selectStub(null);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <StubConfigHeader stub={selected} />

      <div className="flex flex-col gap-6 p-4">
        <BehaviorSection stub={selected} />

        <div className="border-t border-zinc-800" />

        <StubPoolSection stub={selected} pool="responses" title="Responses" />

        <div className="border-t border-zinc-800" />

        <div className="flex flex-col gap-4">
          <StubPoolSection stub={selected} pool="faults" title="Faults" />
          <FailureRateSection stub={selected} />
        </div>

        <div className="border-t border-zinc-800" />

        <button
          onClick={handleRemove}
          className="text-xs text-red-400 hover:text-red-300 transition-colors self-start cursor-pointer"
        >
          Remove stub
        </button>
      </div>
    </div>
  );
}
