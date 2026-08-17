/**
 * presetsAndMemory.ts
 * Filters the 62-entry presetPrompts.ts down to what's relevant for the
 * current tool + detected category, ranked by project memory. Also owns the
 * project-memory read/write used to suggest an engine per surface category.
 */

import type {
  AIModelEngine,
  PresetPrompt,
  ProjectMemoryEntry,
  ProjectMemoryStore,
} from './types';

const CATEGORY_RELATIONS: Record<string, string[]> = {
  glass_facade: ['materials', 'lighting', 'reflections'],
  landscape: ['vegetation', 'lighting', 'atmosphere'],
  structural: ['materials', 'texture'],
  interior_detail: ['materials', 'furniture', 'lighting'],
};

function isCategoryRelated(a: string, b: string): boolean {
  return CATEGORY_RELATIONS[b]?.includes(a) ?? false;
}

export function getRelevantPresets(
  allPresets: PresetPrompt[],
  toolType: 'enhance' | 'mask',
  detectedCategory: string
): PresetPrompt[] {
  const toolMatched = allPresets.filter((p) => p.compatibleTools.includes(toolType));
  const exactMatch = toolMatched.filter((p) => p.category === detectedCategory);
  if (exactMatch.length >= 4) return exactMatch;

  const related = toolMatched.filter(
    (p) => p.category !== detectedCategory && isCategoryRelated(p.category, detectedCategory)
  );
  return [...exactMatch, ...related].slice(0, 8);
}

export function rankPresets(
  presets: PresetPrompt[],
  projectMemory: ProjectMemoryStore,
  toolType: 'enhance' | 'mask',
  category: string
): PresetPrompt[] {
  const memory = projectMemory[`${toolType}:${category}`];
  const preferredId = memory?.preferredParams?.promptId as string | undefined;

  return [...presets].sort((a, b) => {
    if (a.id === preferredId) return -1;
    if (b.id === preferredId) return 1;
    return (b.usageCount ?? 0) - (a.usageCount ?? 0);
  });
}

// ---------- Project memory ----------

export function getSuggestedEngine(
  store: ProjectMemoryStore,
  category: string,
  toolType: 'enhance' | 'mask',
  fallbackEngines: AIModelEngine[]
): { engine: AIModelEngine; remembered: boolean } {
  const memory = store[`${toolType}:${category}`];
  if (memory && memory.successCount >= 1) {
    const remembered = fallbackEngines.find((e) => e.id === memory.preferredEngineId);
    if (remembered) return { engine: remembered, remembered: true };
  }
  return { engine: fallbackEngines[0], remembered: false };
}

/** Call once, right after the user commits a ghost-set selection. Upserts, never appends. */
export function updateProjectMemory(
  store: ProjectMemoryStore,
  category: string,
  toolType: 'enhance' | 'mask',
  chosenEngine: AIModelEngine,
  chosenParams: Record<string, number | string>
): ProjectMemoryStore {
  const key = `${toolType}:${category}`;
  const existing = store[key];
  const entry: ProjectMemoryEntry = {
    category,
    toolType,
    preferredEngineId: chosenEngine.id,
    preferredParams: chosenParams,
    successCount: (existing?.successCount ?? 0) + 1,
    lastUsedAt: Date.now(),
  };
  return { ...store, [key]: entry };
}
