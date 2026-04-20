import { useAppStore } from '../store';
import { FeedTab } from './feed/FeedTab';
import { MocksTab } from './mocks/MocksTab';

export function TabContent() {
  const tab = useAppStore(s => s.tab);

  return tab === 'feed' ? <FeedTab /> : <MocksTab />;
}
