const GZIP = 'gzip';

function isSupported(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

async function streamToUint8Array(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      totalLength += value.length;
    }
  }

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export interface CompressIfWorthwhileResult {
  compressed: boolean;
  data: Uint8Array | string;
}

export class CompressionEngine {
  static isSupported(): boolean {
    return isSupported();
  }

  static async compress(text: string): Promise<Uint8Array> {
    if (!isSupported()) {
      throw new Error('[CompressionEngine] CompressionStream is not available in this runtime.');
    }
    const encoded = new TextEncoder().encode(text);
    const cs = new CompressionStream(GZIP);
    const writer = cs.writable.getWriter();
    writer.write(encoded);
    writer.close();
    return streamToUint8Array(cs.readable);
  }

  static async decompress(data: Uint8Array): Promise<string> {
    if (!isSupported()) {
      throw new Error('[CompressionEngine] DecompressionStream is not available in this runtime.');
    }
    const ds = new DecompressionStream(GZIP);
    const writer = ds.writable.getWriter();
    writer.write(data);
    writer.close();
    const bytes = await streamToUint8Array(ds.readable);
    return new TextDecoder().decode(bytes);
  }

  static async compressIfWorthwhile(text: string, minSizeBytes = 2048): Promise<CompressIfWorthwhileResult> {
    if (!isSupported() || text.length < minSizeBytes) {
      return { compressed: false, data: text };
    }
    const compressed = await this.compress(text);
    if (compressed.byteLength < text.length) {
      return { compressed: true, data: compressed };
    }
    return { compressed: false, data: text };
  }
}
