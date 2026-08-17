/**
 * ImageMetadataService.ts
 * Reads and writes embedded workflow metadata (tEXt chunks) in PNG files.
 * Allows images exported to computer hard drive to carry their full node tree lineage.
 */

export interface WorkflowMetadata {
  entryId?: string;
  rootId?: string;
  parentId?: string;
  prompt?: string;
  nodeTree?: {
    nodes: any[];
    edges: any[];
  };
  timestamp?: number;
  program?: string;
}

// Simple IEEE 802.3 CRC32 calculation for PNG chunks
function crc32(buffer: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Extracts embedded workflow metadata from PNG array buffer.
 */
export function extractPngMetadata(buffer: Uint8Array): WorkflowMetadata | null {
  try {
    // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] !== 0x89 ||
      buffer[1] !== 0x50 ||
      buffer[2] !== 0x4e ||
      buffer[3] !== 0x47 ||
      buffer[4] !== 0x0d ||
      buffer[5] !== 0x0a ||
      buffer[6] !== 0x1a ||
      buffer[7] !== 0x0a
    ) {
      return null;
    }

    let offset = 8;
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

    while (offset < buffer.length - 8) {
      const length = view.getUint32(offset);
      const type = String.fromCharCode(
        buffer[offset + 4],
        buffer[offset + 5],
        buffer[offset + 6],
        buffer[offset + 7]
      );

      if (type === 'tEXt' || type === 'iTXt') {
        const chunkData = buffer.subarray(offset + 8, offset + 8 + length);
        
        // Find null byte separating keyword and text
        let nullIdx = -1;
        for (let i = 0; i < chunkData.length; i++) {
          if (chunkData[i] === 0) {
            nullIdx = i;
            break;
          }
        }

        if (nullIdx !== -1) {
          const keyword = new TextDecoder().decode(chunkData.subarray(0, nullIdx));
          if (
            keyword === 'anarchy_workflow' || 
            keyword === 'workflow' || 
            keyword === 'prompt' || 
            keyword === 'VizMaker'
          ) {
            const rawVal = new TextDecoder().decode(chunkData.subarray(nullIdx + 1));
            try {
              const json = JSON.parse(rawVal);
              return json;
            } catch {
              if (rawVal.trim().startsWith('{')) {
                return { prompt: rawVal };
              }
            }
          }
        }
      }

      if (type === 'IEND') break;
      offset += 12 + length;
    }
  } catch (err) {
    console.warn('[ImageMetadataService] Failed to parse PNG chunks:', err);
  }

  return null;
}

/**
 * Embeds workflow metadata as a tEXt chunk into a PNG buffer.
 */
export function injectPngMetadata(pngBuffer: Uint8Array, metadata: WorkflowMetadata): Uint8Array {
  try {
    const jsonStr = JSON.stringify({
      program: 'Anarchy AI',
      timestamp: Date.now(),
      ...metadata,
    });

    const encoder = new TextEncoder();
    const keywordBytes = encoder.encode('anarchy_workflow');
    const valueBytes = encoder.encode(jsonStr);

    // tEXt payload: keyword + null byte (0x00) + value
    const payload = new Uint8Array(keywordBytes.length + 1 + valueBytes.length);
    payload.set(keywordBytes, 0);
    payload[keywordBytes.length] = 0;
    payload.set(valueBytes, keywordBytes.length + 1);

    // Chunk header (4 bytes length + 4 bytes 'tEXt') + payload + 4 bytes CRC
    const chunkType = encoder.encode('tEXt');
    const crcData = new Uint8Array(chunkType.length + payload.length);
    crcData.set(chunkType, 0);
    crcData.set(payload, chunkType.length);
    const chunkCrc = crc32(crcData);

    const chunkLength = payload.length;
    const fullChunk = new Uint8Array(12 + chunkLength);
    const view = new DataView(fullChunk.buffer);

    view.setUint32(0, chunkLength);
    fullChunk.set(chunkType, 4);
    fullChunk.set(payload, 8);
    view.setUint32(8 + chunkLength, chunkCrc);

    // Insert right before IEND chunk (last 12 bytes of PNG)
    const iendOffset = pngBuffer.length - 12;
    const result = new Uint8Array(pngBuffer.length + fullChunk.length);
    result.set(pngBuffer.subarray(0, iendOffset), 0);
    result.set(fullChunk, iendOffset);
    result.set(pngBuffer.subarray(iendOffset), iendOffset + fullChunk.length);

    return result;
  } catch (err) {
    console.error('[ImageMetadataService] Failed to inject PNG metadata:', err);
    return pngBuffer;
  }
}
