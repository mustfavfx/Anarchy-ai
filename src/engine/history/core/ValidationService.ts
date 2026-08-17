import type { HistoryEntry } from '../../../types/history';

export class ValidationService {
  static validateEntry(entry: any): entry is HistoryEntry {
    if (!entry || typeof entry !== 'object') return false;
    if (typeof entry.id !== 'string' || entry.id.trim() === '') return false;
    if (typeof entry.timestamp !== 'number') return false;
    return true;
  }

  static repairEntry(entry: any): HistoryEntry {
    return {
      id: entry.id || `repaired_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: typeof entry.timestamp === 'number' ? entry.timestamp : Date.now(),
      type: entry.type || 'generate',
      label: entry.label || 'History Item',
      prompt: entry.prompt || '',
      model: entry.model || '',
      inputImage: entry.inputImage,
      outputImage: entry.outputImage || entry.image,
      nodeTree: entry.nodeTree,
      params: entry.params || {},
    };
  }
}
