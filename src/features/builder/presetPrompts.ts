/**
 * Preset Prompts Library — ANARCHY Viz Studio
 *
 * Curated architectural & design prompts organized by category.
 * Icons reference Lucide icon names — mapped in BuilderPage.tsx
 *
 * Metadata fields:
 *   requiresReferenceImage — prompt only makes sense with a second reference
 *   bestFor               — model tags this prompt is optimised for
 *   tier                  — 'quick' one-click results | 'advanced' needs tuning
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type PromptTier = 'quick' | 'advanced';
export type ModelTag  = 'nano-banana' | 'flux' | 'any';

export interface PresetPrompt {
  label:                string;
  icon:                 string;         // Lucide icon name
  text:                 string;
  tier?:                PromptTier;     // default: 'quick'
  requiresReferenceImage?: boolean;     // warn user if no second image
  bestFor?:             ModelTag[];     // hint for model selector
  note?:                string;         // short UI tooltip
}

export interface PresetGroup {
  category: string;
  icon:     string;                     // Lucide icon for the group header
  prompts:  PresetPrompt[];
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function p(
  label: string,
  icon: string,
  text: string,
  meta: Partial<Omit<PresetPrompt, 'label' | 'icon' | 'text'>> = {},
): PresetPrompt {
  return { label, icon, text, tier: 'quick', ...meta };
}

// ─── Library ─────────────────────────────────────────────────────────────────

export const PRESET_PROMPTS: PresetGroup[] = [

  // ── Rendering & Realism ────────────────────────────────────────────────────
  {
    category: 'Rendering & Realism',
    icon: 'Camera',
    prompts: [
      p(
        'Photorealistic',
        'Camera',
        'Create a photorealistic image with accurate lighting, natural cast shadows, ' +
        'high-resolution surface textures, realistic reflections, and professional ' +
        'architectural photography quality.',
      ),
      p(
        'Enhance Realism',
        'Sparkles',
        'Make this render photorealistic: add realistic cast shadows and ambient ' +
        'occlusion, high-contrast directional light, enhance surface textures with ' +
        'fine grain and natural imperfections, add subtle depth of field, ' +
        'professional color grading.',
      ),
      p(
        'Developer Finish',
        'Building2',
        'Transform into a shell-and-core developer handover condition. Keep the ' +
        'original geometry, layout, and camera angle unchanged. Apply smooth ' +
        'painted white walls, finished screeded floors, clean plastered ceilings, ' +
        'installed windows and doors. No furniture. Empty, clean, ready for fit-out.',
      ),
      p(
        'Construction State',
        'HardHat',
        'Transform the scene into a realistic unfinished construction state. Expose ' +
        'raw concrete, blockwork, and structural surfaces. Show unpainted walls, ' +
        'visible reinforcement edges, dust, and natural building imperfections. ' +
        'Maintain the original architecture and camera position.',
      ),
      p(
        'Match Style',
        'Blend',
        'Match the visual style of the reference image exactly — replicate its ' +
        'rendering technique, color grading, texture quality, lighting approach, ' +
        'and overall aesthetic while keeping the architectural content unchanged.',
        { requiresReferenceImage: true, tier: 'advanced',
          note: 'Attach a reference render in the second input slot.' },
      ),
    ],
  },

  // ── Interior Styles ────────────────────────────────────────────────────────
  {
    category: 'Interior Styles',
    icon: 'Sofa',
    prompts: [
      p(
        'Scandinavian Minimal',
        'Sofa',
        'Transform into Scandinavian minimalist interior — white and light grey walls, ' +
        'natural white-oak flooring, linen and bouclé textiles, simple functional ' +
        'furniture with tapered legs, large windows flooding the space with diffused ' +
        'daylight, a few indoor plants in terracotta pots, hygge warmth, clean lines, ' +
        'photorealistic quality.',
      ),
      p(
        'Industrial Loft',
        'Factory',
        'Convert to industrial loft aesthetic — exposed polished concrete ceiling, ' +
        'visible dark steel beams, weathered brick accent wall, Edison bulb pendant ' +
        'clusters, blackened metal window frames, distressed reclaimed wood surfaces, ' +
        'raw urban atmosphere, moody dramatic lighting, photorealistic.',
      ),
      p(
        'Biophilic',
        'Leaf',
        'Apply biophilic design — integrate large tropical plants throughout (monstera, ' +
        'fiddle-leaf fig, trailing pothos), a full living moss accent wall, natural ' +
        'travertine stone surfaces, exposed timber ceiling beams, diffused natural ' +
        'light filtered through vegetation, organic curved forms, earthy palette of ' +
        'terracotta, sage and warm white, photorealistic.',
      ),
      p(
        'Japandi',
        'Wind',
        'Japandi fusion — wabi-sabi imperfect beauty, natural linen and warm ash-wood ' +
        'tones, minimalist furniture with organic rounded shapes, shoji-inspired ' +
        'diffused light, handmade ceramic and rattan accents, serene neutral palette ' +
        'of ivory, warm grey and muted sage, decluttered negative space, zen ' +
        'atmosphere, photorealistic.',
      ),
      p(
        'Luxury Contemporary',
        'Gem',
        'Luxury contemporary interior — Italian marble floors with book-matched slabs, ' +
        'floor-to-ceiling fluted plaster walls, indirect cove lighting with warm CCT, ' +
        'bespoke furniture in rich bouclé and velvet, brushed brass and smoked glass ' +
        'accents, curated art and sculptural objects, five-star hospitality atmosphere, ' +
        'photorealistic.',
      ),
      p(
        'Rustic Warm',
        'Flame',
        'Warm rustic interior — exposed hand-hewn timber ceiling beams, rough stone ' +
        'feature wall with open fireplace, wide-plank reclaimed oak flooring, leather ' +
        'and wool upholstery in cognac and forest green, antique brass fittings, ' +
        'candle and firelight warmth, cosy countryside atmosphere, photorealistic.',
      ),
      p(
        'Maximalist Art Deco',
        'Crown',
        'Maximalist Art Deco interior — rich jewel tones of emerald, sapphire and ' +
        'gold, bold geometric wall panelling with brass inlays, dramatic arched ' +
        'openings, opulent pendant chandeliers, patterned marble floors, velvet ' +
        'upholstery, glamorous theatrical atmosphere, photorealistic.',
        { tier: 'advanced' },
      ),
    ],
  },

  // ── Lighting & Mood ────────────────────────────────────────────────────────
  {
    category: 'Lighting & Mood',
    icon: 'Lightbulb',
    prompts: [
      p(
        'Night Scene',
        'Moon',
        'Convert daytime to a moody night shot. Bright moon as primary light source ' +
        'from the window direction (moon not visible in frame), soft rim light outlining ' +
        'objects. Warm interior lights contrasting with cool moonlight. Subtle ' +
        'atmospheric haze for a cinematic feel. Realistic shadows, natural night white ' +
        'balance, high quality.',
      ),
      p(
        'Night + LED Strips',
        'Lightbulb',
        'Change day to night. Add LED strips running along architectural edges and ' +
        'recesses. Turn all interior lights on at warm 2700 K. Create a cosy inviting ' +
        'glow with realistic light falloff and warm reflections on all surfaces.',
      ),
      p(
        'Day to Night',
        'MoonStar',
        'Convert the daytime scene to night. Keep all interior and exterior artificial ' +
        'lights on — warm interior glow contrasting with a deep blue-black sky. ' +
        'Realistic night atmosphere, correct light falloff, high-quality photorealistic result.',
      ),
      p(
        'Night to Day',
        'Sun',
        'Change night to bright natural daylight. Clear blue sky with sunlight ' +
        'streaming through windows, soft natural shadows, daylight white balance ' +
        '(5500 K), bright and airy atmosphere, photorealistic.',
      ),
      p(
        'Golden Hour',
        'Sunset',
        'Golden hour mood — low warm sun rays at 10–15 degrees angle, rich amber and ' +
        'honey tones, long dramatic shadows stretching across the scene, magical warm ' +
        'atmosphere, subtle anamorphic lens flare, photorealistic.',
      ),
      p(
        'Brighten Scene',
        'SunDim',
        'Increase overall ambient light naturally, soften harsh shadows, improve ' +
        'exposure while maintaining realistic lighting balance and color accuracy.',
      ),
      p(
        'Candlelight',
        'Flame',
        'Intimate candlelight atmosphere — multiple candles with realistic flame glow, ' +
        'warm amber pools of light, deep dramatic shadows beyond the lit areas, ' +
        'romantic moody atmosphere, photorealistic flame and wax detail.',
      ),
    ],
  },

  // ── Sky & Atmosphere ───────────────────────────────────────────────────────
  {
    category: 'Sky & Atmosphere',
    icon: 'Cloud',
    prompts: [
      p(
        'Dramatic Clouds',
        'Cloud',
        'Replace sky with dramatic storm clouds — dark cumulonimbus formations, rays ' +
        'of golden light breaking through gaps, high contrast moody atmosphere, ' +
        'cinematic composition, photorealistic cloud detail and lighting.',
      ),
      p(
        'Sunset Sky',
        'Sunset',
        'Replace sky with a spectacular sunset — vibrant gradient from deep orange ' +
        'through magenta to violet, scattered clouds catching warm light, golden ' +
        'reflections across all surfaces, cinematic atmosphere, photorealistic.',
      ),
      p(
        'Starry Night Sky',
        'Stars',
        'Clear night sky with visible stars and faint Milky Way arc, full-moon ' +
        'atmosphere, warm interior lights casting glow, deep blue-to-black sky ' +
        'gradient, photorealistic star field, long-exposure photography aesthetic.',
      ),
      p(
        'Overcast Soft',
        'CloudSun',
        'Replace sky with uniform soft overcast — high white cloud layer acting as a ' +
        'giant softbox, perfectly diffused shadowless light, muted cool palette, ' +
        'photorealistic studio-quality exterior lighting.',
      ),
      p(
        'Volumetric Rays',
        'SunMedium',
        'Add volumetric god rays cutting through trees and structures, atmospheric ' +
        'haze enhancing depth, dramatic light beams with realistic dust particles, ' +
        'cinematic light-scattering effect, photorealistic.',
      ),
    ],
  },

  // ── Weather & Seasons ──────────────────────────────────────────────────────
  {
    category: 'Weather & Seasons',
    icon: 'CloudRain',
    prompts: [
      p(
        'Rainy Day',
        'CloudRain',
        'Overcast rainy day — soft diffused light, wet reflective surfaces, realistic ' +
        'rain streaks on glass, puddles with ripples on ground, subtle water ' +
        'reflections, moody muted atmosphere, photorealistic.',
      ),
      p(
        'Autumn',
        'Leaf',
        'Ultra-realistic autumn scene — overcast sky, soft diffused light, light mist, ' +
        'wet ground with subtle reflections, deep warm browns and muted oranges mixed ' +
        'with cool grey shadows, fallen leaves scattered naturally, damp textures, ' +
        'cinematic mood, 8K photorealistic.',
      ),
      p(
        'Winter Snow',
        'Snowflake',
        'Realistic winter — blanket of snow on roofs, ground, and landscape, frost on ' +
        'window edges, overcast winter sky, cold blue-white palette, icicles on ' +
        'architectural edges, photorealistic winter atmosphere.',
      ),
      p(
        'Fog',
        'CloudFog',
        'Add realistic atmospheric fog — soft diffusion of distant elements, gradual ' +
        'depth-fog reducing far visibility, mysterious mood, subtle light scattering, ' +
        'photorealistic volumetric haze.',
      ),
      p(
        'Spring Blossom',
        'Flower2',
        'Spring atmosphere — cherry or almond blossom trees in full flower, soft pink ' +
        'and white petals drifting in a gentle breeze, fresh green grass, bright ' +
        'morning light, optimistic warm palette, photorealistic.',
      ),
    ],
  },

  // ── Landscape & Nature ─────────────────────────────────────────────────────
  {
    category: 'Landscape & Nature',
    icon: 'TreePine',
    prompts: [
      p(
        'Add Flowers',
        'Flower2',
        'Add realistic flowers and flowering plants — garden beds, potted arrangements, ' +
        'climbing vines. Natural colour palette, realistic petals and leaves, ' +
        'appropriate scale, soft natural lighting, photorealistic.',
      ),
      p(
        'Lush Lawn',
        'Sprout',
        'Add lush realistic grass and ground cover, natural variation in height and ' +
        'colour, wildflowers mixed in, realistic soil edges at transitions, ' +
        'photorealistic lawn textures.',
      ),
      p(
        'Add Trees',
        'TreePine',
        'Add mature realistic trees appropriate to the climate, natural canopy shapes, ' +
        'detailed bark and leaf textures, realistic dappled shadows cast on ground ' +
        'and building, photorealistic foliage.',
      ),
      p(
        'Waterfront',
        'Waves',
        'Place the building beside a calm body of water — lake, river, or harbour. ' +
        'Add realistic water surface with gentle ripples, reflections of the building ' +
        'and sky, waterfront vegetation, boats if appropriate, photorealistic.',
        { tier: 'advanced' },
      ),
      p(
        'Desert Landscape',
        'Sun',
        'Surround with an arid desert landscape — warm sandy terrain, scattered ' +
        'cacti and drought-tolerant plants, terracotta rock formations, intense ' +
        'directional sunlight casting strong shadows, clear deep-blue sky, ' +
        'photorealistic.',
        { tier: 'advanced' },
      ),
    ],
  },

  // ── People & Activity ──────────────────────────────────────────────────────
  {
    category: 'People & Activity',
    icon: 'Users',
    prompts: [
      p(
        'Add People',
        'Users',
        'Add photorealistic people naturally inhabiting the space — walking, sitting, ' +
        'conversing. Diverse group, contemporary casual clothing, natural relaxed ' +
        'poses, correct scale and perspective, realistic shadows matching the scene lighting.',
      ),
      p(
        'Blurred Pedestrians',
        'Footprints',
        'Add blurred pedestrians in motion, long-exposure motion-blur effect, ghostly ' +
        'silhouettes suggesting urban life and activity, realistic movement trails, ' +
        'architectural photography style.',
      ),
      p(
        'Family at Home',
        'Home',
        'Photorealistic family scene — adults and children naturally interacting with ' +
        'the interior space, reading, cooking, relaxing. Warm lifestyle photography ' +
        'feel, natural indoor lighting, correct scale.',
      ),
      p(
        'Add Cars',
        'Car',
        'Add photorealistic parked cars at correct scale and perspective, realistic ' +
        'paint reflections, natural ground shadows, modern vehicle models appropriate ' +
        'to the context.',
      ),
      p(
        'Moving Traffic',
        'Zap',
        'Add blurred cars in motion, long-exposure light trails from headlights and ' +
        'tail-lights, dynamic movement suggesting urban activity, photorealistic.',
      ),
      p(
        'Birds in Sky',
        'Bird',
        'Add birds flying naturally in the sky, scattered in a realistic flock pattern ' +
        'at various distances for depth, natural flight silhouettes, photorealistic.',
      ),
      p(
        'Animal Detail',
        'Cat',
        'Cinematic close-up of a domestic animal (cat or dog) naturally resting or ' +
        'moving through the space, shallow depth of field, warm lighting, ' +
        'photorealistic fur detail.',
      ),
    ],
  },

  // ── Camera & Composition ───────────────────────────────────────────────────
  {
    category: 'Camera & Composition',
    icon: 'Aperture',
    prompts: [
      p(
        'Drone View',
        'Plane',
        'Move the camera to a high drone viewpoint above the scene, revealing a wide ' +
        'surrounding environment. Keep the main object clearly visible. Bird\'s-eye ' +
        'perspective, wide context, maintain original frame proportions.',
      ),
      p(
        'Worm\'s Eye',
        'ArrowUpFromLine',
        'Dramatic low-angle camera looking upward — emphasise the height and mass of ' +
        'the structure, converging vertical lines, wide sky above, photorealistic.',
      ),
      p(
        'Interior from Entrance',
        'DoorOpen',
        'Camera standing at the entrance threshold looking into the space — reveal the ' +
        'full depth of the interior, correct one-point perspective, natural lighting ' +
        'from within, photorealistic.',
      ),
      p(
        'Aerial 45°',
        'Plane',
        'Drone at a 45-degree oblique angle — balanced between plan and elevation, ' +
        'revealing rooftop and two façades simultaneously, wide contextual surroundings, ' +
        'photorealistic.',
      ),
      p(
        'Right-Side View',
        'MoveRight',
        'Move camera fully to the right side — show the object from a right-side ' +
        'perspective with accurate vanishing points and realistic proportions.',
      ),
      p(
        'Top-Down Plan',
        'ArrowDownFromLine',
        'Directly overhead plan view — all elements visible from directly above, ' +
        'correct proportions and spatial relationships, clean overhead composition.',
      ),
      p(
        'Close-up Detail',
        'Focus',
        'Beautiful macro close-up of one architectural detail — shallow depth of field ' +
        'blurring surroundings, fine material detail in sharp focus, bokeh highlights, ' +
        'a few small decorative objects for scale, cinematic quality.',
      ),
    ],
  },

  // ── Close-ups & Materials ──────────────────────────────────────────────────
  {
    category: 'Close-ups & Materials',
    icon: 'Search',
    prompts: [
      p(
        'Material Macro',
        'Search',
        'Extreme macro of a material surface from the scene — revealing fine texture, ' +
        'realistic imperfections and grain, surrounding objects softly visible in ' +
        'background, cinematic macro photography with shallow depth of field, 8K detail.',
      ),
      p(
        'Life Activity',
        'PersonStanding',
        'Close-up of everyday activity within the environment — natural human ' +
        'interaction with the space, cinematic depth of field, warm natural lighting, ' +
        'lifestyle photography aesthetic, photorealistic.',
      ),
      p(
        'Texture Study',
        'Layers',
        'Flat-lay or angled close-up study of a single material — stone, wood, fabric, ' +
        'or metal — isolated against a neutral background, perfect studio lighting ' +
        'showing every surface detail, 8K photorealistic.',
      ),
    ],
  },

  // ── Style & Aesthetics ─────────────────────────────────────────────────────
  {
    category: 'Style & Aesthetics',
    icon: 'Clapperboard',
    prompts: [
      p(
        'Cinematic Film',
        'Clapperboard',
        'Ultra-cinematic architectural photography — anamorphic lens characteristics, ' +
        'atmospheric depth, subtle film grain, moody contrast, realistic exposure ' +
        'rolloff, award-winning ArchDaily visual quality.',
      ),
      p(
        'Dezeen Editorial',
        'BookImage',
        'Professional architectural editorial photography — Dezeen magazine aesthetic, ' +
        'carefully balanced composition, realistic environmental context, premium ' +
        'storytelling quality.',
      ),
      p(
        'Clay Render',
        'CircleDashed',
        'Monochromatic clay render study — white matte material override on all ' +
        'surfaces, soft diffused studio lighting, no colour or texture, pure ' +
        'architectural form, concept-level visualisation.',
      ),
      p(
        'Pencil Sketch',
        'PenLine',
        'Convert to architectural pencil sketch — confident varied linework, ' +
        'cross-hatching for shadow areas, varying line weights for depth, ' +
        'professional hand-drawn quality, white paper background.',
      ),
      p(
        'Watercolour',
        'Paintbrush',
        'Convert to architectural watercolour illustration — soft washes of colour, ' +
        'wet-on-wet blending, visible paper texture, loose expressive linework, ' +
        'warm pastel palette, artistic presentation quality.',
        { tier: 'advanced' },
      ),
    ],
  },

  // ── Technical & Presentation ───────────────────────────────────────────────
  {
    category: 'Technical & Presentation',
    icon: 'Ruler',
    prompts: [
      p(
        'Material Moodboard',
        'SwatchBook',
        'Create a high-end interior material moodboard using only the materials ' +
        'present in the 3D scene. Arrange samples in an artistic layered composition ' +
        'similar to luxury architectural boards — stone, wood, fabric, metal, and ' +
        'colour swatches as physical tiles and samples. Soft studio lighting, refined ' +
        'neutral background, premium photorealistic aesthetic.',
        { tier: 'advanced' },
      ),
      p(
        'Editorial Board',
        'PanelTop',
        'High-end editorial presentation board — do not redesign the project, only ' +
        'present it. Include: one large dominant axonometric cut-away view as focal ' +
        'point, a front elevation with subtle dimensions, a secondary elevation ' +
        'highlighting materials, curated material swatches, minimal elegant annotations, ' +
        'clear visual hierarchy. Modern editorial layout, Behance premium style, ' +
        'minimal Scandinavian mood, soft beige and warm wood palette.',
        { tier: 'advanced' },
      ),
      p(
        'Technical Drawings',
        'Ruler',
        'Clean technical architectural drawings — precise linework, proper line ' +
        'weights, dimension annotations, section markers, material hatching, ' +
        'professional drafting aesthetic, white background, CAD-quality presentation.',
        { tier: 'advanced' },
      ),
      p(
        '3D Section Cut',
        'Scissors',
        'Axonometric 3D cross-section — top ¾ view, clean cut plane revealing ' +
        'interior spaces and structure, contrasting cut surface with visible interior, ' +
        'professional architectural section perspective.',
        { tier: 'advanced' },
      ),
      p(
        'Scale Model',
        'Box',
        'Close-up of a precise architectural scale model — axonometric view, depth of ' +
        'field bokeh, white foam-board and laser-cut acrylic, miniature windows and ' +
        'structural detail, placed on a presentation table, soft studio lighting.',
      ),
      p(
        'Urban Context Map',
        'Map',
        'Aerial site-analysis view — add surrounding city blocks, streets, green ' +
        'spaces, and urban fabric around the project. Clearly distinguish the subject ' +
        'building with contrast or colour. Professional urban-planning presentation ' +
        'quality.',
        { tier: 'advanced' },
      ),
    ],
  },

];

// ─── Derived helpers ──────────────────────────────────────────────────────────

/** Flat list of every prompt across all groups */
export const ALL_PROMPTS: PresetPrompt[] =
  PRESET_PROMPTS.flatMap((g) => g.prompts);

/** Only prompts safe to show when no image is loaded yet */
export const QUICK_PROMPTS: PresetPrompt[] =
  ALL_PROMPTS.filter((p) => p.tier !== 'advanced' && !p.requiresReferenceImage);

/** Prompts that need a reference image — surface these in the UI with a warning */
export const REFERENCE_PROMPTS: PresetPrompt[] =
  ALL_PROMPTS.filter((p) => p.requiresReferenceImage);

/** Total prompt count — useful for analytics / onboarding copy */
export const PROMPT_COUNT = ALL_PROMPTS.length;
