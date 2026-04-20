import { useAppStore } from '../../../store';
import { useSelectedCapture } from '../../../hooks/useSelectedCapture';
import { DetailHeader } from './DetailHeader';
import { StubReference } from './StubReference';
import { PromoteActions } from './PromoteActions';
import { DetailTabBar } from './DetailTabBar';
import { HeadersTab } from './HeadersTab';
import { PayloadTab } from './PayloadTab';
import { ResponseTab } from './ResponseTab';
import { StackTraceTab } from './StackTraceTab';

export function CaptureDetail() {
  const { selected } = useSelectedCapture();
  const tab = useAppStore(s => s.detailTab);

  if (!selected) {
    return null;
  }

  if (!selected.capture) {
    return <LightDetail />;
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <DetailHeader item={selected} />
      <StubReference item={selected} />
      <PromoteActions item={selected} />

      <div className="px-4">
        <DetailTabBar />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
        {tab === 'headers' && <HeadersTab item={selected} />}
        {tab === 'payload' && <PayloadTab item={selected} />}
        {tab === 'response' && <ResponseTab item={selected} />}
        {tab === 'stack-trace' && <StackTraceTab item={selected} />}
      </div>
    </div>
  );
}

function LightDetail() {
  const { selected } = useSelectedCapture();

  if (!selected) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      <DetailHeader item={selected} />
      <p className="text-xs text-zinc-500">{selected.type}</p>
    </div>
  );
}
