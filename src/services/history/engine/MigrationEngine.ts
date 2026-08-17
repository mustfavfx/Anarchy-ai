export type MigrationFn = (data: any) => any;

export interface MigrationEngineOptions {
  currentVersion: number;
}

export class MigrationEngine {
  private migrations = new Map<number, MigrationFn>();

  constructor(private options: MigrationEngineOptions) {}

  get currentVersion(): number {
    return this.options.currentVersion;
  }

  register(fromVersion: number, migrate: MigrationFn): void {
    if (this.migrations.has(fromVersion)) {
      console.warn(`[MigrationEngine] Overwriting existing migration for version ${fromVersion}.`);
    }
    this.migrations.set(fromVersion, migrate);
  }

  migrate(data: unknown, fromVersion: number): unknown {
    if (fromVersion === this.currentVersion) return data;
    if (fromVersion > this.currentVersion) {
      throw new Error(
        `[MigrationEngine] Data claims schema version ${fromVersion}, newer than app version ${this.currentVersion}.`
      );
    }

    let current = data;
    let version = fromVersion;

    while (version < this.currentVersion) {
      const step = this.migrations.get(version);
      if (!step) {
        throw new Error(
          `[MigrationEngine] No migration registered from version ${version} to ${version + 1}.`
        );
      }
      current = step(current);
      version++;
    }

    return current;
  }
}
