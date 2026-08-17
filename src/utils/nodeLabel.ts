import type { HistoryEntry } from '@/types/history';

/**
 * Derives a clean human-readable model/engine name for a history entry / canvas node.
 * Strip provider prefixes like "google/" and formats dashes nicely (e.g. "Nano Banana 2").
 */
export function getHistoryNodeLabel(entry: HistoryEntry | { model?: string; label?: string; type?: string; params?: any }): string {
  const rawModel = (entry as any).model || (entry as any).label || entry.params?.model || '';

  if (rawModel && typeof rawModel === 'string') {
    const rawClean = rawModel.replace(/^[^/]+\//, '').replace(/-/g, ' ');
    return rawClean
      .split(' ')
      .filter(Boolean)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  const typeStr = (entry as any).type || (entry as any).nodeType || 'Image';
  return typeStr.charAt(0).toUpperCase() + typeStr.slice(1);
}
