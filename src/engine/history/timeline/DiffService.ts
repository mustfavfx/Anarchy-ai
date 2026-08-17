import type { HistoryEntry } from '../../../types/history';

export interface ParamDiff {
  key: string;
  before: any;
  after: any;
}

export class DiffService {
  static compareEntries(a: HistoryEntry, b: HistoryEntry): ParamDiff[] {
    const diffs: ParamDiff[] = [];

    if (a.prompt !== b.prompt) {
      diffs.push({ key: 'prompt', before: a.prompt || '', after: b.prompt || '' });
    }
    if (a.model !== b.model) {
      diffs.push({ key: 'model', before: a.model || '', after: b.model || '' });
    }
    if (a.type !== b.type) {
      diffs.push({ key: 'type', before: a.type, after: b.type });
    }

    const paramsA = a.params || {};
    const paramsB = b.params || {};
    const keys = new Set([...Object.keys(paramsA), ...Object.keys(paramsB)]);

    for (const key of keys) {
      if (paramsA[key] !== paramsB[key]) {
        diffs.push({ key: `params.${key}`, before: paramsA[key], after: paramsB[key] });
      }
    }

    return diffs;
  }
}
