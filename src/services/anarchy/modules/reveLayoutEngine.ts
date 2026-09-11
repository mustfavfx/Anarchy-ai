import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../../utils/logger';
import type { AnarchyGenerationResult } from './anarchyTypes';
import { resolveImageToPngBase64 } from './anarchyImageResolver';
import { getApiKey, throttleReveApiCall } from './reveTransport';

export const layoutCache = new Map<string, any>();

export function getCacheKey(image: string, prompt?: string): string {
  if (!image) return `empty_${Date.now()}`;
  const imgId = image.length > 200
    ? `len${image.length}_${image.substring(0, 30)}_${image.substring(image.length - 80)}`
    : image;
  return `${imgId}_${prompt || ''}`;
}

export function clearLayoutCache(imageKey?: string) {
  if (imageKey) {
    layoutCache.delete(imageKey);
    layoutCache.delete(getCacheKey(imageKey));
  } else {
    layoutCache.clear();
  }
}

/**
 * Sanitizes raw layout structures before sending to API endpoints.
 * Strips non-standard UI properties (depth, children, color, originalIdx, credits_used)
 * and normalizes bbox coordinates to prevent HTTP 400 parameter errors.
 */
export function sanitizeLayoutForApi(rawLayout: any, bboxFormat: 'array' | 'object' = 'array'): any {
  if (!rawLayout || typeof rawLayout !== 'object') return rawLayout;

  const width = rawLayout.width || 1024;
  const height = rawLayout.height || 1024;
  const rawRegions = Array.isArray(rawLayout.regions) ? rawLayout.regions : [];

  const regions = rawRegions.map((reg: any) => {
    let x0 = 0, y0 = 0, x1 = 1, y1 = 1;
    if (Array.isArray(reg.bbox)) {
      x0 = Number(reg.bbox[0]) || 0;
      y0 = Number(reg.bbox[1]) || 0;
      x1 = Number(reg.bbox[2]) || 1;
      y1 = Number(reg.bbox[3]) || 1;
    } else if (reg.bbox && typeof reg.bbox === 'object') {
      x0 = Number(reg.bbox.x0 ?? reg.bbox.left ?? 0);
      y0 = Number(reg.bbox.y0 ?? reg.bbox.top ?? 0);
      x1 = Number(reg.bbox.x1 ?? reg.bbox.right ?? 1);
      y1 = Number(reg.bbox.y1 ?? reg.bbox.bottom ?? 1);
    }

    // Ensure valid min/max coordinates
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);

    const cleanBbox = bboxFormat === 'object'
      ? { x0: minX, y0: minY, x1: maxX, y1: maxY }
      : [minX, minY, maxX, maxY];

    const cleanReg: Record<string, any> = {
      label: String(reg.label || 'object'),
      bbox: cleanBbox
    };
    if (reg.prompt && typeof reg.prompt === 'string' && reg.prompt.trim().length > 0) {
      cleanReg.prompt = reg.prompt.trim();
    }
    return cleanReg;
  });

  return {
    width,
    height,
    regions
  };
}

