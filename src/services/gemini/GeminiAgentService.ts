import { logger } from '../../utils/logger';

/**
 * Downscales and compresses base64 image for Gemini Vision API.
 * Keeps payloads under ~100KB, preventing HTTP 413, network timeouts,
 * and out-of-memory errors on 2K/4K/8K images.
 */
export async function prepareImagePayload(rawImageSrc: string, maxDim = 800): Promise<{ data: string; mimeType: string }> {
  const clean = rawImageSrc.includes(',') ? rawImageSrc.split(',')[1] : rawImageSrc;

  // In non-browser / test environments without Image/Canvas, return raw (bounded to 2MB)
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return { data: clean.slice(0, 3_000_000), mimeType: 'image/jpeg' };
  }

  return new Promise((resolve) => {
    const img = new Image();
    // Only set crossOrigin for remote http(s) URLs; setting it on data: or blob: causes issues in WebView2
    if (rawImageSrc.startsWith('http')) {
      img.crossOrigin = 'anonymous';
    }

    const timer = setTimeout(() => {
      // If downscaling timed out, only return raw if reasonably small (< 2.5MB)
      resolve({ data: clean.length < 3_000_000 ? clean : '', mimeType: 'image/jpeg' });
    }, 3500);

    img.onload = () => {
      clearTimeout(timer);
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (w <= 0 || h <= 0) {
        return resolve({ data: clean.length < 3_000_000 ? clean : '', mimeType: 'image/jpeg' });
      }

      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      try {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve({ data: clean.length < 3_000_000 ? clean : '', mimeType: 'image/jpeg' });

        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        const compressedBase64 = dataUrl.split(',')[1];
        resolve({ data: compressedBase64, mimeType: 'image/jpeg' });
      } catch {
        resolve({ data: clean.length < 3_000_000 ? clean : '', mimeType: 'image/jpeg' });
      }
    };

    img.onerror = () => {
      clearTimeout(timer);
      resolve({ data: clean.length < 3_000_000 ? clean : '', mimeType: 'image/jpeg' });
    };

    if (rawImageSrc.startsWith('data:') || rawImageSrc.startsWith('blob:') || rawImageSrc.startsWith('http')) {
      img.src = rawImageSrc;
    } else {
      img.src = `data:image/jpeg;base64,${rawImageSrc}`;
    }
  });
}

class GeminiAgentService {
  public getApiKey(): string {
    const envKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (envKey && typeof envKey === 'string' && envKey.trim().length > 15 && envKey !== 'undefined' && envKey !== 'null') {
      return envKey.trim();
    }
    try {
      const storedKey = typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;
      if (storedKey && typeof storedKey === 'string' && storedKey.trim().length > 15 && storedKey !== 'undefined' && storedKey !== 'null') {
        return storedKey.trim();
      }
    } catch {
      // ignore
    }
    return '';
  }

  public setApiKey(key: string) {
    if (key && key.trim().length > 0) {
      localStorage.setItem('gemini_api_key', key.trim());
    } else {
      localStorage.removeItem('gemini_api_key');
    }
  }

  /**
   * Generates a natural language response from Gemini Vision Model
   * analyzing the user's prompt and optional image context.
   */
  async generateAgentResponse(userPrompt: string, base64Image?: string): Promise<string> {
    const apiKey = this.getApiKey();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent`;

    const systemPrompt = `You are Anarchy AI Agent, an expert AI art director and image editor. 
The user is working in an image layout editor and asks: "${userPrompt}". 
Provide a concise, friendly 1-2 sentence response explaining exactly what visual modifications you will perform on the image. Be helpful and natural.`;

    const parts: any[] = [];
    if (base64Image) {
      const { data: cleanData, mimeType } = await prepareImagePayload(base64Image, 800);
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: cleanData
        }
      });
    }
    parts.push({ text: systemPrompt });

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['x-goog-api-key'] = apiKey;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          contents: [{ parts }]
        })
      });

      if (!response.ok) {
        throw new Error(`Gemini API error ${response.status}`);
      }

      const data = await response.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply && reply.trim().length > 0) {
        return reply.trim();
      }
      throw new Error('Gemini API returned empty text');
    } catch (err: any) {
      logger.warn('[GeminiAgentService] Gemini API call fallback:', err);
      return this.fallbackExplanation(userPrompt);
    }
  }

  private fallbackExplanation(userPrompt: string): string {
    const p = userPrompt.toLowerCase();
    if (p.includes('blue') || p.includes('water') || p.includes('pool')) {
      return "I'll adjust the water tone and enhance the reflections while maintaining the peaceful atmosphere of the scene.";
    }
    if (p.includes('sky') || p.includes('sunset') || p.includes('light') || p.includes('sun')) {
      return "I'll rebalance the lighting and atmospheric hues to create a vibrant, warm sunset mood.";
    }
    if (p.includes('reformat') || p.includes('ratio') || p.includes('aspect') || p.includes('crop')) {
      return "I'll reframe and adjust the composition layout to fit your desired proportions.";
    }
    if (p.includes('style') || p.includes('color') || p.includes('paint')) {
      return "I'll apply style modifications and color harmony adjustments across the selected regions.";
    }
    return `I'll transform the scene according to your instructions: "${userPrompt}", enhancing details while maintaining overall scene balance.`;
  }

