import { useState } from 'react';

function isDataUri(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:');
}

function isImageDataUri(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:image/');
}

function isSvg(value: unknown): value is string {
  return typeof value === 'string' && value.trimStart().startsWith('<svg');
}

function RawBlock({ value }: { value: string }) {
  return (
    <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap break-all max-h-64 overflow-auto">
      {value}
    </pre>
  );
}

export function BodyBlock({ value }: { value: unknown }) {
  const [showRaw, setShowRaw] = useState(false);

  if (value === null || value === undefined || value === '') {
    return <span className="text-zinc-500 italic">empty</span>;
  }

  if (isImageDataUri(value)) {
    return (
      <div className="flex flex-col gap-2">
        <img src={value} alt="Response body" className="max-w-full max-h-64 rounded border border-zinc-700 object-contain bg-zinc-950" />
        <button
          onClick={() => setShowRaw(!showRaw)}
          className="text-2xs text-zinc-600 hover:text-zinc-400 transition-colors self-start"
        >
          {showRaw ? 'Hide raw' : 'Show raw'}
        </button>
        {showRaw && <RawBlock value={value} />}
      </div>
    );
  }

  if (isSvg(value)) {
    const svgDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(value)}`;
    return (
      <div className="flex flex-col gap-2">
        <img src={svgDataUri} alt="Response body" className="max-w-full max-h-64 rounded border border-zinc-700 object-contain bg-zinc-950" />
        <button
          onClick={() => setShowRaw(!showRaw)}
          className="text-2xs text-zinc-600 hover:text-zinc-400 transition-colors self-start"
        >
          {showRaw ? 'Hide raw' : 'Show raw'}
        </button>
        {showRaw && <RawBlock value={value} />}
      </div>
    );
  }

  if (isDataUri(value)) {
    const mimeType = value.slice(5, value.indexOf(';'));
    return (
      <div className="flex flex-col gap-2">
        <span className="text-xs text-zinc-500">Binary content ({mimeType})</span>
        <button
          onClick={() => setShowRaw(!showRaw)}
          className="text-2xs text-zinc-600 hover:text-zinc-400 transition-colors self-start"
        >
          {showRaw ? 'Hide raw' : 'Show raw'}
        </button>
        {showRaw && <RawBlock value={value} />}
      </div>
    );
  }

  return (
    <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap break-all">
      {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}
