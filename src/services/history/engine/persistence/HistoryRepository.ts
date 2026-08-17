import type { HistoryEntry } from '@/types/history';
import type { HistorySnapshot } from '../types';
import type { StorageAdapter } from './StorageAdapter';
import { CompressionEngine } from '../CompressionEngine';
import { MigrationEngine } from '../MigrationEngine';

const DEFAULT_SCHEMA_VERSION = 1;
const ENTRY_PREFIX = 'entry:';
const SNAPSHOT_PREFIX = 'snapshot:';

interface StoredEnvelope<T> {
  schemaVersion: number;
  compressed: boolean;
  data: T | string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

class LRUCache<V> {
  private map = new Map<string, V>();
  constructor(private maxSize: number) {}

  get(key: string): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.maxSize) {
      const oldestKey = this.map.keys().next().value as string;
      this.map.delete(oldestKey);
    }
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}

export interface HistoryRepositoryOptions {
  compressAbove?: number;
  migrationEngine?: MigrationEngine;
  cacheSize?: number;
}

export class HistoryRepository {
  private migrations: MigrationEngine;
  private cache: LRUCache<HistoryEntry> | null;

  constructor(private storage: StorageAdapter, private options: HistoryRepositoryOptions = {}) {
    this.migrations = options.migrationEngine ?? new MigrationEngine({ currentVersion: DEFAULT_SCHEMA_VERSION });
    this.cache = options.cacheSize ? new LRUCache<HistoryEntry>(options.cacheSize) : null;
  }

  private get compressAbove(): number {
    return this.options.compressAbove ?? 2048;
  }

  private async encode<T>(data: T): Promise<StoredEnvelope<T>> {
    const json = JSON.stringify(data);
    if (CompressionEngine.isSupported() && json.length >= this.compressAbove) {
      const compressed = await CompressionEngine.compress(json);
      if (compressed.byteLength < json.length) {
        return { schemaVersion: this.migrations.currentVersion, compressed: true, data: bytesToBase64(compressed) };
      }
    }
    return { schemaVersion: this.migrations.currentVersion, compressed: false, data };
  }

  private async decode<T>(envelope: StoredEnvelope<T>): Promise<T> {
    let data: T;
    if (envelope.compressed) {
      const json = await CompressionEngine.decompress(base64ToBytes(envelope.data as string));
      data = JSON.parse(json) as T;
    } else {
      data = envelope.data as T;
    }
    if (envelope.schemaVersion < this.migrations.currentVersion) {
      data = this.migrations.migrate(data, envelope.schemaVersion) as T;
    }
    return data;
  }

  async saveEntry(entry: HistoryEntry): Promise<void> {
    await this.saveEntries([entry]);
  }

  async saveEntries(entries: HistoryEntry[]): Promise<void> {
    if (entries.length === 0) return;
    const envelopes = await Promise.all(entries.map(e => this.encode(e)));
    const rows: Array<[string, string]> = entries.map((e, i) => [`${ENTRY_PREFIX}${e.id}`, JSON.stringify(envelopes[i])]);
    await this.storage.setMany(rows);
    for (const entry of entries) this.cache?.set(entry.id, entry);
  }

  async getEntry(id: string): Promise<HistoryEntry | null> {
    const cached = this.cache?.get(id);
    if (cached) return cached;

    const raw = await this.storage.get(`${ENTRY_PREFIX}${id}`);
    if (!raw) return null;

    const entry = await this.decode<HistoryEntry>(JSON.parse(raw));
    this.cache?.set(id, entry);
    return entry;
  }

  async deleteEntry(id: string): Promise<void> {
    await this.deleteEntries([id]);
  }

  async deleteEntries(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.storage.deleteMany(ids.map(id => `${ENTRY_PREFIX}${id}`));
    for (const id of ids) this.cache?.delete(id);
  }

  async listEntries(): Promise<HistoryEntry[]> {
    const rows = await this.storage.iterateEntries(ENTRY_PREFIX);
    const entries = await Promise.all(rows.map(([, raw]) => this.decode<HistoryEntry>(JSON.parse(raw))));
    return entries;
  }

  async saveSnapshot(snapshot: HistorySnapshot): Promise<void> {
    const envelope = await this.encode(snapshot);
    await this.storage.set(`${SNAPSHOT_PREFIX}${snapshot.sessionId}:${snapshot.id}`, JSON.stringify(envelope));
  }

  async getLatestSnapshot(sessionId: string): Promise<HistorySnapshot | null> {
    const rows = await this.storage.iterateEntries(`${SNAPSHOT_PREFIX}${sessionId}:`);
    if (rows.length === 0) return null;

    const snapshots = await Promise.all(rows.map(([, raw]) => this.decode<HistorySnapshot>(JSON.parse(raw))));
    snapshots.sort((a, b) => b.timestamp - a.timestamp);
    return snapshots[0] ?? null;
  }

  async exportBackup(): Promise<string> {
    const entries = await this.listEntries();
    return JSON.stringify({ schemaVersion: this.migrations.currentVersion, exportedAt: Date.now(), entries });
  }

  async importBackup(json: string): Promise<{ imported: number; failed: number }> {
    const parsed = JSON.parse(json) as { schemaVersion: number; entries: HistoryEntry[] };
    const migrated: HistoryEntry[] = [];
    let failed = 0;

    for (const rawEntry of parsed.entries) {
      try {
        const entry =
          parsed.schemaVersion < this.migrations.currentVersion
            ? (this.migrations.migrate(rawEntry, parsed.schemaVersion) as HistoryEntry)
            : rawEntry;
        migrated.push(entry);
      } catch (err) {
        console.error('[HistoryRepository] Failed migrating an entry during import:', err);
        failed++;
      }
    }

    if (migrated.length > 0) {
      await this.saveEntries(migrated);
    }

    return { imported: migrated.length, failed };
  }
}