export async function extractLayout(
  image: string,
  prompt?: string,
  _signal?: AbortSignal,
  forceRefresh: boolean = false
): Promise<any> {
  if (!image) return null;

  // 1. FAST PRE-RESOLUTION CACHE CHECK (0ms delay, no base64 conversion, no network)
  const rawKey = getCacheKey(image, prompt);
  if (!forceRefresh) {
    if (layoutCache.has(rawKey)) {
      logger.log('[AnarchyService] Loaded layout from fast memory cache:', rawKey);
      return layoutCache.get(rawKey);
    }
    try {
      const storedRaw = localStorage.getItem(`anarchy_layout_${rawKey}`);
      if (storedRaw) {
        const parsed = JSON.parse(storedRaw);
        layoutCache.set(rawKey, parsed);
        logger.log('[AnarchyService] Loaded layout from fast localStorage cache:', rawKey);
        return parsed;
      }
    } catch {}
  }

  // 2. Resolve to raw PNG base64
  const base64Data = await resolveImageToPngBase64(image);
  const contentKey = getCacheKey(base64Data, prompt);

  // 3. SECONDARY CONTENT-BASED CACHE CHECK
  if (!forceRefresh) {
    if (layoutCache.has(contentKey)) {
      logger.log('[AnarchyService] Loaded layout from content memory cache:', contentKey);
      layoutCache.set(rawKey, layoutCache.get(contentKey));
      return layoutCache.get(contentKey);
    }
    try {
      const storedContent = localStorage.getItem(`anarchy_layout_${contentKey}`);
      if (storedContent) {
        const parsed = JSON.parse(storedContent);
        layoutCache.set(contentKey, parsed);
        layoutCache.set(rawKey, parsed);
        logger.log('[AnarchyService] Loaded layout from content localStorage cache:', contentKey);
        return parsed;
      }
    } catch {}
  }

  // 4. EXCLUSIVE REVE API CALL (Direct HTTP call to https://api.reve.com/v2/image/extract_layout)
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API Key Required: Please configure your Reve API key (VITE_REVE_API_KEY) to extract layout.');
  }

  await throttleReveApiCall();

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  // Primary payload variants matching official Reve API v2 extract_layout docs (references + optional prompt/commands)
  const payloadVariants: Record<string, any>[] = [
    {
      references: [{ data: base64Data }],
      ...(prompt && prompt.trim() ? { prompt: prompt.trim() } : {})
    },
    {
      image: { data: base64Data },
      ...(prompt && prompt.trim() ? { prompt: prompt.trim() } : {})
    },
    {
      references: [{ image: { data: base64Data } }],
      ...(prompt && prompt.trim() ? { prompt: prompt.trim() } : {})
    },
    {
      image: base64Data,
      ...(prompt && prompt.trim() ? { prompt: prompt.trim() } : {})
    }
  ];

  let lastError: any = null;

  for (let i = 0; i < payloadVariants.length; i++) {
    const payload = payloadVariants[i];
    try {
      logger.log(`[AnarchyService] Sending extract_layout to Reve API (Attempt ${i + 1}/${payloadVariants.length})...`, Object.keys(payload));
      const data = await invoke('http_post', {
        url: 'https://api.reve.com/v2/image/extract_layout',
        headers,
        body: payload
      }) as any;

      logger.log('[AnarchyService] Reve API extract_layout raw response:', data);
      const layoutResult = data?.layout || data;
      if (layoutResult && Array.isArray(layoutResult.regions) && layoutResult.regions.length > 0) {
        logger.log('[AnarchyService] Successfully received extract_layout from Reve API!', layoutResult.regions.length, 'regions');
        layoutCache.set(rawKey, layoutResult);
        layoutCache.set(contentKey, layoutResult);
        try {
          localStorage.setItem(`anarchy_layout_${rawKey}`, JSON.stringify(layoutResult));
          localStorage.setItem(`anarchy_layout_${contentKey}`, JSON.stringify(layoutResult));
        } catch {}
        return layoutResult;
      }
    } catch (err: any) {
      let errMsg = String(err);
      try {
        const errJson = JSON.parse(errMsg);
        if (errJson.message) errMsg = errJson.message;
      } catch {}
      lastError = errMsg;

      const isUnrecognizedParam = errMsg.toLowerCase().includes('not recognized') || errMsg.toLowerCase().includes('parameter');
      if (isUnrecognizedParam && i < payloadVariants.length - 1) {
        logger.warn(`[AnarchyService] Payload format variant ${i + 1} rejected by Reve API. Trying variant ${i + 2}...`);
        continue;
      }

      const isRateLimit = errMsg.toLowerCase().includes('too many requests') || errMsg.includes('429');
      if (isRateLimit) {
        logger.log('[AnarchyService] HTTP 429 rate limit in extract_layout. Auto-retrying after backoff...');
        await new Promise(res => setTimeout(res, 4000));
        await throttleReveApiCall();
        try {
          const retryData = await invoke('http_post', {
            url: 'https://api.reve.com/v2/image/extract_layout',
            headers,
            body: payload
          }) as any;
          const layoutResult = retryData?.layout || retryData;
          if (layoutResult && Array.isArray(layoutResult.regions) && layoutResult.regions.length > 0) {
            layoutCache.set(rawKey, layoutResult);
            layoutCache.set(contentKey, layoutResult);
            try {
              localStorage.setItem(`anarchy_layout_${rawKey}`, JSON.stringify(layoutResult));
              localStorage.setItem(`anarchy_layout_${contentKey}`, JSON.stringify(layoutResult));
            } catch {}
            return layoutResult;
          }
        } catch (retryErr: any) {
          let retryErrMsg = String(retryErr);
          try {
            const errJson = JSON.parse(retryErrMsg);
            if (errJson.message) retryErrMsg = errJson.message;
          } catch {}
          throw new Error(`Reve API Error (429 Rate Limit): ${retryErrMsg}`);
        }
      }
    }
  }

  throw new Error(`Reve API Error: ${lastError || 'Failed to extract layout regions from image.'}`);
}

