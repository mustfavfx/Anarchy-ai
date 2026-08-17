import type { HistoryEntry } from '../../../types/history';

interface TrieNode {
  children: Map<string, TrieNode>;
  entryIds: Set<string>;
}

export class SearchEngine {
  private root: TrieNode = { children: new Map(), entryIds: new Set() };
  private entryMap: Map<string, HistoryEntry> = new Map();

  public indexEntry(entry: HistoryEntry): void {
    this.entryMap.set(entry.id, entry);
    const tokens = this.tokenize(`${entry.label || ''} ${entry.prompt || ''} ${entry.model || ''} ${entry.type || ''}`);

    for (const token of tokens) {
      this.insertToken(token, entry.id);
    }
  }

  public removeEntry(id: string): void {
    this.entryMap.delete(id);
  }

  public search(query: string): HistoryEntry[] {
    const qTokens = this.tokenize(query);
    if (qTokens.length === 0) {
      return Array.from(this.entryMap.values()).sort((a, b) => b.timestamp - a.timestamp);
    }

    let matchingIds: Set<string> | null = null;

    for (const token of qTokens) {
      const idsForToken = this.lookupPrefix(token);
      if (matchingIds === null) {
        matchingIds = new Set(idsForToken);
      } else {
        matchingIds = new Set([...matchingIds].filter(id => idsForToken.has(id)));
      }
    }

    if (!matchingIds) return [];

    // Score & Rank results based on relevance and recency
    const scoredResults: Array<{ entry: HistoryEntry; score: number }> = [];

    for (const id of matchingIds) {
      const entry = this.entryMap.get(id);
      if (entry) {
        const score = this.calculateRelevanceScore(entry, qTokens);
        scoredResults.push({ entry, score });
      }
    }

    return scoredResults
      .sort((a, b) => b.score - a.score || b.entry.timestamp - a.entry.timestamp)
      .map(item => item.entry);
  }

  public clear(): void {
    this.root = { children: new Map(), entryIds: new Set() };
    this.entryMap.clear();
  }

  private calculateRelevanceScore(entry: HistoryEntry, queryTokens: string[]): number {
    let score = 0;
    const labelLower = (entry.label || '').toLowerCase();
    const promptLower = (entry.prompt || '').toLowerCase();
    const modelLower = (entry.model || '').toLowerCase();

    for (const token of queryTokens) {
      if (labelLower.includes(token)) score += 10;
      if (modelLower.includes(token)) score += 5;
      if (promptLower.includes(token)) score += 3;
    }

    return score;
  }

  private insertToken(token: string, entryId: string): void {
    let curr = this.root;
    curr.entryIds.add(entryId);

    for (const char of token) {
      if (!curr.children.has(char)) {
        curr.children.set(char, { children: new Map(), entryIds: new Set() });
      }
      curr = curr.children.get(char)!;
      curr.entryIds.add(entryId);
    }
  }

  private lookupPrefix(prefix: string): Set<string> {
    let curr = this.root;
    for (const char of prefix) {
      if (!curr.children.has(char)) {
        return new Set();
      }
      curr = curr.children.get(char)!;
    }
    return curr.entryIds;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0);
  }
}
