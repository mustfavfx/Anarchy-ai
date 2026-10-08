import { logger } from '@/utils/logger';
import type { HistoryEntry, NodeTreeData } from '@/types/history';
import {
  saveRawData,
  loadRawData,
  deleteRawData,
  resolveUrlToBlob,
  findRawImageInStores,
  getLocalImageAsObjectURL,
} from './idbImageStorage';
import {
  dataURLtoBlob,
  blobToDataURL,
  compressToThumbnail,
  registerObjectUrl,
  getCachedObjectUrl,
} from './blobRegistry';
import { loadEntries } from './historyMetadata';

export type ImageSlot = 'output' | 'input' | 'root_source';

/** Store a full resolution image as a Blob in IndexedDB */
export async function saveFullImage(id: string, slot: ImageSlot, dataUrlOrBlob: string | Blob): Promise<void> {
  const blob = await resolveUrlToBlob(dataUrlOrBlob);
  if (blob) {
    await saveRawData(`${id}_${slot}`, blob);
  } else if (typeof dataUrlOrBlob === 'string' && dataUrlOrBlob.length > 0) {
    // If resolving to blob fails (e.g. CORS block on external image URL), save URL string directly
    await saveRawData(`${id}_${slot}`, dataUrlOrBlob);
  }
}

/** Load a full resolution image from IndexedDB, returning a revocable Object URL */
export async function loadFullImage(id: string, slot: ImageSlot): Promise<string | null> {
  const cachedUrl = getCachedObjectUrl(`${id}_${slot}`) || (slot !== 'output' ? getCachedObjectUrl(`${id}_output`) : undefined) || getCachedObjectUrl(id);
  if (cachedUrl) return cachedUrl;

  // 1. Try loading from primary key and alternate slots
  let result = await loadRawData(`${id}_${slot}`);
  if (!result && slot !== 'output') {
    result = await loadRawData(`${id}_output`);
  }
  if (!result) {
    result = await loadRawData(`${id}_thumb_${slot}`);
  }
  if (!result && slot !== 'output') {
    result = await loadRawData(`${id}_thumb_output`);
  }
  if (!result) {
    result = await loadRawData(id);
  }

  // 2. Direct store lookup if id is an idb:// URL, history ID, or raw asset key
  if (!result) {
    result = await findRawImageInStores(id);
    if (!result) {
      result = await findRawImageInStores(`${id}_output`);
    }
    if (!result) {
      result = await findRawImageInStores(`${id}_thumb_output`);
    }
  }

  // 3. Fallback: Check if HistoryEntry in metadata or workflowTree contains the image directly
  if (!result) {
    try {
      const entries = loadEntries();
      const entry = entries.find(e => e.id === id || e.rootSourceId === id);
      if (entry) {
        const candidate = slot === 'output' 
          ? (entry.outputImage || entry.outputImageKey || entry.thumbnailUrl || entry.url || entry.rootSourceImage)
          : slot === 'input' 
          ? (entry.inputImage || entry.sourceImageKey)
          : (entry.rootSourceImage || entry.outputImage || entry.outputImageKey || entry.thumbnailUrl || entry.url || entry.inputImage);
            
        if (candidate) {
          if (candidate.startsWith('idb://')) {
            const resolved = await getLocalImageAsObjectURL(candidate);
            if (resolved) return resolved;
            result = await findRawImageInStores(candidate);
          } else if (candidate.startsWith('data:')) {
            try {
              const blob = dataURLtoBlob(candidate);
              await saveFullImage(id, slot, blob);
              await saveThumbnail(id, slot, blob);
              return registerObjectUrl(URL.createObjectURL(blob), `${id}_${slot}`);
            } catch {
              result = candidate;
            }
          } else {
            result = candidate;
          }
        }

        // Also check workflow tree if available
        if (!result) {
          const tree = entry.nodeTree || await loadWorkflowTree(id);
          if (tree?.nodes && tree.nodes.length > 0) {
            const candidateNode = tree.nodes.find(n => n.id === tree.activeNodeId && (n.image || n.outputData?.image)) ||
              tree.nodes.find(n => (n.type === 'result' || (n.data as any)?.type === 'result') && (n.image || (n.data as any)?.image)) ||
              tree.nodes.find(n => n.image || (n.data as any)?.image);
            const nodeImg = candidateNode?.image || (candidateNode?.data as any)?.image || (candidateNode?.outputData as any)?.image;
            if (nodeImg) {
              if (nodeImg.startsWith('idb://')) {
                const resolved = await getLocalImageAsObjectURL(nodeImg);
                if (resolved) return resolved;
                result = await findRawImageInStores(nodeImg);
              } else {
                result = nodeImg;
              }
            }
          }
        }
      }
    } catch (e) {
      logger.warn(`[HistoryService] Failed to resolve fallback image for ${id}:`, e);
    }
  }
  
  if (result instanceof Blob) {
    return registerObjectUrl(URL.createObjectURL(result), `${id}_${slot}`);
  } else if (typeof result === 'string') {
    if (result.startsWith('data:')) {
      try {
        const blob = dataURLtoBlob(result);
        await saveFullImage(id, slot, blob);
        return registerObjectUrl(URL.createObjectURL(blob), `${id}_${slot}`);
      } catch {
        return result;
      }
    } else if (result.startsWith('http://') || result.startsWith('https://') || result.startsWith('blob:')) {
      return result;
    } else if (result.startsWith('idb://')) {
      return await getLocalImageAsObjectURL(result);
    }
  }
  return null;
}

