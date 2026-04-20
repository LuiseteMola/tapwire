import { TabNav } from './TabNav';
import { HeaderActions } from './HeaderActions';

export function Header() {
  return (
    <header className="flex items-center gap-4 border-b border-zinc-800 px-4 h-12 shrink-0">
      <span className="text-sm font-semibold tracking-tight text-zinc-100 mr-2">
        Tapwire
      </span>
      <TabNav />
      <div className="flex-1" />
      <HeaderActions />
    </header>
  );
}
