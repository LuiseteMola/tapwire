import { FeedToolbar } from './toolbar';
import { FeedContent } from './FeedContent';

export function FeedTab() {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <FeedToolbar />
      <FeedContent />
    </div>
  );
}
