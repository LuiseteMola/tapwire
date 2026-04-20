import { useStubStore } from '../../store';
import { Switch } from '../common';

export function HeaderActions() {
  const dirty = useStubStore(s => s.dirty);
  const save = useStubStore(s => s.save);
  const reset = useStubStore(s => s.reset);
  const autoSave = useStubStore(s => s.autoSave);
  const setServerSettings = useStubStore(s => s.setServerSettings);

  const handleReset = async () => {
    if (!confirm('Discard unsaved changes and reload from disk?')) {
      return;
    }
    await reset();
  };

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={autoSave}
        onChange={(checked) => setServerSettings({ autoSave: checked })}
        label="Auto save"
      />

      <button
        onClick={save}
        disabled={autoSave}
        className={[
          'px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer',
          autoSave
            ? 'text-zinc-600 cursor-default'
            : dirty
              ? 'text-amber-400 hover:text-amber-300 hover:bg-zinc-800'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800',
        ].join(' ')}
      >
        {!autoSave && dirty ? '● Save' : 'Save'}
      </button>

      <button
        onClick={handleReset}
        className="px-3 py-1 rounded text-xs font-medium text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
      >
        Reset
      </button>
    </div>
  );
}
