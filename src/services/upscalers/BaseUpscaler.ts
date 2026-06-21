import { type AIConfig } from '../../stores/aiConfigStore';

export interface UpscaleResult {
  imageUrl: string;
  width?: number;
  height?: number;
  model: string;
}

export interface BaseUpscaler {
  validateInputs(config: AIConfig): void;

  buildPayload(
    config: AIConfig,
    image: string
  ): Record<string, unknown>;

  execute(
    config: AIConfig,
    image: string,
    signal?: AbortSignal,
    onStatusChange?: (status: 'queued' | 'processing') => void
  ): Promise<UpscaleResult>;

  parseResult(response: unknown): UpscaleResult;
}

/**
 * Dynamically resolves an image's natural dimensions (width and height).
 * Works with base64 data URIs, local indexedDB keys, and HTTP/HTTPS URLs.
 */
export async function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  let resolvedUrl = url;
  if (url.startsWith('idb://')) {
    try {
      const { getLocalImage } = await import('../history/HistoryService');
      const cached = await getLocalImage(url);
      if (cached) {
        resolvedUrl = cached;
      }
    } catch {
      // History service import fail, fall back to current url
    }
  }

  // Check if running in Node/Vitest environment or browser
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return { width: 1024, height: 1024 }; // Server or test fallback
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth || 1024, height: img.naturalHeight || 1024 });
    };
    img.onerror = () => {
      resolve({ width: 1024, height: 1024 });
    };
    img.src = resolvedUrl;
  });
}
