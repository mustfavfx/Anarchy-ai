import { logger } from '@/utils/logger';
import type { HistoryEntry, NodeTreeData } from '@/types/history';
import {
  saveRawData,
  loadRawData,
  deleteRawData,
  resolveUrlToBlob,
} from './idbImageStorage';
import {
  dataURLtoBlob,
  blobToDataURL,
  compressToThumbnail,
  registerObjectUrl,
} from './blobRegistry';
import { loadEntries } from './historyMetadata';

export type ImageSlot = 'output' | 'input' | 'root_source';

/** Store a full resolution image as a Blob in IndexedDB */
export async function saveFullImage(id: string, slot: ImageSlot, dataUrlOrBlob: string | Blob): Promise<void> {
  const blob = await resolveUrlToBlob(dataUrlOrBlob);
  if (blob) {
    await saveRawData(`${id}_${slot}`, blob);
  }
}

/** Load a full resolution image from IndexedDB, returning a revocable Object URL */
export async function loadFullImage(id: string, slot: ImageSlot): Promise<string | null> {
  const result = await loadRawData(`${id}_${slot}`);
  if (!result) {
    // Fallback: Check if the legacy HistoryEntry in localStorage contains the image directly
    try {
      const entries = loadEntries();
      const entry = entries.find(e => e.id === id);
      if (entry) {
        const legacyImage = slot === 'output' 
          ? entry.outputImage 
          : slot === 'input' 
          ? entry.inputImage 
          : entry.rootSourceImage;
            
        if (legacyImage) {
          logger.log(`[HistoryService] Found legacy image in localStorage for entry ${id}, slot ${slot}. Migrating to IndexedDB...`);
          if (legacyImage.startsWith('data:')) {
            const blob = dataURLtoBlob(legacyImage);
            await saveFullImage(id, slot, blob);
            await saveThumbnail(id, slot, blob);
            return registerObjectUrl(URL.createObjectURL(blob));
          } else {
            await saveRawData(`${id}_${slot}`, legacyImage);
            return legacyImage;
          }
        }
      }
    } catch (e) {
      logger.warn(`[HistoryService] Failed to migrate legacy image for ${id}:`, e);
    }
    return null;
  }
  
  if (result instanceof Blob) {
    return registerObjectUrl(URL.createObjectURL(result));
  } else if (typeof result === 'string' && result.startsWith('data:')) {
    // Migrate legacy base64 in IndexedDB to Blob
    try {
      const blob = dataURLtoBlob(result);
      await saveFullImage(id, slot, blob);
      return registerObjectUrl(URL.createObjectURL(blob));
    } catch {
      return result;
    }
  }
  return null;
}

/** Save a compressed thumbnail image as a Blob in IndexedDB */
export async function saveThumbnail(
  id: string,
  slot: ImageSlot,
  dataUrlOrBlob: string | Blob
): Promise<void> {
  try {
    const blob = await resolveUrlToBlob(dataUrlOrBlob);
    if (!blob) return;
    const dataUrl = await blobToDataURL(blob);
    const compressedUrl = await compressToThumbnail(dataUrl);
    const compressedBlob = dataURLtoBlob(compressedUrl);
    await saveRawData(`${id}_thumb_${slot}`, compressedBlob);
  } catch (err) {
    logger.error('[HistoryService] saveThumbnail failed:', err);
  }
}

/** Load a compressed thumbnail image from IndexedDB, returning a revocable Object URL */
export async function loadThumbnail(id: string, slot: ImageSlot): Promise<string | null> {
  const result = await loadRawData(`${id}_thumb_${slot}`);
  
  // Log the thumbnail query result for diagnostic purposes
  logger.log('[Thumbnail]', id, slot, result ? 'Exists (Blob/String)' : 'null');
  
  if (!result) {
    // Fall back to full-res image if thumbnail not found
    return loadFullImage(id, slot);
  }
  
  if (result instanceof Blob) {
    return registerObjectUrl(URL.createObjectURL(result));
  } else if (typeof result === 'string' && result.startsWith('data:')) {
    try {
      const blob = dataURLtoBlob(result);
      await saveRawData(`${id}_thumb_${slot}`, blob);
      return registerObjectUrl(URL.createObjectURL(blob));
    } catch {
      return result;
    }
  }
  return null;
}

export async function deleteFullImages(id: string): Promise<void> {
  await Promise.allSettled([
    deleteRawData(`${id}_output`),
    deleteRawData(`${id}_input`),
    deleteRawData(`${id}_root_source`),
    deleteRawData(`${id}_thumb_output`),
    deleteRawData(`${id}_thumb_input`),
    deleteRawData(`${id}_thumb_root_source`),
  ]);
}

/** Save workflow tree to IndexedDB */
export async function saveWorkflowTree(id: string, nodeTree: NodeTreeData): Promise<void> {
  await saveRawData(`${id}_workflow`, nodeTree);
}

/** Load workflow tree from IndexedDB */
export async function loadWorkflowTree(id: string): Promise<NodeTreeData | null> {
  return loadRawData(`${id}_workflow`);
}

export async function enrichWithFullImages(entry: HistoryEntry): Promise<HistoryEntry> {
  const enriched = { ...entry };
  const fullOutput = await loadFullImage(entry.id, 'output');
  if (fullOutput) enriched.outputImage = fullOutput;
  const fullInput = await loadFullImage(entry.id, 'input');
  if (fullInput) enriched.inputImage = fullInput;
  const fullRoot = await loadFullImage(entry.id, 'root_source');
  if (fullRoot) enriched.rootSourceImage = fullRoot;
  return enriched;
}
