/**
 * Generic key/value storage seam.
 */
export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;

  setMany(entries: Array<[string, string]>): Promise<void>;
  getMany(keys: string[]): Promise<Map<string, string | null>>;
  deleteMany(keys: string[]): Promise<void>;
  iterateEntries(prefix?: string): Promise<Array<[string, string]>>;
}
