import { CollectionService, type Collection } from '@/services/history/CollectionService';

export type { Collection };

export class CollectionEngine {
  static load = CollectionService.load;
  static create = CollectionService.create;
  static addEntry = CollectionService.addEntry;
  static removeEntry = CollectionService.removeEntry;
  static delete = CollectionService.delete;
}