export async function renderLayout(
  layout: any,
  images: string[],
  _signal?: AbortSignal
): Promise<AnarchyGenerationResult> {
  const start = Date.now();
  let apiKey = '';
  try {
    apiKey = getApiKey();
  } catch {
    logger.warn('[AnarchyService] No API key set for renderLayout. Synthesizing visual layout result...');
    const fallbackUrl = images.length > 0 ? images[0] : '';
    return {
      id: `demo-render-${Date.now()}`,
      imageUrl: fallbackUrl,
      imageUrls: [fallbackUrl],
      metadata: {
        model: 'reve/render-layout',
        prompt: 'Demo Synthesized Layout',
        width: 1024,
        height: 1024,
        seed: -1,
        steps: 1,
        generationTime: Date.now() - start,
        timestamp: Date.now(),
      }
    };
  }

  const base64Data = images.length > 0 ? await resolveImageToPngBase64(images[0]) : '';
  const cleanArrayLayout = sanitizeLayoutForApi(layout, 'array');
  const cleanObjLayout = sanitizeLayoutForApi(layout, 'object');

  const topPrompt = cleanArrayLayout.regions
    .map((r: any) => r.prompt)
    .filter((p: any) => p && typeof p === 'string' && p.trim())
    .join(', ');

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  // Official Reve API v2 Render Layout Specifications (strictly uses layout, references, and prompt - NO top-level 'image')
  const payloadVariants: Record<string, any>[] = [
    // 1. Official Reve API v2 Render Layout Docs (references array with data object + array bbox layout + optional prompt)
    {
      layout: cleanArrayLayout,
      ...(base64Data ? { references: [{ data: base64Data }] } : {}),
      ...(topPrompt ? { prompt: topPrompt } : {})
    },
    // 2. Official Reve API v2 Render Layout Docs (references array with data object + object bbox layout + optional prompt)
    {
      layout: cleanObjLayout,
      ...(base64Data ? { references: [{ data: base64Data }] } : {}),
      ...(topPrompt ? { prompt: topPrompt } : {})
    },
    // 3. Official Docs without top prompt (array bbox)
    {
      layout: cleanArrayLayout,
      ...(base64Data ? { references: [{ data: base64Data }] } : {})
    },
    // 4. Official Docs without top prompt (object bbox)
    {
      layout: cleanObjLayout,
      ...(base64Data ? { references: [{ data: base64Data }] } : {})
    },
    // 5. Nested image reference ({ references: [{ image: { data: base64Data } }] })
    {
      layout: cleanArrayLayout,
      ...(base64Data ? { references: [{ image: { data: base64Data } }] } : {}),
      ...(topPrompt ? { prompt: topPrompt } : {})
    },
    // 6. Direct image reference ({ references: [{ image: base64Data }] })
    {
      layout: cleanArrayLayout,
      ...(base64Data ? { references: [{ image: base64Data }] } : {}),
      ...(topPrompt ? { prompt: topPrompt } : {})
    },
    // 7. Data URL reference
    {
      layout: cleanArrayLayout,
      ...(base64Data ? { references: [`data:image/png;base64,${base64Data}`] } : {})
    },
    // 8. Layout only (array bbox)
    {
      layout: cleanArrayLayout,
      ...(topPrompt ? { prompt: topPrompt } : {})
    },
    // 9. Layout only (object bbox)
    {
      layout: cleanObjLayout,
      ...(topPrompt ? { prompt: topPrompt } : {})
    }
  ];

  let lastError = '';

  for (let i = 0; i < payloadVariants.length; i++) {
    const payload = payloadVariants[i];
    await throttleReveApiCall();

    try {
      logger.log(`[AnarchyService] Sending render_layout to Reve API (Attempt ${i + 1}/${payloadVariants.length})...`);
      const data = await invoke('http_post', {
        url: 'https://api.reve.com/v2/image/render_layout',
        headers,
        body: payload
      }) as any;

      if (data && data.image) {
        const imageUrl = `data:image/png;base64,${data.image}`;
        return {
          id: data.request_id || `reve-render-${Date.now()}`,
          imageUrl,
          imageUrls: [imageUrl],
          metadata: {
            model: 'reve/render-layout',
            prompt: topPrompt || cleanArrayLayout.prompt || 'Render Layout',
            width: cleanArrayLayout.width || 1024,
            height: cleanArrayLayout.height || 1024,
            seed: -1,
            steps: 1,
            generationTime: Date.now() - start,
            timestamp: Date.now(),
          },
        };
      }
    } catch (err: any) {
      let errMsg = '';
      if (typeof err === 'string') {
        errMsg = err;
      } else if (err && typeof err === 'object') {
        errMsg = err.message || err.error || err.detail || JSON.stringify(err);
      } else {
        errMsg = String(err);
      }
      lastError = errMsg;

      logger.warn(`[AnarchyService] render_layout payload variant ${i + 1}/${payloadVariants.length} rejected: ${errMsg}`);

      // Automatically continue to try all remaining payload variants
      if (i < payloadVariants.length - 1) {
        continue;
      }

      const isRateLimit = errMsg.toLowerCase().includes('too many requests') || errMsg.includes('429');
      if (isRateLimit) {
        logger.log('[AnarchyService] HTTP 429 rate limit in renderLayout. Auto-retrying after backoff...');
        await new Promise(res => setTimeout(res, 4000));
        await throttleReveApiCall();
        try {
          const retryData = await invoke('http_post', {
            url: 'https://api.reve.com/v2/image/render_layout',
            headers,
            body: payload
          }) as any;

          if (retryData && retryData.image) {
            const imageUrl = `data:image/png;base64,${retryData.image}`;
            return {
              id: retryData.request_id || `reve-render-${Date.now()}`,
              imageUrl,
              imageUrls: [imageUrl],
              metadata: {
                model: 'reve/render-layout',
                prompt: topPrompt || cleanArrayLayout.prompt || 'Render Layout',
                width: cleanArrayLayout.width || 1024,
                height: cleanArrayLayout.height || 1024,
                seed: -1,
                steps: 1,
                generationTime: Date.now() - start,
                timestamp: Date.now(),
              },
            };
          }
        } catch (retryErr: any) {
          let retryMsg = String(retryErr);
          try {
            const errJson = JSON.parse(retryMsg);
            if (errJson.message) retryMsg = errJson.message;
          } catch {}
          throw new Error(`Reve API Error (429 Rate Limit): ${retryMsg}`);
        }
      }
    }
  }

  throw new Error(`Reve API Render Error: ${lastError || 'Failed to render modified layout.'}`);
}

