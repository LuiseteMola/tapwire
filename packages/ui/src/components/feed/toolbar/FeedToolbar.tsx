import { FilterInput } from './FilterInput';
import { CaptureCount } from './CaptureCount';
import { ClearButton } from './ClearButton';

export function FeedToolbar() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 shrink-0">
      <FilterInput />
      <CaptureCount />
      <ClearButton />
    </div>
  );
}
