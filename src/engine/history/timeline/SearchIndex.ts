import type { HistoryEntry } from '../../../types/history';

export class SearchIndex {
  private static indexMap: Map<string, Set<string>> = new Map();
  private static entryCache: Map<string, HistoryEntry> = new Map();

  static indexEntry(entry: HistoryEntry): void {
    this.entryCache.set(entry.id, entry);
    const tokens = this.tokenize(`${entry.label || ''} ${entry.prompt || ''} ${entry.model || ''} ${entry.type || ''}`);

    for (const token of tokens) {
      if (!this.indexMap.has(token)) {
        this.indexMap.set(token, new Set());
      }
      this.indexMap.get(token)!.add(entry.id);
    }
  }

  static removeEntry(id: string): void {
    this.entryCache.delete(id);
    for (const [, idSet] of this.indexMap.entries()) {
      idSet.delete(id);
    }
  }

  static search(query: string): HistoryEntry[] {
    const qTokens = this.tokenize(query);
    if (qTokens.length === 0) return Array.from(this.entryCache.values());

    let matchingIds: Set<string> | null = null;

    for (const token of qTokens) {
      const idsForToken = new Set<string>();
      for (const [indexedToken, idSet] of this.indexMap.entries()) {
        if (indexedToken.includes(token)) {
          idSet.forEach(id => idsForToken.add(id));
        }
      }

      if (matchingIds === null) {
        matchingIds = idsForToken;
      } else {
        matchingIds = new Set([...matchingIds].filter(id => idsForToken.has(id)));
      }
    }

    if (!matchingIds) return [];
    return Array.from(matchingIds)
      .map(id => this.entryCache.get(id))
      .filter((e): e is HistoryEntry => e !== undefined);
  }

  static clear(): void {
    this.indexMap.clear();
    this.entryCache.clear();
  }

  private static tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }
}
