
import { create } from "zustand";

interface State {
  config: {
    mode: "comp";
    showRealtimeStats: boolean;
    caseSensitive: boolean;
  };
  stats: {
    typos: number;
    wordCount: number;
    totalKeystrokes: number;
    secElapsed: number;
  };
}

interface Mutations {
  changeMode: (mode: State["config"]["mode"]) => void;
  toggleRealTimeStats: (bool?: boolean) => void;
  toggleCaseSensitive: (bool?: boolean) => void;
  incrStats: (stats: keyof State["stats"]) => void;
  reset: () => void;
  calcWPM: (sec?: number, charCount?: number) => number;
  calcAccuracy: (typos?: number, charCount?: number) => number;
}

const initialState: State = {
  config: {
    mode: "comp",
    showRealtimeStats: true,
    caseSensitive: false,
  },
  stats: {
    typos: 0,
    wordCount: 0,
    totalKeystrokes: 0,
    secElapsed: 0,
  },
};

const useStore = create<State & Mutations>((set, get) => ({
  ...initialState,

  changeMode: (mode) =>
    set((state) => ({
      config: {
        ...state.config,
        mode,
      },
    })),

  toggleRealTimeStats: (bool) =>
    set((state) => ({
      config: {
        ...state.config,
        showRealtimeStats:
          bool === undefined ? !state.config.showRealtimeStats : bool,
      },
    })),

  toggleCaseSensitive: (bool) =>
    set((state) => ({
      config: {
        ...state.config,
        caseSensitive: bool === undefined ? !state.config.caseSensitive : bool,
      },
    })),

  incrStats: (stat) =>
    set((state) => ({
      stats: {
        ...state.stats,
        [stat]: state.stats[stat] + 1,
      },
    })),
  reset: () =>
    set((state) => ({
      ...initialState,
      config: state.config,
    })),

  calcWPM: (
    sec = get().stats.secElapsed,
    charCount = get().stats.totalKeystrokes,
  ) => +(((charCount * 60) / sec) * 5).toFixed(1),
  calcAccuracy: (
    typo = get().stats.typos,
    charCount = get().stats.totalKeystrokes,
  ) => +(100 - (typo * 100) / charCount).toFixed(1),
}));
