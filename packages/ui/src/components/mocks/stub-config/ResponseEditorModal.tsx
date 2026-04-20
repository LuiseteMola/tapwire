import { useState } from 'react';
import type { StubResponse } from '../../../types';
import { useStubStore } from '../../../store';
import { Modal, StatusBadge } from '../../common';

interface ResponseEditorModalProps {
  stubId: string;
  response: StubResponse;
  open: boolean;
  onClose: () => void;
}

function formatHeaders(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

function parseHeaders(text: string): Record<string, string> | null {
  const headers: Record<string, string> = {};
  if (text.trim() === '') {
    return headers;
  }
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') {
      continue;
    }
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex < 1) {
      return null;
    }
    const key = trimmed.slice(0, colonIndex).trim();
    const value = trimmed.slice(colonIndex + 1).trim();
    headers[key] = value;
  }
  return headers;
}

export function ResponseEditorModal({ stubId, response, open, onClose }: ResponseEditorModalProps) {
  const updateResponse = useStubStore(s => s.updateResponse);

  const [editStatus, setEditStatus] = useState(String(response.statusCode));
  const [editHeaders, setEditHeaders] = useState(formatHeaders(response.headers));
  const [editBody, setEditBody] = useState(
    response.body != null ? JSON.stringify(response.body, null, 2) : '',
  );
  const [error, setError] = useState('');

  const handleSave = async () => {
    const status = Number(editStatus);
    if (!Number.isInteger(status) || status < 100 || status > 599) {
      setError('Status code must be 100–599');
      return;
    }

    const parsedHeaders = parseHeaders(editHeaders);
    if (parsedHeaders === null) {
      setError('Invalid header format. Use "Key: Value" per line.');
      return;
    }

    let parsedBody: unknown = null;
    const trimmedBody = editBody.trim();
    if (trimmedBody !== '') {
      try {
        parsedBody = JSON.parse(trimmedBody);
      } catch {
        setError('Body must be valid JSON');
        return;
      }
    }

    setError('');
    await updateResponse(stubId, response.id, {
      statusCode: status,
      headers: parsedHeaders,
      body: parsedBody,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit response">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-2xs text-zinc-500 uppercase tracking-wider">Status</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={100}
                max={599}
                value={editStatus}
                onChange={e => { setEditStatus(e.target.value); setError(''); }}
                className="w-20 rounded bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-500"
              />
              <StatusBadge status={Number(editStatus) || 0} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-2xs text-zinc-500 uppercase tracking-wider">Headers</label>
          <textarea
            value={editHeaders}
            onChange={e => { setEditHeaders(e.target.value); setError(''); }}
            rows={4}
            spellCheck={false}
            placeholder={'content-type: application/json\ncache-control: no-cache'}
            className="w-full rounded bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-500 resize-y placeholder-zinc-600"
          />
          <span className="text-2xs text-zinc-600">One header per line, format: Key: Value</span>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-2xs text-zinc-500 uppercase tracking-wider">Body (JSON)</label>
          <textarea
            value={editBody}
            onChange={e => { setEditBody(e.target.value); setError(''); }}
            rows={12}
            spellCheck={false}
            className="w-full rounded bg-zinc-800 border border-zinc-700 px-2 py-1.5 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-500 resize-y"
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-700 hover:bg-zinc-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 rounded text-xs font-medium text-zinc-100 bg-indigo-600 hover:bg-indigo-500 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
