export type FieldResolutionStrategy<T> = (local: T, remote: T, base: T | null) => T;

export interface ConflictResolverOptions<T extends Record<string, any>> {
  fieldStrategies?: Partial<{ [K in keyof T]: FieldResolutionStrategy<T[K]> }>;
  resolveTimestamp: (value: T) => number;
  ignoreFields?: Array<keyof T>;
}

export interface ConflictResolutionResult<T> {
  resolved: T;
  conflictingFields: string[];
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

export class ConflictResolver<T extends Record<string, any>> {
  constructor(private options: ConflictResolverOptions<T>) {}

  resolve(local: T, remote: T, base: T | null): ConflictResolutionResult<T> {
    const resolved = { ...local } as T;
    const conflictingFields: string[] = [];
    const keys = new Set<string>([...Object.keys(local), ...Object.keys(remote)]);
    const ignored = new Set<keyof T>(this.options.ignoreFields ?? []);
    const localTs = this.options.resolveTimestamp(local);
    const remoteTs = this.options.resolveTimestamp(remote);

    for (const key of keys) {
      const k = key as keyof T;

      if (ignored.has(k)) {
        resolved[k] = remoteTs > localTs ? remote[k] : local[k];
        continue;
      }

      const localVal = local[k];
      const remoteVal = remote[k];
      const baseVal = base ? base[k] : undefined;

      if (deepEqual(localVal, remoteVal)) continue;

      const localChanged = !deepEqual(localVal, baseVal);
      const remoteChanged = !deepEqual(remoteVal, baseVal);

      if (localChanged && !remoteChanged) continue;
      if (remoteChanged && !localChanged) {
        resolved[k] = remoteVal;
        continue;
      }

      conflictingFields.push(String(key));
      const strategy = this.options.fieldStrategies?.[k];
      if (strategy) {
        resolved[k] = strategy(localVal, remoteVal, (baseVal ?? null) as T[typeof k] | null);
      } else {
        resolved[k] = remoteTs > localTs ? remoteVal : localVal;
      }
    }

    return { resolved, conflictingFields };
  }
}
