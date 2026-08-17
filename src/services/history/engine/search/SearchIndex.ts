export interface SearchDocument {
  id: string;
  text: string;
  timestamp: number;
}

export interface SearchResult {
  id: string;
  score: number;
  matchedTerms: string[];
}

interface TrieNode {
  children: Map<string, TrieNode>;
  isEnd: boolean;
  postings: Map<string, number>;
}

function createNode(): TrieNode {
  return { children: new Map(), isEnd: false, postings: new Map() };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

const RECENCY_HALF_LIFE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export interface SearchIndexOptions {
  fuzzyMaxDistance?: number;
  fuzzyMinTermLength?: number;
}

export class SearchIndex {
  private root: TrieNode = createNode();
  private timestamps = new Map<string, number>();
  private terms = new Set<string>();
  private docTokens = new Map<string, string[]>();

  constructor(private options: SearchIndexOptions = {}) {}

  private get fuzzyMaxDistance(): number {
    return this.options.fuzzyMaxDistance ?? 2;
  }

  private get fuzzyMinTermLength(): number {
    return this.options.fuzzyMinTermLength ?? 4;
  }

  index(doc: SearchDocument): void {
    this.remove(doc.id);
    this.timestamps.set(doc.id, doc.timestamp);

    const tokens = tokenize(doc.text);
    this.docTokens.set(doc.id, tokens);

    for (const token of tokens) {
      this.terms.add(token);
      let node = this.root;
      for (const ch of token) {
        let next = node.children.get(ch);
        if (!next) {
          next = createNode();
          node.children.set(ch, next);
        }
        node = next;
      }
      node.isEnd = true;
      node.postings.set(doc.id, (node.postings.get(doc.id) || 0) + 1);
    }
  }

  remove(id: string): void {
    const tokens = this.docTokens.get(id);
    if (!tokens) return;

    for (const token of tokens) {
      const node = this.findNode(token);
      if (node?.isEnd) node.postings.delete(id);
    }
    this.docTokens.delete(id);
    this.timestamps.delete(id);
  }

  rebuild(documents: SearchDocument[]): void {
    this.root = createNode();
    this.timestamps.clear();
    this.terms.clear();
    this.docTokens.clear();
    for (const doc of documents) this.index(doc);
  }

  private findNode(prefix: string): TrieNode | null {
    let node = this.root;
    for (const ch of prefix) {
      const next = node.children.get(ch);
      if (!next) return null;
      node = next;
    }
    return node;
  }

  private collectPostings(node: TrieNode, out: Map<string, number>): void {
    if (node.isEnd) {
      for (const [docId, count] of node.postings) {
        out.set(docId, (out.get(docId) || 0) + count);
      }
    }
    for (const child of node.children.values()) this.collectPostings(child, out);
  }

  private recencyBoost(timestamp: number): number {
    const age = Date.now() - timestamp;
    return 1 + Math.pow(0.5, age / RECENCY_HALF_LIFE_MS);
  }

  search(query: string, limit = 20): SearchResult[] {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const scores = new Map<string, { score: number; matchedTerms: Set<string> }>();
    const addScore = (docId: string, amount: number, term: string) => {
      const entry = scores.get(docId) ?? { score: 0, matchedTerms: new Set<string>() };
      entry.score += amount;
      entry.matchedTerms.add(term);
      scores.set(docId, entry);
    };

    for (const qToken of queryTokens) {
      const exactNode = this.findNode(qToken);

      if (exactNode?.isEnd) {
        for (const [docId, count] of exactNode.postings) addScore(docId, count * 3, qToken);
      }

      if (exactNode) {
        const prefixPostings = new Map<string, number>();
        this.collectPostings(exactNode, prefixPostings);
        for (const [docId, count] of prefixPostings) addScore(docId, count * 2, qToken);
      }

      if (!exactNode && qToken.length >= this.fuzzyMinTermLength) {
        for (const term of this.terms) {
          if (Math.abs(term.length - qToken.length) > this.fuzzyMaxDistance) continue;
          const distance = levenshtein(qToken, term);
          if (distance <= this.fuzzyMaxDistance) {
            const node = this.findNode(term);
            if (node?.isEnd) {
              const weight = 1 - distance / (this.fuzzyMaxDistance + 1);
              for (const [docId, count] of node.postings) addScore(docId, count * weight, qToken);
            }
          }
        }
      }
    }

    const results: SearchResult[] = Array.from(scores.entries()).map(([id, { score, matchedTerms }]) => ({
      id,
      score: score * this.recencyBoost(this.timestamps.get(id) ?? 0),
      matchedTerms: Array.from(matchedTerms),
    }));

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  get size(): number {
    return this.timestamps.size;
  }
}
