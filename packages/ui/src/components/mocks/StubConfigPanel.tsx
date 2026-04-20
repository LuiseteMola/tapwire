import { useAppStore } from '../../store';
import { useSelectedStub } from '../../hooks/useSelectedStub';
import { StubConfig } from './stub-config';
import { CreateStubForm } from './CreateStubForm';

export function StubConfigPanel() {
  const creatingStub = useAppStore(s => s.creatingStub);
  const { selected } = useSelectedStub();

  if (creatingStub) {
    return <CreateStubForm />;
  }

  if (selected) {
    return <StubConfig key={selected.id} />;
  }

  return null;
}
