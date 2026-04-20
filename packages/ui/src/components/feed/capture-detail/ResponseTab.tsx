import type { FeedItem, BodyCaptureStatus } from '../../../types';
import { Section } from '../../common';
import { BodyBlock } from '../../common';

const SKIP_LABELS: Record<Exclude<BodyCaptureStatus, true>, string> = {
  'non-capturable-content': 'Body not captured — content type is not text-based (e.g. image, binary)',
  'max-size-exceeded': 'Body not captured — response exceeded the maximum capture size',
  'read-error': 'Body not captured — failed to read the response stream',
};

function BodySkipReason({ reason }: { reason: Exclude<BodyCaptureStatus, true> }) {
  return (
    <div className="flex items-center gap-2 text-xs text-amber-400">
      <span className="text-amber-500">!</span>
      <span>{SKIP_LABELS[reason]}</span>
    </div>
  );
}

export function ResponseTab({ item }: { item: FeedItem }) {
  const capture = item.capture;
  if (!capture) {
    return null;
  }

  const hasResponse = capture.served === 'served';
  const isError = capture.served === 'error';

  if (isError && capture.networkError) {
    return (
      <Section title={capture.networkError.source === 'abort' ? 'Request Aborted' : 'Network Error'}>
        <div className="flex flex-col gap-1.5 text-xs">
          <div className={`flex items-center gap-2 ${capture.networkError.source === 'abort' ? 'text-amber-400' : 'text-red-400'}`}>
            <span className="font-mono font-semibold">{capture.networkError.code}</span>
            <span className="text-zinc-500">{capture.networkError.source === 'abort' ? 'programmatic' : 'network'}</span>
          </div>
          <p className="text-zinc-400">{capture.networkError.message}</p>
        </div>
      </Section>
    );
  }

  if (hasResponse) {
    return (
      <Section title="Response Body">
        {capture.bodyCaptured === true || capture.bodyCaptured == null ? (
          <BodyBlock value={capture.responseBody} />
        ) : (
          <BodySkipReason reason={capture.bodyCaptured} />
        )}
      </Section>
    );
  }

  return <p className="text-xs text-zinc-500 animate-pulse">Waiting for response…</p>;
}
