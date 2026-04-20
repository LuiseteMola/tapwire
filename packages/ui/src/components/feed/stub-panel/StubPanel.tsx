import { useState } from 'react';
import { ModeSelector } from './ModeSelector';
import { StubPanelList } from './StubPanelList';

export function StubPanel() {
  const [open, setOpen] = useState(() => !new URLSearchParams(window.location.search).has('collapsed'));

  return (
    <div className={[
      'flex shrink-0 border-r border-zinc-800 transition-all duration-200',
      open ? 'w-96' : 'w-8',
    ].join(' ')}>
      {open && (
        <div className="flex flex-col min-h-0 flex-1 w-full">
          <ModeSelector />
          <StubPanelList />
        </div>
      )}
      <div className='absolute bottom-0 left-0'>
        <button
          onClick={() => setOpen(v => !v)}
          className="w-8 shrink-0 flex items-center justify-center border-l border-zinc-400 text-zinc-300 hover:text-zinc-400 hover:bg-zinc-900 transition-colors"
          title={open ? 'Collapse stubs panel' : 'Expand stubs panel'}
        >
          <span className="text-3xl">{open ? '◂' : '▸'}</span>
        </button>
      </div>
    </div>
  );
}
