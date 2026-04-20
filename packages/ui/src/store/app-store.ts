import { create } from 'zustand';

export type Tab = 'feed' | 'mocks';

export type DetailTab = 'headers' | 'payload' | 'response' | 'stack-trace';

export interface FeedFilters {
  query: string;
}

export interface StubFilters {
  query: string;
}

interface AppState {
  tab: Tab;
  selectedStubId: string | null;
  selectedCaptureId: string | null;
  creatingStub: boolean;
  promotingCapture: boolean;
  detailTab: DetailTab;
  feedFilters: FeedFilters;
  stubFilters: StubFilters;

  setTab: (tab: Tab) => void;
  selectStub: (id: string | null) => void;
  selectCapture: (id: string | null) => void;
  setCreatingStub: (creating: boolean) => void;
  setPromotingCapture: (promoting: boolean) => void;
  setDetailTab: (tab: DetailTab) => void;
  navigateToStub: (stubId: string) => void;
  setFeedFilters: (patch: Partial<FeedFilters>) => void;
  setStubFilters: (patch: Partial<StubFilters>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  tab: 'feed',
  selectedStubId: null,
  selectedCaptureId: null,
  creatingStub: false,
  promotingCapture: false,
  detailTab: 'headers',
  feedFilters: {
    query: '',
  },
  stubFilters: {
    query: '',
  },

  setTab: (tab) => {
    set({ tab });
  },

  selectStub: (id) => {
    set({ selectedStubId: id, creatingStub: false });
  },

  selectCapture: (id) => {
    set({ selectedCaptureId: id, promotingCapture: false });
  },

  setCreatingStub: (creating) => {
    if (creating) {
      set({ creatingStub: true, selectedStubId: null });
    } else {
      set({ creatingStub: false });
    }
  },

  setPromotingCapture: (promoting) => {
    set({ promotingCapture: promoting });
  },

  setDetailTab: (tab) => {
    set({ detailTab: tab });
  },

  navigateToStub: (stubId) => {
    set({ tab: 'mocks', selectedStubId: stubId });
  },

  setFeedFilters: (patch) => {
    set(state => ({ feedFilters: { ...state.feedFilters, ...patch } }));
  },

  setStubFilters: (patch) => {
    set(state => ({ stubFilters: { ...state.stubFilters, ...patch } }));
  },
}));