async function compressBlobToThumbnail(blob: Blob, maxSize = 384): Promise<Blob | null> {
  if (typeof createImageBitmap !== 'undefined') {
    try {
      const bitmap = await createImageBitmap(blob);
      const w = bitmap.width;
      const h = bitmap.height;
      if (w <= maxSize && h <= maxSize) {
        bitmap.close();
        return blob;
      }
      const scale = Math.min(maxSize / w, maxSize / h);
      const targetW = Math.max(1, Math.round(w * scale));
      const targetH = Math.max(1, Math.round(h * scale));

      if (typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(targetW, targetH);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(bitmap, 0, 0, targetW, targetH);
          bitmap.close();
          return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
        }
      }

      if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(bitmap, 0, 0, targetW, targetH);
          bitmap.close();
          return await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, 'image/jpeg', 0.85);
          });
        }
      }
      bitmap.close();
    } catch {}
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
    if (blob) {
      const fastBlob = await compressBlobToThumbnail(blob, 384);
      if (fastBlob) {
        await saveRawData(`${id}_thumb_${slot}`, fastBlob);
      } else {
        const dataUrl = await blobToDataURL(blob);
        const compressedUrl = await compressToThumbnail(dataUrl);
        const fallbackBlob = dataURLtoBlob(compressedUrl);
        await saveRawData(`${id}_thumb_${slot}`, fallbackBlob);
      }
    } else if (typeof dataUrlOrBlob === 'string' && dataUrlOrBlob.length > 0) {
      // If resolving to blob fails (e.g. CORS block on external image URL), save URL string directly
      await saveRawData(`${id}_thumb_${slot}`, dataUrlOrBlob);
    }
  } catch (err) {
    logger.error('[HistoryService] saveThumbnail failed:', err);
  }
}

/** Load a compressed thumbnail image from IndexedDB, returning a revocable Object URL */
export async function loadThumbnail(id: string, slot: ImageSlot): Promise<string | null> {
  const cachedUrl = getCachedObjectUrl(`${id}_thumb_${slot}`) || (slot === 'root_source' ? getCachedObjectUrl(`${id}_thumb_output`) : undefined) || getCachedObjectUrl(`${id}_output`) || getCachedObjectUrl(id);
  if (cachedUrl) return cachedUrl;

  let result = await loadRawData(`${id}_thumb_${slot}`);
  
  if (!result && slot === 'root_source') {
    // Fall back to output thumbnail if root_source thumbnail not found
    result = await loadRawData(`${id}_thumb_output`);
  }
  
  if (!result) {
    // Fall back to full-res image lookup (which searches IDB_STORE, cache store, idb:// keys and metadata)
    return loadFullImage(id, slot);
  }
  
  if (result instanceof Blob) {
    return registerObjectUrl(URL.createObjectURL(result), `${id}_thumb_${slot}`);
  } else if (typeof result === 'string') {
    if (result.startsWith('data:')) {
      try {
        const blob = dataURLtoBlob(result);
        await saveRawData(`${id}_thumb_${slot}`, blob);
        return registerObjectUrl(URL.createObjectURL(blob), `${id}_thumb_${slot}`);
      } catch {
        return result;
      }
    } else if (result.startsWith('http://') || result.startsWith('https://') || result.startsWith('blob:')) {
      return result;
    } else if (result.startsWith('idb://')) {
      const objUrl = await getLocalImageAsObjectURL(result);
      if (objUrl) return objUrl;
      return loadFullImage(id, slot);
    }
  }
  return loadFullImage(id, slot);
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
