import type { FeedItem, StackFrame } from '../../../types';
import { Section } from '../../common';

function shortenPath(filePath: string): string {
  const srcIndex = filePath.indexOf('/src/');
  if (srcIndex !== -1) {
    return filePath.slice(srcIndex + 1);
  }
  const segments = filePath.split('/');
  return segments.slice(-2).join('/');
}

function CallStackFrame({ frame }: { frame: StackFrame }) {
  const isLibrary = frame.file.includes('node_modules');

  return (
    <div className="flex items-baseline gap-2 text-xs font-mono">
      <span className={isLibrary ? 'text-amber-400' : 'text-indigo-400'}>
        {frame.fn}
      </span>
      <span className="text-zinc-500">
        {shortenPath(frame.file)}:{frame.line}
      </span>
    </div>
  );
}

export function StackTraceTab({ item }: { item: FeedItem }) {
  const capture = item.capture;
  if (!capture) {
    return null;
  }

  const frames = capture.initiator ?? [];

  if (frames.length === 0) {
    return (
      <div className="text-xs text-zinc-500">
        No call stack captured for this request.
      </div>
    );
  }

  return (
    <Section title="Call Stack">
      <div className="flex flex-col gap-0.5">
        {frames.map((frame, i) => (
          <CallStackFrame key={i} frame={frame} />
        ))}
      </div>
    </Section>
  );
}
