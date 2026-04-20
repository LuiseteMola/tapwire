import { useState } from 'react';
import type { Stub, StubMode, NetworkError } from '../../../types';
import { useStubStore } from '../../../store';
import { SegmentedControl, Field, Switch } from '../../common';

const STUB_MODES: { value: StubMode; label: string }[] = [
  { value: 'mock',   label: 'Mock' },
  { value: 'proxy',  label: 'Proxy' },
  { value: 'record', label: 'Record' },
];

const NETWORK_ERRORS: { value: NetworkError; label: string }[] = [
  { value: 'none',                label: 'None' },
  { value: 'connection-reset',    label: 'ECONNRESET' },
  { value: 'connection-aborted',  label: 'ECONNABORTED' },
  { value: 'timeout',             label: 'ETIMEDOUT' },
  { value: 'dns-not-found',       label: 'ENOTFOUND' },
  { value: 'connection-refused',  label: 'ECONNREFUSED' },
];

export function BehaviorSection({ stub }: { stub: Stub }) {
  const update = useStubStore(s => s.update);

  const [delayInput, setDelayInput] = useState(
    stub.config.delayMs != null ? String(stub.config.delayMs) : '',
  );

  const commitDelay = () => {
    const ms = delayInput.trim() === '' ? null : Math.max(0, Number(delayInput) || 0);
    if (ms !== null) {
      setDelayInput(String(ms));
    }
    update(stub.id, { delayMs: ms });
  };

  return (
    <div className="flex flex-col gap-3">
      <span className="text-2xs font-semibold uppercase tracking-wider text-zinc-500">Behavior</span>
      <Field label="Stub mode">
        <SegmentedControl
          value={stub.mode}
          options={STUB_MODES}
          onChange={mode => update(stub.id, { mode })}
        />
      </Field>
      <Field label="Delay">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              value={delayInput}
              onChange={e => setDelayInput(e.target.value)}
              onBlur={commitDelay}
              onKeyDown={e => e.key === 'Enter' && commitDelay()}
              placeholder="0"
              disabled={stub.config.replayDelay}
              className={[
                'w-20 rounded bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-xs font-mono text-right focus:outline-none focus:border-zinc-500 placeholder-zinc-600',
                stub.config.replayDelay ? 'text-zinc-600' : 'text-zinc-100',
              ].join(' ')}
            />
            <span className="text-xs text-zinc-500">ms</span>
          </div>
          <Switch
            checked={stub.config.replayDelay ?? false}
            onChange={checked => update(stub.id, { replayDelay: checked })}
            label="Replay recorded latency"
          />
        </div>
      </Field>
      <Field label="Network error">
        <select
          value={stub.config.networkError ?? 'none'}
          onChange={e => update(stub.id, { networkError: e.target.value as NetworkError })}
          className="rounded bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-500"
        >
          {NETWORK_ERRORS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </Field>
    </div>
  );
}
