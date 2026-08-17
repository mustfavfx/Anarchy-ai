/**
 * useHistoryAutoTag — Automatic AI-driven tag classification for history entries.
 *
 * Runs a lightweight, client-side classification against the prompt text to
 * assign tags like: architecture, portrait, landscape, abstract, cinematic,
 * product, illustration, etc.
 *
 * No model inference required — uses curated keyword rules for instant classification.
 * Tags are stored in the history entry's `params.tags` field.
 */

export interface AutoTagResult {
  tags: string[];
  confidence: 'high' | 'medium' | 'low';
}

const TAG_RULES: Array<{ tag: string; keywords: string[] }> = [
  { tag: 'architecture', keywords: ['building', 'architecture', 'house', 'villa', 'interior', 'exterior', 'facade', 'skyscraper', 'office', 'room', 'apartment', 'corridor', 'lobby', 'museum', 'bridge', 'tower'] },
  { tag: 'portrait', keywords: ['portrait', 'person', 'face', 'woman', 'man', 'girl', 'boy', 'character', 'human', 'model', 'selfie', 'headshot', 'close-up', 'beauty'] },
  { tag: 'landscape', keywords: ['landscape', 'nature', 'mountain', 'forest', 'ocean', 'sea', 'sky', 'sunset', 'sunrise', 'valley', 'field', 'river', 'lake', 'desert', 'cliff'] },
  { tag: 'cinematic', keywords: ['cinematic', 'film', 'movie', 'dramatic', 'epic', 'noir', 'atmospheric', 'moody', 'dark', 'gritty', 'tense', 'action', 'heroic'] },
  { tag: 'abstract', keywords: ['abstract', 'geometric', 'pattern', 'fractal', 'surreal', 'psychedelic', 'kaleidoscope', 'texture', 'gradient', 'shapes', 'minimalist'] },
  { tag: 'product', keywords: ['product', 'commercial', 'branding', 'packaging', 'advertisement', 'mockup', 'logo', 'tech', 'device', 'gadget', 'bottle', 'shoe', 'watch', 'perfume'] },
  { tag: 'illustration', keywords: ['illustration', 'cartoon', 'anime', 'manga', 'comic', 'drawing', 'sketch', 'art', 'painterly', 'digital art', 'concept art', 'fantasy', 'sci-fi'] },
  { tag: 'realistic', keywords: ['realistic', 'photorealistic', 'hyperrealistic', 'photo', 'photograph', 'lifelike', '8k', '4k', 'uhd', 'hdr', 'raw photo'] },
  { tag: 'vintage', keywords: ['vintage', 'retro', 'old', 'classic', 'nostalgic', 'film grain', 'analog', 'faded', '70s', '80s', '90s', 'polaroid'] },
  { tag: 'space', keywords: ['space', 'galaxy', 'nebula', 'stars', 'planet', 'cosmos', 'universe', 'astronaut', 'sci-fi', 'futuristic', 'alien'] },
  { tag: 'food', keywords: ['food', 'meal', 'restaurant', 'dish', 'cuisine', 'cooking', 'delicious', 'tasty', 'chef', 'kitchen', 'coffee', 'dessert', 'cake', 'bread'] },
  { tag: 'animal', keywords: ['animal', 'dog', 'cat', 'bird', 'lion', 'tiger', 'wolf', 'fox', 'horse', 'bear', 'elephant', 'wildlife', 'pet', 'creature'] },
  { tag: 'fashion', keywords: ['fashion', 'clothing', 'outfit', 'dress', 'suit', 'style', 'elegant', 'couture', 'runway', 'model', 'luxury', 'designer'] },
  { tag: 'night', keywords: ['night', 'dark', 'neon', 'lights', 'city night', 'midnight', 'glowing', 'bioluminescent', 'stars', 'moon', 'lamp', 'lantern'] },
];

/**
 * Classify a prompt text into relevant tags using keyword matching.
 */
export function classifyPromptTags(prompt: string, model?: string): AutoTagResult {
  if (!prompt || !prompt.trim()) {
    return { tags: [], confidence: 'low' };
  }

  const lower = prompt.toLowerCase();
  const matched: string[] = [];

  for (const rule of TAG_RULES) {
    const hit = rule.keywords.some(kw => lower.includes(kw));
    if (hit) matched.push(rule.tag);
  }

  // Add model-derived tags
  if (model) {
    const m = model.toLowerCase();
    if (m.includes('upscal')) matched.push('upscale');
    if (m.includes('video') || m.includes('veo') || m.includes('wan') || m.includes('kling') || m.includes('sora')) {
      if (!matched.includes('video')) matched.push('video');
    }
    if (m.includes('flux')) matched.push('flux');
    if (m.includes('sdxl') || m.includes('stable-diffusion')) matched.push('stable-diffusion');
  }

  // Deduplicate and cap at 5 tags
  const unique = Array.from(new Set(matched)).slice(0, 5);

  return {
    tags: unique,
    confidence: unique.length >= 2 ? 'high' : unique.length === 1 ? 'medium' : 'low',
  };
}

/**
 * React hook for classifying entries that are missing tags.
 * Called once at startup and when new entries are added.
 */
export function getTagsForEntry(prompt: string, model?: string): string[] {
  return classifyPromptTags(prompt, model).tags;
}
