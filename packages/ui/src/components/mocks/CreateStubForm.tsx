import { useState } from 'react';
import type { HttpMethod, StubMode } from '../../types';
import { useAppStore, useStubStore } from '../../store';


const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const MODES: { value: StubMode; label: string }[] = [
  { value: 'mock', label: 'Mock' },
  { value: 'proxy', label: 'Proxy' },
  { value: 'record', label: 'Record' },
];

export function CreateStubForm() {
  const createStub = useStubStore(s => s.createStub);
  const setCreatingStub = useAppStore(s => s.setCreatingStub);

  const [method, setMethod] = useState<HttpMethod>('GET');
  const [host, setHost] = useState('');
  const [pattern, setPattern] = useState('');
  const [mode, setMode] = useState<StubMode>('mock');
  const [statusCode, setStatusCode] = useState('200');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!host.trim() || !pattern.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    let parsedBody: unknown = null;
    if (body.trim()) {
      try {
        parsedBody = JSON.parse(body);
      } catch {
        setError('Invalid JSON body');
        setSubmitting(false);
        return;
      }
    }

    try {
      await createStub({
        method,
        host: host.trim(),
        pattern: pattern.trim(),
        mode,
        statusCode: Number(statusCode) || 200,
        body: parsedBody,
      });
      setCreatingStub(false);
    } catch {
      setError('Failed to create stub');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">New Stub</h3>

      <div className="flex flex-col gap-2">
        <input
          value={host}
          onChange={e => setHost(e.target.value)}
          placeholder="api.example.com"
          spellCheck={false}
          className="rounded-md bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
        />
        <div className="flex gap-2">
          <select
            value={method}
            onChange={e => setMethod(e.target.value as HttpMethod)}
            className="rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-indigo-500"
          >
            {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <input
            value={pattern}
            onChange={e => setPattern(e.target.value)}
            placeholder="/users/:id"
            spellCheck={false}
            className="flex-1 rounded-md bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="flex gap-2 items-center">
        <label className="text-xs text-zinc-500 w-12">Mode</label>
        <select
          value={mode}
          onChange={e => setMode(e.target.value as StubMode)}
          className="rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500"
        >
          {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div className="flex gap-2 items-center">
        <label className="text-xs text-zinc-500 w-12">Status</label>
        <input
          type="number"
          value={statusCode}
          onChange={e => setStatusCode(e.target.value)}
          className="w-20 rounded-md bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500">Response body (JSON)</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder='{ "id": 1, "name": "Jane" }'
          rows={4}
          spellCheck={false}
          className="rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 resize-y"
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || !host.trim() || !pattern.trim()}
          className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-medium text-white transition-colors"
        >
          {submitting ? 'Creating…' : 'Create Stub'}
        </button>
        <button
          type="button"
          onClick={() => setCreatingStub(false)}
          className="px-4 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
