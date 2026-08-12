import { create } from "zustand";

type AppState = {
  sourceStatus: string;
  encounterState: string;
  setSourceStatus: (sourceStatus: string) => void;
  setEncounterState: (encounterState: string) => void;
};

export const useAppStore = create<AppState>((set) => ({
  sourceStatus: "No source selected",
  encounterState: "No active encounter",
  setSourceStatus: (sourceStatus) => set({ sourceStatus }),
  setEncounterState: (encounterState) => set({ encounterState }),
}));

