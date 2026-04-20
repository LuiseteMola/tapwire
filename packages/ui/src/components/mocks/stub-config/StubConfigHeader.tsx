import { useState } from 'react';
import type { Stub, HttpMethod } from '../../../types';
import { useAppStore, useStubStore } from '../../../store';
import { MethodBadge } from '../../common';

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

export function StubConfigHeader({ stub }: { stub: Stub }) {
  const selectStub = useAppStore(s => s.selectStub);
  const update = useStubStore(s => s.update);

  const [editing, setEditing] = useState(false);
  const [editMethod, setEditMethod] = useState(stub.method);
  const [editPattern, setEditPattern] = useState(stub.pattern);
  const [editHost, setEditHost] = useState(stub.host);

  const openEdit = () => {
    setEditMethod(stub.method);
    setEditPattern(stub.pattern);
    setEditHost(stub.host);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  const saveEdit = async () => {
    const trimmedPattern = editPattern.trim();
    const trimmedHost = editHost.trim();
    if (!trimmedPattern || !trimmedHost) {
      return;
    }
    await update(stub.id, {
      method: editMethod,
      pattern: trimmedPattern,
      host: trimmedHost,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-2 px-4 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <select
            value={editMethod}
            onChange={e => setEditMethod(e.target.value as HttpMethod)}
            className="rounded bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs font-mono font-bold text-zinc-100 focus:outline-none focus:border-zinc-500"
          >
            {HTTP_METHODS.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <input
            type="text"
            value={editPattern}
            onChange={e => setEditPattern(e.target.value)}
            placeholder="/path/:param"
            className="flex-1 rounded bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
          />
        </div>
        <input
          type="text"
          value={editHost}
          onChange={e => setEditHost(e.target.value)}
          placeholder="api.example.com"
          className="rounded bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
        />
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={cancelEdit}
            className="px-2.5 py-1 rounded text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-700 hover:bg-zinc-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={saveEdit}
            className="px-2.5 py-1 rounded text-xs font-medium text-zinc-100 bg-indigo-600 hover:bg-indigo-500 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 shrink-0">
      <MethodBadge method={stub.method} />
      <div className="flex-1 min-w-0">
        <span className="block font-mono text-sm text-zinc-100 truncate">{stub.pattern}</span>
        <span className="block text-2xs font-mono text-zinc-500 truncate">{stub.host}</span>
      </div>
      <button
        onClick={openEdit}
        title="Edit endpoint"
        className="text-zinc-600 hover:text-zinc-300 transition-colors text-xs cursor-pointer"
      >
        ✎
      </button>
      <button
        onClick={() => selectStub(null)}
        title="Close"
        className="text-zinc-600 hover:text-zinc-300 transition-colors text-sm leading-none ml-1 cursor-pointer"
      >
        ✕
      </button>
    </div>
  );
}