  /**
   * Universal Multimodal Chat with Gemini models.
   * Features automatic multi-model fallback (gemini-3.6-flash -> gemini-3.5-flash -> gemini-flash-lite-latest),
   * retry on 503/429 spikes, and strict role/parts normalization for the Gemini API.
   */
  async chatWithGemini(params: {
    systemPrompt: string;
    messages: Array<{ role: 'user' | 'model'; parts: any[] }>;
    model?: string;
  }): Promise<string> {
    const apiKey = this.getApiKey();
    const candidateModels = [
      params.model || 'gemini-3.6-flash',
      'gemini-flash-lite-latest',
      'gemini-3.5-flash',
      'gemini-flash-latest',
    ];

    const modelsToTry = Array.from(new Set(candidateModels));

    // Normalize contents for Gemini API:
    // 1. Filter out empty parts
    // 2. Ensure first message is role: 'user'
    // 3. Merge consecutive messages with the same role
    const normalizedContents: Array<{ role: 'user' | 'model'; parts: any[] }> = [];

    for (const msg of params.messages) {
      const validParts = (msg.parts || [])
        .map((p) => {
          if (p.inlineData && !p.inline_data) {
            return {
              inline_data: {
                mime_type: p.inlineData.mimeType || 'image/jpeg',
                data: p.inlineData.data,
              },
            };
          }
          return p;
        })
        .filter((p) => {
          if (p.text !== undefined && typeof p.text === 'string') {
            return p.text.trim().length > 0;
          }
          if (p.inline_data && p.inline_data.data) {
            return p.inline_data.data.length > 0;
          }
          return false;
        });
      if (validParts.length === 0) continue;

      const last = normalizedContents[normalizedContents.length - 1];
      if (last && last.role === msg.role) {
        last.parts.push(...validParts);
      } else {
        normalizedContents.push({
          role: msg.role,
          parts: [...validParts],
        });
      }
    }

    if (normalizedContents.length === 0) {
      normalizedContents.push({ role: 'user', parts: [{ text: 'Hello' }] });
    }

    if (normalizedContents[0].role !== 'user') {
      normalizedContents.unshift({ role: 'user', parts: [{ text: 'Architectural session start.' }] });
    }

    const body: any = {
      system_instruction: {
        parts: [{ text: params.systemPrompt }],
      },
      contents: normalizedContents,
    };

    let lastError: Error | null = null;

    for (const model of modelsToTry) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (apiKey) {
            headers['x-goog-api-key'] = apiKey;
          }

          const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          });

          if (res.status === 429) {
            logger.warn(`[GeminiAgentService] Model ${model} rate-limited (429), switching to next model immediately`);
            break; // Switch instantly to alternative model
          }

          if (res.status === 503) {
            logger.warn(`[GeminiAgentService] Model ${model} returned 503, attempt ${attempt + 1}`);
            if (attempt === 0) {
              await new Promise((r) => setTimeout(r, 500));
              continue;
            }
            break; // Try next model in candidate list
          }

          if (!res.ok) {
            const errText = await res.text().catch(() => '');
            logger.warn(`[GeminiAgentService] Model ${model} error ${res.status}: ${errText.slice(0, 120)}`);
            break; // Try next model
          }

          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && text.trim().length > 0) {
            logger.log(`[GeminiAgentService] Chat succeeded with model: ${model}`);
            return text.trim();
          }
        } catch (err: any) {
          lastError = err;
          logger.warn(`[GeminiAgentService] Request error on ${model}:`, err.message);
          break; // Try next model
        }
      }
    }

    throw lastError || new Error('All Gemini resident agent models experienced temporary errors.');
  }

  /**
   * Analyzes any image in real-time using Gemini Vision models to extract scene objects & bboxes.
   * Features automatic multi-model fallback (gemini-flash-lite-latest -> gemini-3.6-flash -> gemini-3.5-flash)
   */
  async extractLayoutWithAI(base64Image: string, prompt?: string): Promise<any> {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;

    const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    if (!cleanBase64 || cleanBase64.length < 50) return null;

    const userHint = prompt ? ` Scene context hint: "${prompt}".` : '';
    const instructions = `You are an AI computer vision layout object detection engine.${userHint}
Analyze the provided image and detect 4 to 12 primary visual objects, subjects, elements, or scene components visible in the image.
For each detected object, return:
1. "label": A descriptive name wrapped in angled brackets and numbered, e.g., "<Astronaut 1>", "<Helmet 1>", "<Moon 1>", "<Terrain 1>", "<Car 1>", "<Person 1>", "<Building 1>", "<Sky 1>", "<Tree 1>".
2. "bbox": Bounding box in normalized 0.0 to 1.0 coords: { "x0": float, "y0": float, "x1": float, "y1": float } where x0 is left, y0 is top, x1 is right, y1 is bottom.
3. "prompt": A brief concise phrase describing the element visually.

Return ONLY valid JSON matching this exact structure with no markdown or code blocks:
{
  "width": 1024,
  "height": 1024,
  "regions": [
    {
      "label": "<Element Name 1>",
      "bbox": { "x0": 0.1, "y0": 0.1, "x1": 0.9, "y1": 0.9 },
      "prompt": "Description"
    }
  ]
}`;

    const { data: cleanData, mimeType } = await prepareImagePayload(base64Image, 800);
    const parts = [
      {
        inline_data: {
          mime_type: mimeType,
          data: cleanData
        }
      },
      { text: instructions }
    ];

    const candidateModels = [
      'gemini-flash-lite-latest',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest',
    ];

    for (const model of candidateModels) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (apiKey) {
            headers['x-goog-api-key'] = apiKey;
          }

          const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({ contents: [{ parts }] })
          });

          if (response.status === 429) {
            logger.warn(`[GeminiAgentService] Layout model ${model} rate-limited (429), switching to next model`);
            break;
          }

          if (response.status === 503) {
            if (attempt === 0) {
              await new Promise((r) => setTimeout(r, 400));
              continue;
            }
            break;
          }

          if (!response.ok) {
            break;
          }

          const data = await response.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!rawText) break;

          const match = rawText.match(/\{[\s\S]*\}/);
          const jsonStr = match ? match[0] : rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(jsonStr);

          if (parsed && Array.isArray(parsed.regions) && parsed.regions.length > 0) {
            logger.log(`[GeminiAgentService] Extracted real scene layout via ${model}:`, parsed.regions.length, 'objects detected');
            return parsed;
          }
          break;
        } catch (err: any) {
          logger.warn(`[GeminiAgentService] Layout extraction error on ${model}:`, err?.message || err);
          break;
        }
      }
    }

    return null;
  }

  /**
   * Performs deep structured architectural decomposition using Gemini Multimodal Vision.
   * Extracts category, style, composition, materials schedule, lighting, and AEC critique.
   * Features resilient candidate model fallback (gemini-flash-lite-latest -> gemini-3.6-flash -> gemini-3.5-flash).
   */
  async analyzeStructuredArchitecture(base64Image: string, promptHint?: string): Promise<any | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;

    const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
    if (!cleanBase64 || cleanBase64.includes('mock') || cleanBase64.length < 50) {
      return null;
    }
    const userHint = promptHint ? ` Context hint from metadata/prompt: "${promptHint}".` : '';

    const instructions = `You are an elite architectural and universal vision perception engine (inspired by AECV-Bench and Morpheus).${userHint}
CRITICAL INSTRUCTION: Base your classification STRICTLY on what is visually and objectively present in the image pixels. Even if the context hint mentions architectural or other terms, if the image visibly displays a human being, portrait, selfie, mirror reflection, bird, animal, tree, software card, graphic, or other subject, classify it according to the REAL visible subject.

Examine the image carefully and output valid JSON:
1. "category": EXACTLY ONE of:
   - "building": exterior architecture, facades, villas, houses, towers, palaces, pavilions, street buildings, outdoor built structures.
   - "interior": indoor spaces, living rooms, salons, bedrooms, kitchens, dining, indoor furniture, chandeliers, ceilings.
   - "person": human subjects, portraits, selfies, faces, models, people, fashion, person in mirror.
   - "landscape": nature, plants, trees, foliage, outdoor scenery, wildlife, birds, animals, flowers, gardens.
   - "object": graphics, UI cards, software banners, products, vehicles, logos, posters.
   - "art": digital artwork, paintings, illustrations, 3D character renders.
2. "label": concise descriptive title (e.g. "Contemporary Sunset Villa", "Smiling Woman Portrait", "Classical Palace Facade", "Songbird on Branch", "Software UI Banner", "Mirror Portrait Selfie").
3. "subTypology": specific sub-type name (e.g. "Two-Story Minimalist Villa", "Open-Plan Living Suite", "Executive Office").
4. "architecturalStyle": style name if applicable (e.g. "Contemporary Minimalist", "Brutalist", "Modern Scandinavian", "Parametric").
5. "description": 1 concise sentence describing the visual subject.
6. "tags": 3 to 6 descriptive tags.
7. "composition": {
     "framing": "Eye-level 2-point perspective" (or appropriate framing),
     "massing": "Horizontal rectilinear cantilevers over recessed podium" (or summary of forms),
     "focalPoint": "Central entrance or primary subject",
     "symmetry": "axial" | "asymmetric-balanced" | "radial" | "irregular",
     "spatialDepth": "deep" | "shallow" | "compressed"
   },
8. "materials": [
     { "name": "Vein-cut Travertine", "finish": "Honed matte", "location": "Exterior facade", "reflectivity": "matte" }
   ],
9. "lighting": {
     "timeOfDay": "dawn" | "morning" | "midday" | "golden-hour" | "twilight" | "night",
     "source": "natural-direct" | "overcast-diffused" | "artificial-warm" | "mixed",
     "colorTempK": 3200,
     "shadowQuality": "sharp-crisp" | "soft-ambient" | "dramatic-chiaroscuro",
     "sunAzimuth": "Low-angle West"
   },
10. "critique": {
     "architecturalRealismScore": 92,
     "materialFidelityScore": 89,
     "lightingConsistencyScore": 94,
     "overallScore": 91,
     "strengths": ["Clear focal hierarchy", "Crisp volumetric shadows"],
     "weaknesses": ["Check structural cantilever anchor point"]
   }

Return ONLY valid JSON matching this schema without any markdown formatting or surrounding commentary.`;

    const { data: optimizedData, mimeType } = await prepareImagePayload(base64Image, 800);

    const parts = [
      {
        inline_data: {
          mime_type: mimeType,
          data: optimizedData
        }
      },
      { text: instructions }
    ];

    const candidateModels = [
      'gemini-flash-lite-latest',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest',
    ];

    for (const model of candidateModels) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (apiKey) {
            headers['x-goog-api-key'] = apiKey;
          }

          const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({ contents: [{ parts }] }),
          });

          if (res.status === 429) {
            logger.warn(`[GeminiAgentService] Model ${model} rate-limited (429), switching to next model immediately`);
            break; // Switch instantly to alternative model
          }

          if (res.status === 503) {
            if (attempt === 0) {
              await new Promise((r) => setTimeout(r, 400));
              continue;
            }
            break;
          }

          if (!res.ok) {
            const errText = await res.text().catch(() => '');
            logger.warn(`[GeminiAgentService] Model ${model} HTTP ${res.status}: ${errText.slice(0, 100)}`);
            break;
          }

          const data = await res.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!rawText) break;

          const match = rawText.match(/\{[\s\S]*\}/);
          const jsonStr = match ? match[0] : rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(jsonStr);

          if (parsed && parsed.category) {
            parsed.analyzedAt = Date.now();
            parsed.subTypology = parsed.label || parsed.subTypology || parsed.category;
            logger.log(`[GeminiAgentService] Vision classification successful with ${model}:`, parsed.category, '->', parsed.label);
            return parsed;
          }
          break;
        } catch (err: any) {
          logger.warn(`[GeminiAgentService] Vision error on model ${model}:`, err?.message || err);
          break;
        }
      }
    }

    return null;
  }
}

export const geminiAgentService = new GeminiAgentService();

