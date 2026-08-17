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

// ─── Video Preset Prompts ─────────────────────────────────────────────────────

export const VIDEO_PRESET_PROMPTS: PresetGroup[] = [

  // ── Architecture Effects (SIGNATURE — most distinctive, shown first) ─────────
  {
    category: 'Architecture Effects',
    icon: 'Clapperboard',
    prompts: [
      p(
        'Sketch to Render',
        'PenLine',
        'Cinematic morphing from hand-drawn architectural line sketch to fully photorealistic rendered building. Pencil strokes gradually dissolve — revealing premium materials, cast shadows, accurate reflections, and professional lighting. Architectural precision preserved throughout. Smooth progressive emergence, ultra-high detail, cinematic color grade.',
      ),
      p(
        'Blueprint to Reality',
        'Ruler',
        'Cinematic transformation beginning from precise technical blueprint drawings — crisp blue-white lines, dimension strings, section hatching, and annotations — progressively morphing into a fully realized photorealistic building. Each technical line solidifies into real material. Smooth architectural reveal, cinematic pacing.',
      ),
      p(
        'Massing to Masterpiece',
        'Layers',
        'Seamless cinematic transition from a clean white architectural massing model into a fully detailed photorealistic visualization. Premium facade materials, glazing reflections, detailed landscaping, and atmospheric lighting emerge surface by surface over the pristine white base. Elegant materialization, cinematic lighting evolution.',
      ),
      p(
        'Materialization Effect',
        'Sparkles',
        'Building structure begins as invisible wireframe, then solidifies surface by surface — concrete textures appear, glass panels become transparent, steel connections form, wood cladding grain emerges, stone courses materialize — each layer with cinematic timing. Realistic reflections and shadows activate progressively. Premium architectural detail emerges.',
      ),
      p(
        'Design Evolution',
        'GitBranch',
        'Cinematic morphing sequence through architectural design stages — raw concept massing → schematic geometry → detailed design development → final photorealistic masterpiece. Each stage dissolves into the next with increasing material resolution, shadow depth, and environmental richness. Design process visualized cinematically.',
      ),
      p(
        'Facade Build-Up',
        'Building2',
        'Cinematic close-up of architectural facade panels self-assembling from bottom to top. Each cladding unit, curtain wall module, louver blade, and stone tile snaps precisely into position. Material quality and surface texture revealed progressively. Realistic shadows form with each new element. Premium glazing reflections appear as panels complete.',
      ),
      p(
        'Floor-by-Floor Construction',
        'HardHat',
        'Dramatic architectural animation of a tower being constructed one storey at a time — structural columns rise, floor slabs pour, facade panels close, glazing inserts — each floor stacking onto the last with accelerated cinematic timing. Aerial perspective. Crane movements. Realistic scale. Building reveals itself dramatically against the skyline.',
      ),
      p(
        'Structural X-Ray',
        'Aperture',
        'Cinematic X-ray visualization: facade cladding dissolves to transparent revealing the full structural skeleton — columns, shear walls, transfer beams, flat slabs, and concrete core. Technical precision. Structural elements highlighted. Camera orbits slowly around the exposed frame. Fade smoothly between opaque and transparent states. Engineering visualization quality.',
      ),
      p(
        'Exploded Axonometric',
        'Box',
        'Smooth cinematic exploded axonometric: building layers separate and float apart in sequence — foundation, structural frame, service runs, floor plates, interior partitions, facade skin, roof system. Each system drifts to its exploded position, pauses for clarity, then reassembles in reverse. Premium technical visualization, crisp architectural drafting quality.',
      ),
      p(
        'Section Cut Animation',
        'Scissors',
        'An invisible precision cutting plane slices dramatically through the building — interior spaces, floor-to-floor heights, room volumes, material thicknesses, and structural sections are revealed as the cut plane travels. Interior spaces illuminate as they are exposed. Camera follows the cut plane. Architectural section rendering quality.',
      ),
      p(
        'Furniture Auto Assembly',
        'Sofa',
        'Cinematic sequence in an empty luxury interior where furniture self-assembles — chairs, sofas, dining tables, pendant lighting, artwork, and decorative objects materialize from nothing, scale in from zero, or float precisely into position. Room transforms from raw architectural shell into a fully styled luxury living space. Elegant choreography and timing.',
      ),
      p(
        'Landscape Growth',
        'Sprout',
        'Time-accelerated cinematic growth of architectural landscape from bare ground — trees grow from saplings to full mature canopy, lawns establish, water features activate and fill, planting beds bloom in waves, pathways reveal themselves. Building remains constant. Ultra-realistic botanical progression. Season-neutral warm light. Architectural landscape quality.',
      ),
      p(
        'Lights Turning On',
        'Lightbulb',
        'Cinematic dusk transition: as sky dims, interior ambient lighting activates room by room, floor by floor. Warm glow appears behind glazing. Facade accent lighting illuminates architectural features. Landscape uplights activate. Pool lights illuminate water. Reflections appear on wet surfaces. Luxury night lighting choreography from darkened building to fully illuminated landmark.',
      ),
      p(
        'Glass Reflection Sweep',
        'Waves',
        'The sky behind the building shifts — clouds move, light angle changes — creating a dynamic cinematic sweep of reflections across large curtain wall glass surfaces. Structural mullions appear through reflection. Interior spaces glimpsed. Sky colors transition across the facade. Camera holds steady while the glass becomes a living mirror. Premium glazing quality.',
      ),
      p(
        'Seasonal Transformation',
        'Snowflake',
        'Full cinematic year-in-one-minute: architecture holds constant while the world around it transforms — cherry blossom spring, dense summer canopy, warm amber autumn foliage, bare winter branches with snow settling on horizontal surfaces. Sky quality, light temperature, and vegetation transform seamlessly through all four seasons. Seamless morphing, realistic environmental transitions.',
      ),
      p(
        'Interior to Exterior Transition',
        'DoorOpen',
        'Camera begins deep inside a luxury interior — warm ambient light, premium finishes, furniture in focus. Camera tracks forward, passes through a full-height glazed facade, and emerges into the exterior. Interior ambiance dissolves into exterior daylight. Material continuity maintained at the threshold. Spatial sequence seamlessly linked. Architectural coherence throughout.',
      ),
      p(
        'Exterior to Interior Transition',
        'MoveRight',
        'Camera begins with a cinematic exterior aerial view of the building. Descends. Approaches the main entrance facade. Passes through the glazing threshold. Enters a fully detailed luxury interior. Exterior cladding transitions seamlessly to interior finishes. Daylight quality follows the camera through the glass. Architectural spatial sequence revealed.',
      ),
      p(
        'Day to Night Transition',
        'Moon',
        'The building stands in bright daylight. Sky transitions through golden hour — sun drops, shadows lengthen, sky turns deep blue. Building lights activate progressively as night falls. Final frame shows the architecture as an illuminated luxury landmark against a dark sky. Realistic atmospheric scattering. Smooth sun arc. Premium visualization throughout.',
      ),
      p(
        'Rain Cleanup',
        'CloudRain',
        'Heavy overcast rain soaks the building — surfaces darken with moisture, water sheeting runs down facade panels, puddles form on paving and reflect the architecture. Then rain eases. Sky brightens. Surfaces glisten wet then gradually dry, revealing pristine material finishes underneath the cleaned exterior. Architecture revealed in crisp post-rain clarity.',
      ),
    ],
  },

  // ── Interior Camera Movements ─────────────────────────────────────────────
  {
    category: 'Interior Camera Movements',
    icon: 'DoorOpen',
    prompts: [
      p('Smooth Walkthrough',       'MoveRight',         'Slow steady cinematic walkthrough of the interior space. Smooth tracking movement forward through the room. Natural eye level. Ambient interior lighting. Premium architectural finishes in focus. Hold on key moments.'),
      p('Slow Push Forward',        'ArrowUpFromLine',   'Extremely slow cinematic push forward — camera advances with minimal perceptible movement, creating dramatic depth and anticipation. Furniture and materials sharpen progressively. Cinematic compression. Hold composition.'),
      p('Pull Back Reveal',         'ArrowDownFromLine', 'Camera begins tight on a key detail or focal element, then slowly pulls back to reveal the full interior space. Wide-angle reveal of room scale, ceiling height, and spatial quality. Dramatic spatial disclosure. Premium cinematic pacing.'),
      p('Orbit Around',             'Focus',             'Slow steady orbit of the camera around a key interior focal point — a furniture arrangement, sculpture, or architectural feature. 360° or 180° arc. Consistent radius. Soft ambient lighting. Background gently rotates. Luxury interior quality.'),
      p('Enter Room',               'DoorOpen',          'Camera positioned at doorway threshold, then smoothly advances through the door frame and into the room. Full spatial reveal as camera enters. Lighting changes from corridor to room. Architectural proportions disclosed progressively as camera travels forward.'),
      p('Corner Reveal',            'Aperture',          'Camera tracks slowly around a corner — what lies beyond is concealed then progressively disclosed as the camera rounds the turn. Spatial anticipation. Lighting shifts as new space is revealed. Cinematic corner reveal technique. Interior architecture quality.'),
      p('Hallway Walk',             'Footprints',        'Natural walking pace camera movement along a corridor or hallway. Doors and openings pass on either side. End wall or turn approaches. Lighting conditions change along the path. Architectural proportions of the circulation space clearly communicated. Interior design quality.'),
      p('Ceiling Reveal',           'ArrowUpFromLine',   'Camera tilts slowly upward from eye level to reveal an elaborate ceiling design — coffered plaster, timber beams, decorative lighting, skylight, or architectural canopy. Dramatic tilt reveal. Ceiling detail comes into crisp focus. Ambient light from above strengthens.'),
      p('Floor Detail Close-Up',    'ArrowDownFromLine', 'Camera tilts down and tracks slowly to showcase premium flooring material — marble veining, herringbone timber, geometric tile pattern, or polished concrete. Macro-level detail. Surface reflections. Lighting rakes across the floor to reveal texture depth.'),
      p('Material Close-Up',        'Layers',            'Extreme cinematic close-up of a premium surface material — camera holds then slowly pulls focus through the texture. Marble veining, timber grain, woven fabric, brushed metal, or terrazzo aggregate. Shallow depth of field. Lighting reveals surface micro-texture. Premium material quality.'),
      p('Furniture Focus',          'Sofa',              'Camera slowly tracks in on a key furniture piece — sofa, dining table, or statement chair. Background interior gently blurs with shallow depth of field as camera approaches. Fabric texture, joinery, and material quality come into sharp focus. Luxury furniture photography quality.'),
      p('Window Reveal',            'Sun',               'Camera tracks slowly toward a large window or glazed wall. Exterior view is gradually disclosed — garden, cityscape, or landscape. Interior lighting balanced against bright exterior. Curtains or blinds frame the view. Cinematic moment of spatial connection between inside and outside.'),
      p('Lighting Showcase',        'Lightbulb',         'Camera moves slowly through the interior in low ambient conditions to showcase indirect architectural lighting — cove LEDs, pendant pools, uplighting, and accent spots. Each light source revealed in sequence. Warm color temperature. Dramatic shadow play. Luxury hotel lighting quality.'),
      p('Natural Light Sweep',      'SunDim',            'Time-accelerated interior sequence where sunlight tracks across the space — a shaft of light moves from one wall to another as sun position changes. Shadows shift. Warm light patches travel across surfaces. Interior materials change appearance as light quality evolves. Atmospheric and calm.'),
      p('Depth of Field',           'Aperture',          'Camera holds static while focus shifts — foreground element sharpens, background blurs, then focus pulls to the background as the foreground softens. Interior architecture and materials transition through the focus rack. Cinematic lens quality. Premium interior depth.'),
      p('Luxury Hotel Feel',        'Crown',             'Cinematic interior movement sequence with the pacing and quality of a luxury hotel brand film — slow tracking, smooth curves, deliberate holds on premium details, warm ambient lighting, impeccable staging. No fast movement. Elevated atmosphere. Five-star interior quality throughout.'),
      p('Interior Timelapse',       'Moon',              'Static camera positioned inside the space while time accelerates — daylight enters and sweeps across the interior over the course of a day. Morning fill, afternoon highlights, golden hour warmth, dusk transition, night ambiance. Interior materials shift appearance throughout. Architectural atmosphere over time.'),
      p('Floating Camera',          'Wind',              'Ultra-smooth floating camera movement through the interior — no camera shake, perfectly steady, slight elevation above eye level. Gentle organic path curving through the space. Architectural features pass with cinematic deliberateness. Premium luxury feel. Gimbal-quality stability.'),
    ],
  },

  // ── Exterior Camera Movements ─────────────────────────────────────────────
  {
    category: 'Exterior Camera Movements',
    icon: 'Plane',
    prompts: [
      p('Drone Rise',               'ArrowUpFromLine',   'Drone begins at ground level beside the building and rises slowly and smoothly to full rooftop height. Building facade passes in frame. Sky opens above. Surrounding context revealed progressively. Final frame: building from above at golden hour. Cinematic aerial quality.'),
      p('Drone Descend',            'ArrowDownFromLine', 'Drone begins high above, then descends slowly and precisely toward the building entrance. Sky and upper facades frame the descent. Ground level and entrance forecourt revealed. Camera settles at eye level with the main facade. Cinematic drone landing quality.'),
      p('Drone Orbit',              'Focus',             'Smooth 360° aerial orbit around the building at a consistent radius and altitude. All four elevations revealed in sequence. Surrounding landscape and urban context visible. Constant speed. Cinematic aerial quality. Building always centered in frame throughout the orbit.'),
      p('Hero Shot',                'Sparkles',          'Epic wide-angle architectural hero shot — low angle, slight upward tilt, building fills frame against dramatic sky. Golden hour light rakes across facade. Foreground landscape or reflective pool anchors composition. Cinematic color grade. Hold static. The definitive image of this building.'),
      p('Front Facade Reveal',      'MoveRight',         'Camera approaches the main facade directly from the street — begins distant, moves forward at a measured cinematic pace, building grows in frame, architectural details resolve progressively, entrance composition fills the frame. Steady tracking. Premium architectural photography quality.'),
      p('Side Elevation Walk',      'MoveRight',         'Camera tracks laterally along the side elevation — smooth parallel movement at a consistent distance. Full elevation length disclosed from one end to the other. Facade rhythm, fenestration pattern, and material changes revealed. Architectural elevation quality. Cinematic pacing.'),
      p('Low Angle Drama',          'ArrowDownFromLine', 'Camera positioned very low — nearly at ground plane — looking up at the building against the sky. Dramatic forced perspective. Facade towers above. Architectural verticals exaggerated. Sky and clouds visible above the building. Cinematic dramatic low angle. Hold static.'),
      p('High Angle Overview',      'ArrowUpFromLine',   'Camera positioned high above — drone or elevated — looking straight down or at a steep downward angle onto the building rooftop and site. Site plan revealed. Landscape and urban context visible. Roof geometry and terrace organization disclosed. Premium aerial overview quality.'),
      p('Street Level Approach',    'Car',               'Camera at pedestrian eye level approaching the building from the street. Surroundings pass on either side. Building entrance becomes the destination. Street furniture, trees, and parked vehicles provide scale. Natural movement speed. Architectural context in full. Arrival sequence quality.'),
      p('Pedestrian Arrival',       'Footprints',        'Walking pace approach from the arrival forecourt toward the main entrance — camera at human eye level, slight natural sway, entrance sequence unfolds, canopy or portal framed. Architecture reveals its scale proportionally to the approaching human. Cinematic arrival experience.'),
      p('Fly Through Outdoor',      'Wind',              'Camera flies smoothly and continuously through the outdoor spaces — gardens, courtyards, covered walkways, pool terrace — without cutting. Continuous fluid path through exterior spaces. Architecture frames each passage. Landscape and hardscape in full. Cinematic outdoor journey quality.'),
      p('Landscape Reveal',         'TreePine',          'Camera begins behind mature trees or planting mass. Vegetation slowly parts as camera tracks forward to reveal the building beyond. Building emerges through the landscape frame. Layered depth — foreground trees, middle ground planting, background architecture. Cinematic landscape photography quality.'),
      p('Pool Reflection',          'Waves',             'Camera holds or slowly tracks alongside a swimming pool or reflecting pond. Building facade and sky perfectly reflected in the still water surface. Double composition — architecture above, mirrored below. Ripples break the reflection gently. Luxury resort or residential quality.'),
      p('Zoom In',                  'Search',            'Camera holds static, then smoothly zooms in cinematically on an architectural feature or facade detail — compression increases, depth of field shallows, background blurs, foreground element fills frame. Premium lens quality. Hold the compressed composition.'),
      p('Zoom Out',                 'Search',            'Camera holds tight on an architectural detail, then smoothly zooms out to reveal the full building in context. Local detail dissolves into architectural overview. Site, surroundings, and landscape emerge. Cinematic reverse reveal. Hold the final wide composition.'),
      p('Sunset Reveal',            'Sunset',            'Building stands in full golden hour — warm directional light rakes across facade textures, long shadows sweep across the ground plane, sky transitions from golden to deep orange to crimson. Camera holds or slowly orbits. Atmosphere deepens. Architecture in its most cinematic light.'),
      p('Night Reveal',             'MoonStar',          'Luxury night architectural sequence — building fully illuminated against deep dark sky. Facade accent lighting highlights architectural features. Interior warmth glows behind glazing. Landscape lighting activates. Reflective pool mirrors the lit facade. Camera orbits slowly. Premium night photography quality.'),
      p('Rain Atmosphere',          'CloudRain',         'Building under cinematic overcast rain — wet surfaces with deep material saturation, rain streaks visible against lit areas, puddles form on paving and reflect the illuminated facade. Atmosphere is moody, dramatic, cinematic. Architecture remains powerful in wet conditions. Premium atmospheric quality.'),
    ],
  },

];

