export interface Collection {
  id: string;
  name: string;
  entryIds: string[];
  color: string;
  createdAt: number;
}

const COL_KEY = 'anarchy_collections_v1';
const COLLECTION_COLORS = ['#e11d48', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

export class CollectionService {
  static load(): Collection[] {
    try {
      return JSON.parse(localStorage.getItem(COL_KEY) || '[]');
    } catch {
      return [];
    }
  }

  static save(cols: Collection[]): void {
    try {
      localStorage.setItem(COL_KEY, JSON.stringify(cols));
      const event = new CustomEvent('anarchy:collections:updated');
      window.dispatchEvent(event);
      globalThis.dispatchEvent(event);
    } catch (err) {
      console.error('[CollectionService] Failed to save collections:', err);
    }
  }

  static create(name: string): Collection {
    const col: Collection = {
      id: `col_${Date.now()}`,
      name,
      entryIds: [],
      color: COLLECTION_COLORS[Math.floor(Math.random() * COLLECTION_COLORS.length)],
      createdAt: Date.now(),
    };
    const cols = this.load();
    cols.push(col);
    this.save(cols);
    return col;
  }

  static addEntry(colId: string, entryId: string): void {
    const cols = this.load();
    const col = cols.find(c => c.id === colId);
    if (col && !col.entryIds.includes(entryId)) {
      col.entryIds.push(entryId);
      this.save(cols);
    }
  }

  static removeEntry(colId: string, entryId: string): void {
    const cols = this.load();
    const col = cols.find(c => c.id === colId);
    if (col) {
      col.entryIds = col.entryIds.filter(id => id !== entryId);
      this.save(cols);
    }
  }

  static delete(colId: string): void {
    const cols = this.load().filter(c => c.id !== colId);
    this.save(cols);
  }
}
