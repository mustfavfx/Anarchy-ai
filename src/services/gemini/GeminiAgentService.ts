import { logger } from '../../utils/logger';

class GeminiAgentService {
  public getApiKey(): string {
    const envKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (envKey && envKey.trim().length > 0) {
      return envKey.trim();
    }
    const storedKey = typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;
    if (storedKey && storedKey.trim().length > 0) {
      return storedKey.trim();
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
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const systemPrompt = `You are Anarchy AI Agent, an expert AI art director and image editor. 
The user is working in an image layout editor and asks: "${userPrompt}". 
Provide a concise, friendly 1-2 sentence response explaining exactly what visual modifications you will perform on the image. Be helpful and natural.`;

    const parts: any[] = [];
    if (base64Image) {
      const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
      parts.push({
        inline_data: {
          mime_type: 'image/png',
          data: cleanBase64
        }
      });
    }
    parts.push({ text: systemPrompt });

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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
   * Analyzes any image in real-time using Gemini 1.5 Flash Vision to extract scene objects & bboxes
   */
  async extractLayoutWithAI(base64Image: string, prompt?: string): Promise<any> {
    const apiKey = this.getApiKey();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const cleanBase64 = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

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

    const parts = [
      {
        inline_data: {
          mime_type: 'image/png',
          data: cleanBase64
        }
      },
      { text: instructions }
    ];

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }] })
      });

      if (!response.ok) {
        throw new Error(`Gemini Vision HTTP ${response.status}`);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('Empty response from Gemini Vision');

      const jsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonStr);

      if (parsed && Array.isArray(parsed.regions) && parsed.regions.length > 0) {
        logger.log('[GeminiAgentService] Extracted real scene layout via Gemini Vision:', parsed.regions.length, 'objects detected');
        return parsed;
      }
      throw new Error('Parsed JSON contained no regions');
    } catch (err: any) {
      logger.warn('[GeminiAgentService] Vision layout extraction fallback:', err);
      return null;
    }
  }
}

export const geminiAgentService = new GeminiAgentService();
