import { Header } from './components/header';
import { TabContent } from './components/TabContent';
import { useBootstrap } from './hooks/useBootstrap';

export default function App() {
  useBootstrap();

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100">
      <Header />
      <TabContent />
    </div>
  );
}