// ─── Text-to-Image Generation Prompts Library ────────────────────────────────
export const GENERATE_PRESET_PROMPTS: PresetGroup[] = [
  {
    category: 'Architectural Concepts',
    icon: 'Building2',
    prompts: [
      p('Futuristic Eco Tower', 'Building2', 'A futuristic sustainable skyscraper with integrated vertical gardens, parametric glass facade, solar tracking louvers, dramatic dusk lighting, photorealistic archviz 8k.'),
      p('Modernist Cliffside Villa', 'Home', 'Ultra-luxury modernist cliffside villa over ocean, cantilevered concrete slabs, floor-to-ceiling glass, infinity pool, golden hour atmospheric lighting.'),
      p('Parametric Cultural Museum', 'Sparkles', 'Iconic parametric cultural museum with sculptural fluid white concrete shell, reflections in a surrounding water mirror pool, architectural photography.'),
      p('Scandinavian Minimal Residence', 'Home', 'Scandinavian minimalist residence with burnt wood Shou Sugi Ban cladding, warm interior glow, soft overcast natural morning light, serene natural landscape.'),
      p('Brutalist Desert Oasis', 'HardHat', 'Monumental brutalist villa in a desert landscape, board-marked raw concrete, dramatic shadows, sunken courtyard with palm trees.'),
    ],
  },
  {
    category: 'Interior Design Concepts',
    icon: 'Sofa',
    prompts: [
      p('Luxury Japandi Living Room', 'Sofa', 'Spacious Japandi living room with low wooden furniture, neutral linen upholstery, Wabi-Sabi plaster walls, large window with bamboo view, soft diffused morning sunlight.'),
      p('Executive Penthouse Office', 'Crown', 'High-end penthouse executive office, dark walnut wood panelling, Italian leather armchairs, panoramic city skyline view at night.'),
      p('Minimalist Marble Kitchen', 'Gem', 'Monolithic kitchen island in dark Nero Marquina marble, concealed minimalist cabinetry, pendant brass lighting, warm architectural atmosphere.'),
      p('Biophilic Urban Loft', 'Leaf', 'Industrial urban loft with exposed brick, double-height ceiling, hanging indoor plants, floor-to-ceiling windows with soft daylight.'),
    ],
  },
  {
    category: 'Landscape & Masterplan',
    icon: 'TreePine',
    prompts: [
      p('Biophilic Urban Masterplan', 'TreePine', 'Aerial masterplan render of a eco-friendly smart city district with pedestrian green corridors, rooftop gardens, natural streams, volumetric daylight.'),
      p('Desert Luxury Resort', 'Sun', 'Luxury desert wellness resort with rammed earth walls, palm trees, sunken seating pits, ambient candlelight lighting at twilight.'),
      p('Waterfront Promenade', 'Waves', 'Modern waterfront urban promenade with timber decking, parametric shaded pergolas, pedestrian activity, serene water reflection.'),
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

