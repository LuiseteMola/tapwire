import type { FeedItem } from '../../../types';
import { Section, HeadersBlock } from '../../common';

function GeneralSection({ item }: { item: FeedItem }) {
  const capture = item.capture;
  if (!capture) {
    return null;
  }

  const parsedUrl = (() => { try { return new URL(capture.url); } catch { return null; } })();
  const queryParams = parsedUrl ? Array.from(parsedUrl.searchParams.entries()) : [];

  return (
    <Section title="General">
      <dl className="text-xs space-y-0.5 font-mono">
        <div className="flex gap-2">
          <dt className="text-zinc-500 shrink-0">Request URL:</dt>
          <dd className="text-zinc-300 break-all">{capture.url}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-zinc-500 shrink-0">Request Method:</dt>
          <dd className="text-zinc-300">{capture.method}</dd>
        </div>

        {capture.networkError ? (
          <div className="flex gap-2">
            <dt className="text-zinc-500 shrink-0">Network Error:</dt>
            <dd className="text-red-400">{capture.networkError.code}</dd>
          </div>
        ) : capture.responseStatus != null && (
          <div className="flex gap-2">
            <dt className="text-zinc-500 shrink-0">Status Code:</dt>
            <dd className="text-zinc-300">{capture.responseStatus}</dd>
          </div>
        )}
      </dl>
      {queryParams.length > 0 && (
        <div className="mt-3 pt-2 border-t border-zinc-800">
          <h4 className="text-2xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">Query Parameters</h4>
          <dl className="text-xs space-y-0.5 font-mono">
            {queryParams.map(([k, v], i) => (
              <div key={`${k}-${i}`} className="flex gap-2">
                <dt className="text-zinc-500 shrink-0">{k}:</dt>
                <dd className="text-zinc-300 break-all">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Section>
  );
}

export function HeadersTab({ item }: { item: FeedItem }) {
  const capture = item.capture;
  if (!capture) {
    return null;
  }

  const hasResponse = capture.served === 'served';
  const isError = capture.served === 'error';

  return (
    <>
      <GeneralSection item={item} />
      <Section title="Response Headers">
        {hasResponse ? (
          <HeadersBlock headers={capture.responseHeaders!} />
        ) : isError ? (
          <span className={`text-xs ${capture.networkError?.source === 'abort' ? 'text-amber-400' : 'text-red-400'}`}>
            {capture.networkError?.source === 'abort' ? 'No response — request aborted' : 'No response — connection failed'}
          </span>
        ) : (
          <span className="text-xs text-zinc-500 animate-pulse">Waiting for response…</span>
        )}
      </Section>
      <Section title="Request Headers"><HeadersBlock headers={capture.requestHeaders} /></Section>
    </>
  );
}