export async function visualizeLayout(imageUrl: string, layout: any): Promise<string> {
  try {
    const img = new Image();
    img.src = imageUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return imageUrl;

    // Draw original image
    ctx.drawImage(img, 0, 0);

    // Draw bounding boxes
    if (layout && Array.isArray(layout.regions)) {
      layout.regions.forEach((region: any) => {
        const bbox = region.bbox;
        if (bbox) {
          const x = bbox.x0 * canvas.width;
          const y = bbox.y0 * canvas.height;
          const w = (bbox.x1 - bbox.x0) * canvas.width;
          const h = (bbox.y1 - bbox.y0) * canvas.height;

          // Draw rectangle
          ctx.strokeStyle = '#e11d48'; // Anarchy Crimson Red
          ctx.lineWidth = Math.max(2, canvas.width / 500);
          ctx.strokeRect(x, y, w, h);

          // Draw label background
          ctx.fillStyle = 'rgba(225, 29, 72, 0.85)';
          const fontSize = Math.max(12, canvas.width / 60);
          ctx.font = `bold ${fontSize}px sans-serif`;
          const text = `${region.label}${region.prompt ? ': ' + region.prompt : ''}`;
          const textWidth = ctx.measureText(text).width;
          ctx.fillRect(x, y - fontSize - 4, textWidth + 8, fontSize + 6);

          // Draw text
          ctx.fillStyle = '#ffffff';
          ctx.fillText(text, x + 4, y - 4);
        }
      });
    }

    return canvas.toDataURL('image/png');
  } catch (err) {
    logger.error('[AnarchyService] Failed to visualize layout:', err);
    return imageUrl;
  }
}

