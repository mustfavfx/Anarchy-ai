/**
 * projectMemoryStore.ts
 * Persists winning AI engine & upscale scale presets per architectural surface type.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SurfaceType } from '../services/ai/semanticSurfaceClassifier';

export interface SurfaceMemoryPreference {
  engineId: string;
  engineName: string;
  scaleMultiplier: number;
  preserveGeometry: boolean;
  presetPrompt?: string;
  lastUsedTimestamp: number;
}

interface ProjectMemoryState {
  surfacePreferences: Record<string, SurfaceMemoryPreference>;
  setSurfacePreference: (surfaceType: SurfaceType, pref: SurfaceMemoryPreference) => void;
  getSurfacePreference: (surfaceType: SurfaceType) => SurfaceMemoryPreference | undefined;
  clearMemory: () => void;
}

export const useProjectMemoryStore = create<ProjectMemoryState>()(
  persist(
    (set, get) => ({
      surfacePreferences: {},

      setSurfacePreference: (surfaceType, pref) => {
        set((state) => ({
          surfacePreferences: {
            ...state.surfacePreferences,
            [surfaceType]: pref,
          },
        }));
      },

      getSurfacePreference: (surfaceType) => {
        return get().surfacePreferences[surfaceType];
      },

      clearMemory: () => {
        set({ surfacePreferences: {} });
      },
    }),
    {
      name: 'anarchy_project_memory',
    }
  )
);
