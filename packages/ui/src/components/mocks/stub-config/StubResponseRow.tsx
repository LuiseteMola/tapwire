import { useState } from 'react';
import type { StubResponse, ResponseMode } from '../../../types';
import { useStubStore } from '../../../store';
import { IconButton, StatusBadge } from '../../common';
import { ResponseEditorModal } from './ResponseEditorModal';

interface StubResponseRowProps {
  stubId: string;
  pool: 'responses' | 'faults';
  response: StubResponse;
  index: number;
  isActive: boolean;
  isNext: boolean;
  mode: ResponseMode;
  isFirst: boolean;
  isLast: boolean;
}

export function StubResponseRow({ stubId, pool, response, index, isActive, isNext, mode, isFirst, isLast }: StubResponseRowProps) {
  const update = useStubStore(s => s.update);
  const addResponse = useStubStore(s => s.addResponse);
  const deleteResponse = useStubStore(s => s.deleteResponse);
  const reorderResponses = useStubStore(s => s.reorderResponses);
  const setCursor = useStubStore(s => s.setCursor);
  const stubs = useStubStore(s => s.stubs);

  const [modalOpen, setModalOpen] = useState(false);

  const handleRowClick = () => {
    if (mode === 'fixed') {
      const key = pool === 'responses' ? 'responsesActiveResponseId' : 'faultsActiveResponseId';
      update(stubId, { [key]: response.id });
    } else if (mode === 'sequential') {
      setCursor(stubId, pool, index - 1);
    }
  };

  const handleDuplicate = () => {
    const { id: _id, ...data } = response;
    addResponse(stubId, pool, data);
  };

  const handleMove = (direction: -1 | 1) => {
    const stub = stubs.find(s => s.id === stubId);
    if (!stub) {
      return;
    }
    const responses = stub[pool].responses;
    const idx = responses.findIndex(r => r.id === response.id);
    if (idx < 0) {
      return;
    }
    const targetIndex = idx + direction;
    if (targetIndex < 0 || targetIndex >= responses.length) {
      return;
    }
    const ids = responses.map(r => r.id);
    [ids[idx], ids[targetIndex]] = [ids[targetIndex], ids[idx]];
    reorderResponses(stubId, pool, ids);
  };

  const isHighlighted = (mode === 'fixed' && isActive) || (mode === 'sequential' && isNext);

  const preview = response.label
    ?? (response.body != null ? JSON.stringify(response.body).slice(0, 80) : '—');

  return (
    <>
      <div
        onClick={handleRowClick}
        className={[
          'flex items-center gap-2 px-2 py-2',
          mode !== 'random' ? 'cursor-pointer' : '',
          isHighlighted ? 'ring-1 ring-indigo-800 bg-indigo-950/30' : 'hover:bg-zinc-800',
        ].join(' ')}
      >
        <div
          className={[
            'w-2 h-2 rounded-full shrink-0',
            isHighlighted ? 'bg-indigo-400' : 'bg-zinc-700',
          ].join(' ')}
        />

        <StatusBadge status={response.statusCode} />

        <span className="flex-1 font-mono text-xs text-zinc-400 truncate" title={JSON.stringify(response.body)}>
          {preview}
        </span>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <IconButton icon="▲" title="Move up" onClick={() => handleMove(-1)} className={isFirst ? 'invisible' : ''} />
          <IconButton icon="▼" title="Move down" onClick={() => handleMove(1)} className={isLast ? 'invisible' : ''} />
          <IconButton icon="✎" title="Edit response" onClick={() => setModalOpen(true)} />
          <IconButton icon="⧉" title="Duplicate response" onClick={handleDuplicate} />
          <IconButton icon="✕" title="Remove response" onClick={() => deleteResponse(stubId, response.id)} className="text-zinc-700 hover:text-red-400" />
        </div>
      </div>

      <ResponseEditorModal
        stubId={stubId}
        response={response}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