export async function visualizeEmptyLayout(layout: any): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = layout.width || 1024;
    canvas.height = layout.height || 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Draw modern dark background with grid
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid line configuration
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 32;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw bounding boxes
    if (layout && Array.isArray(layout.regions)) {
      layout.regions.forEach((region: any, index: number) => {
        const bbox = region.bbox;
        if (bbox) {
          const x = bbox.x0 * canvas.width;
          const y = bbox.y0 * canvas.height;
          const w = (bbox.x1 - bbox.x0) * canvas.width;
          const h = (bbox.y1 - bbox.y0) * canvas.height;

          // Distinct colors for different regions
          const colors = ['#f43f5e', '#3b82f6', '#10b981', '#eab308', '#a855f7', '#06b6d4', '#f97316'];
          const color = colors[index % colors.length];

          // Fill slightly transparent
          ctx.fillStyle = `${color}15`; // 8% opacity
          ctx.fillRect(x, y, w, h);

          // Bounding box border
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(2, canvas.width / 400);
          ctx.strokeRect(x, y, w, h);

          // BBox corners decoration
          ctx.fillStyle = color;
          const cornerSize = Math.max(6, canvas.width / 150);
          ctx.fillRect(x - 2, y - 2, cornerSize, cornerSize);
          ctx.fillRect(x + w - cornerSize + 2, y - 2, cornerSize, cornerSize);
          ctx.fillRect(x - 2, y + h - cornerSize + 2, cornerSize, cornerSize);
          ctx.fillRect(x + w - cornerSize + 2, y + h - cornerSize + 2, cornerSize, cornerSize);

          // Label text banner
          ctx.fillStyle = color;
          const fontSize = Math.max(12, canvas.width / 65);
          ctx.font = `bold ${fontSize}px monospace`;
          const text = `${region.label}${region.prompt ? ' (' + region.prompt + ')' : ''}`;
          const textWidth = ctx.measureText(text).width;
          ctx.fillRect(x, y - fontSize - 6, textWidth + 10, fontSize + 8);

          // Label text
          ctx.fillStyle = '#ffffff';
          ctx.fillText(text, x + 5, y - 5);
        }
      });
    }

    // Add overlay title
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('REVE LAYOUT PREVIEW', 20, 35);

    return canvas.toDataURL('image/png');
  } catch (err) {
    logger.error('[AnarchyService] Failed to visualize empty layout:', err);
    return '';
  }
}

export async function createLayout(prompt: string, _signal?: AbortSignal): Promise<any> {
  const apiKey = getApiKey();
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  try {
    const data = await invoke('http_post', {
      url: 'https://api.reve.com/v2/image/create_layout',
      headers,
      body: { prompt }
    }) as any;

    return data.layout || data;
  } catch (err: any) {
    let errMsg = String(err);
    try {
      const errJson = JSON.parse(errMsg);
      if (errJson.message) errMsg = errJson.message;
    } catch {}
    throw new Error(errMsg);
  }
}

export async function reconcileLayouts(layouts: any[], _signal?: AbortSignal): Promise<any> {
  const apiKey = getApiKey();
  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  try {
    const data = await invoke('http_post', {
      url: 'https://api.reve.com/v2/image/reconcile_layouts',
      headers,
      body: { layouts }
    }) as any;

    return data.layout || data;
  } catch (err: any) {
    let errMsg = String(err);
    try {
      const errJson = JSON.parse(errMsg);
      if (errJson.message) errMsg = errJson.message;
    } catch {}
    throw new Error(errMsg);
  }
}
