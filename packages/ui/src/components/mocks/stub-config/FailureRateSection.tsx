import { useState } from 'react';
import type { Stub } from '../../../types';
import { useStubStore } from '../../../store';
import { Field } from '../../common';

export function FailureRateSection({ stub }: { stub: Stub }) {
  const update = useStubStore(s => s.update);
  const [input, setInput] = useState(String(Math.round(stub.config.failureRate)));

  const commit = (value: string) => {
    const pct = Math.min(100, Math.max(0, Number(value) || 0));
    setInput(String(pct));
    update(stub.id, { failureRate: pct });
  };

  return (
    <Field label="Failure rate">
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          value={input}
          onChange={e => {
            setInput(e.target.value);
            commit(e.target.value);
          }}
          className="w-32 accent-red-500"
        />
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            max={100}
            value={input}
            onChange={e => setInput(e.target.value)}
            onBlur={e => commit(e.target.value)}
            className="w-16 rounded bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-xs font-mono text-zinc-100 text-right focus:outline-none focus:border-zinc-500"
          />
          <span className="text-xs text-zinc-500">%</span>
        </div>
      </div>
    </Field>
  );
}
