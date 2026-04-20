import { useState } from 'react';
import type { CapturedRequest } from '../../types';
import { useAppStore, useCaptureStore } from '../../store';

export function PromoteForm({ capture }: { capture: CapturedRequest }) {
  const promote = useCaptureStore(s => s.promote);
  const setPromoting = useAppStore(s => s.setPromotingCapture);

  const [host, setHost] = useState(capture.host);
  const [pattern, setPattern] = useState(capture.pathname);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const ok = await promote(capture.id, pattern, capture.method, host);
      if (!ok) {
        setError('Server error');
        return;
      }
      setPromoting(false);
    } catch {
      setError('Could not reach daemon');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <label className="text-xs text-zinc-400">Host</label>
      <input
        value={host}
        onChange={e => setHost(e.target.value)}
        className="rounded-md bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-indigo-500"
        placeholder="api.example.com"
        spellCheck={false}
      />
      <label className="text-xs text-zinc-400">URL pattern</label>
      <div className="flex gap-2">
        <input
          value={pattern}
          onChange={e => setPattern(e.target.value)}
          className="flex-1 rounded-md bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-indigo-500"
          placeholder="/users/:id"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={submitting || !host.trim() || !pattern.trim()}
          className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium text-white transition-colors"
        >
          {submitting ? 'Saving…' : 'Promote'}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </form>
  );
}
