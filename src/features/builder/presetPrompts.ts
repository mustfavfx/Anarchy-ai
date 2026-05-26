/**
 * Preset Prompts Library
 * Curated architectural & design prompts organized by category
 * Icons reference Lucide icon names — mapped in BuilderPage.tsx
 */

export interface PresetPrompt {
  label: string;
  icon: string;   // Lucide icon name
  text: string;
}

export interface PresetGroup {
  category: string;
  prompts: PresetPrompt[];
}

export const PRESET_PROMPTS: PresetGroup[] = [
  // ─── Rendering & Realism ──────────────────────────────────────────
  {
    category: 'Rendering & Realism',
    prompts: [
      {
        label: 'Photorealistic Render',
        icon: 'Camera',
        text: 'Create photorealistic image with accurate lighting, natural shadows, high-resolution textures, realistic reflections, and professional architectural photography quality.',
      },
      {
        label: 'Enhance Realism',
        icon: 'Sparkles',
        text: 'Make this render photorealistic, add realistic cast shadows and ambient occlusion, high contrast directional light, enhance surface textures with fine grain and imperfections, add subtle depth of field, professional color grading.',
      },
      {
        label: 'Developer Finish',
        icon: 'Building',
        text: 'Transform this image into a clean developer-finish architectural visualization. Keep original geometry, layout and camera unchanged. Apply smooth painted white walls, finished floors, clean ceilings, installed windows and doors, neutral modern materials. Empty unfurnished space prepared for handover.',
      },
      {
        label: 'Construction State',
        icon: 'HardHat',
        text: 'Transform the scene into a realistic unfinished construction state, exposing raw concrete, structural surfaces and unpainted materials, with visible construction details such as rough textures, installation elements, exposed edges, dust and natural building imperfections while maintaining original architecture.',
      },
    ],
  },

  // ─── Lighting & Mood ──────────────────────────────────────────────
  {
    category: 'Lighting & Mood',
    prompts: [
      {
        label: 'Night Scene',
        icon: 'Moon',
        text: 'Convert the daytime scene into a moody nighttime shot. Bright moon as the primary light source from window invisible in the scene, soft rim light outlining objects. Warm interior lights contrasting with cool moonlight tones. Add slight atmospheric haze or moisture for a cinematic feel. Realistic shadows, natural night white balance, high quality, dramatic cinematic look.',
      },
      {
        label: 'Cozy Night + LEDs',
        icon: 'Lightbulb',
        text: 'Change day to night, add LED strips along architectural edges, turn all artificial lights on with warm color temperature, create cozy inviting vibe with soft ambient glow, realistic light falloff, warm reflections on surfaces.',
      },
      {
        label: 'Night to Day',
        icon: 'Sun',
        text: 'Change night to day with natural bright sunlight streaming through windows, clear blue sky visible outside, realistic daylight color temperature, soft natural shadows, bright and airy atmosphere.',
      },
      {
        label: 'Golden Hour',
        icon: 'Sunset',
        text: 'Change the mood to golden hour, add low warm sun rays gently piercing through the shadows, rich amber and honey tones, long dramatic shadows, magical warm atmosphere, cinematic lens flare, photorealistic golden light.',
      },
      {
        label: 'Brighten',
        icon: 'SunDim',
        text: 'Make the scene a little bit brighter, increase ambient light levels naturally, soften harsh shadows, improve overall exposure while maintaining realistic lighting and color balance.',
      },
      {
        label: 'Match Mood',
        icon: 'Palette',
        text: 'Match the mood of the reference image — replicate the exact lighting conditions, color temperature, atmosphere, shadow intensity, and overall tonal feel while keeping the architectural content unchanged.',
      },
    ],
  },

  // ─── Weather & Seasons ────────────────────────────────────────────
  {
    category: 'Weather & Seasons',
    prompts: [
      {
        label: 'Rainy Day',
        icon: 'CloudRain',
        text: 'Change the scene to a rainy day. Overcast sky, soft diffused light, wet reflective surfaces, realistic rain streaks outside the windows, subtle water reflections on the ground, puddles with ripples, moody atmosphere, natural muted lighting, photorealistic render.',
      },
      {
        label: 'Autumn Scene',
        icon: 'Leaf',
        text: 'Ultra-realistic autumn scene with a moody atmosphere, overcast sky, soft diffused light, light mist in the air, wet ground reflecting subtle light, deep warm browns and muted orange tones mixed with cool grey shadows, fallen leaves scattered naturally, damp textures, cinematic mood, realistic fog depth, high detail, natural color grading, professional photography, shallow depth of field, sharp focus, 8k, photorealistic.',
      },
      {
        label: 'Winter / Snow',
        icon: 'Snowflake',
        text: 'Transfer this image to winter, add a realistic blanket of snow covering roofs, ground, and landscape elements, frost on windows, overcast winter sky, cold blue-white color palette, visible breath in cold air, icicles on edges, photorealistic winter atmosphere.',
      },
      {
        label: 'Fog',
        icon: 'CloudFog',
        text: 'Add realistic atmospheric fog to the scene, soft diffusion of distant elements, gradual depth fog reducing visibility, misty mysterious mood, subtle light scattering, photorealistic volumetric haze.',
      },
      {
        label: 'Volumetric Rays',
        icon: 'SunMedium',
        text: 'Add volumetric god rays coming from behind trees and structures, dramatic light beams cutting through shadows, enhanced atmospheric haze, cinematic lighting, photorealistic light scattering effect.',
      },
    ],
  },

  // ─── Close-ups & Details ──────────────────────────────────────────
  {
    category: 'Close-ups & Details',
    prompts: [
      {
        label: 'Material Macro',
        icon: 'Search',
        text: 'Extreme macro close-up of a material surface from the scene, revealing fine texture and realistic imperfections, with surrounding objects softly visible in the background, cinematic macro photography with shallow depth of field, 8K detail.',
      },
      {
        label: 'Detail Closeup',
        icon: 'Focus',
        text: 'Create a beautiful closeup shot showing one of the details of this image, use depth of field to blur surroundings, add bokeh highlights, show fine details in focus, add some small decorative objects for scale and context.',
      },
      {
        label: 'Life Activity',
        icon: 'PersonStanding',
        text: 'Close-up of everyday activity within the environment, natural human interaction with the space, cinematic depth of field, warm natural lighting, lifestyle photography feel, photorealistic.',
      },
      {
        label: 'Animal in Scene',
        icon: 'Cat',
        text: 'Cinematic close-up of a domestic animal (cat or dog) naturally behaving within the environment, resting on furniture or walking through the space, shallow depth of field, warm lighting, photorealistic fur detail.',
      },
    ],
  },

  // ─── People & Objects ─────────────────────────────────────────────
  {
    category: 'People & Objects',
    prompts: [
      {
        label: 'Add People',
        icon: 'Users',
        text: 'Add photorealistic people naturally interacting within the space — walking, sitting, conversing. Diverse group, contemporary casual clothing, natural poses, correct scale and perspective, realistic shadows and lighting matching the scene.',
      },
      {
        label: 'Blurred People',
        icon: 'Footprints',
        text: 'Add blurred people in motion walking through the space, long exposure motion blur effect, ghostly silhouettes suggesting activity and life, realistic movement trails, architectural photography style.',
      },
      {
        label: 'Add Cars',
        icon: 'Car',
        text: 'Add photorealistic parked cars appropriate to the scene context, correct scale and perspective, realistic reflections on car paint, natural shadows on ground, modern vehicle models.',
      },
      {
        label: 'Blurred Cars',
        icon: 'Zap',
        text: 'Add blurred cars in motion on the road, long exposure motion blur with light trails, dynamic movement suggesting urban life, realistic headlight and taillight streaks.',
      },
      {
        label: 'Birds in Sky',
        icon: 'Bird',
        text: 'Add small birds flying naturally in the sky, scattered in a realistic flock pattern, various distances creating depth, subtle silhouettes against the sky, natural flight poses.',
      },
    ],
  },

  // ─── Landscape & Nature ───────────────────────────────────────────
  {
    category: 'Landscape & Nature',
    prompts: [
      {
        label: 'Add Flowers',
        icon: 'Flower2',
        text: 'Add beautiful realistic flowers and flowering plants to the scene — garden beds, potted arrangements, climbing vines. Natural color palette, realistic petals and leaves, appropriate scale, soft natural lighting.',
      },
      {
        label: 'Add Grass',
        icon: 'Sprout',
        text: 'Add lush realistic grass and ground cover to outdoor areas, natural variation in height and color, some wildflowers mixed in, realistic soil edges, photorealistic lawn textures.',
      },
      {
        label: 'Add Trees',
        icon: 'TreePine',
        text: 'Add mature realistic trees to the landscape, appropriate species for the climate, natural canopy shapes, detailed bark and leaf textures, realistic shadows cast on ground and building, photorealistic foliage.',
      },
    ],
  },

  // ─── Camera & Composition ─────────────────────────────────────────
  {
    category: 'Camera & Composition',
    prompts: [
      {
        label: 'Drone View',
        icon: 'Plane',
        text: 'Move the camera to a high drone viewpoint above the scene, revealing a large surrounding environment around the project. Keep the main object clearly visible while preserving original frame proportions and composition. Bird\'s eye perspective, wide context.',
      },
      {
        label: 'Right Perspective',
        icon: 'MoveRight',
        text: 'Move the camera all the way to the right; show objects from a right-side perspective while maintaining architectural accuracy, proper vanishing points, and realistic proportions.',
      },
      {
        label: 'Top View',
        icon: 'ArrowDownFromLine',
        text: 'Show this space from directly above, plan view perspective, all elements visible from top-down angle, maintain correct proportions and spatial relationships, clean overhead composition.',
      },
      {
        label: 'Another Angle',
        icon: 'RotateCcw',
        text: 'Take a shot from a completely different angle — new camera position revealing unseen aspects of the space, fresh perspective, maintain architectural accuracy and realistic lighting from the new viewpoint.',
      },
    ],
  },

  // ─── Style & Aesthetics ───────────────────────────────────────────
  {
    category: 'Style & Aesthetics',
    prompts: [
      {
        label: 'Cinematic Film',
        icon: 'Clapperboard',
        text: 'Ultra cinematic architectural photography, anamorphic lens flare, atmospheric depth, subtle film grain, moody contrast, realistic exposure rolloff, award-winning ArchDaily visual style.',
      },
      {
        label: 'Luxury Interior',
        icon: 'Gem',
        text: 'Luxury contemporary interior design, Italian furniture aesthetic, soft indirect lighting, natural stone surfaces, premium materials, elegant composition, high-end hospitality atmosphere.',
      },
      {
        label: 'Dezeen Editorial',
        icon: 'BookImage',
        text: 'Professional architectural editorial photography, Dezeen magazine aesthetic, carefully balanced composition, realistic environmental context, premium architectural storytelling.',
      },
      {
        label: 'Clay Render',
        icon: 'CircleDashed',
        text: 'Monochromatic clay render, white matte material override, soft studio lighting, architectural form study, clean shadows, concept visualization.',
      },
    ],
  },

  // ─── Technical & Presentation ─────────────────────────────────────
  {
    category: 'Technical & Presentation',
    prompts: [
      {
        label: 'Material Moodboard',
        icon: 'SwatchBook',
        text: 'Create a high-end interior design material moodboard using only the materials present in the 3D scene. Arrange the samples in an artistic, layered composition similar to luxury architectural boards, with realistic textures, shadows, and soft studio lighting. Include stone, wood, fabric, metal, and color swatches exactly as they appear in the scene, presented as physical material tiles and samples. Use a refined neutral background, elegant styling, and balanced layout to achieve a premium, photorealistic moodboard aesthetic.',
      },
      {
        label: 'Editorial Board',
        icon: 'PanelTop',
        text: 'Create a high-end editorial design presentation board based on the provided project. Do not redesign the project — only present it in a premium portfolio style. Include: one large dominant isometric cut-away axonometric view as focal point, a front elevation with subtle dimensions, a secondary elevation highlighting materials, curated material swatches arranged aesthetically, minimal elegant annotations, clear visual hierarchy and negative space. Modern editorial layout, Behance premium presentation style, minimal Scandinavian mood, soft beige and warm wood palette, thin architectural linework, clean sans-serif typography, luxury interior design sheet.',
      },
      {
        label: 'Technical Drawings',
        icon: 'Ruler',
        text: 'Create technical architectural drawings of this object — clean precise linework, proper line weights, dimension annotations, section markers, material hatching, professional drafting style, white background, CAD-quality presentation.',
      },
      {
        label: '3D Section Cut',
        icon: 'Scissors',
        text: 'Create a 3D cross-section in axonometric orthographic projection, visible from top 3/4 angle, clean cut plane revealing interior spaces and structure, contrasting cut surface with visible interior, professional architectural section perspective.',
      },
      {
        label: 'Scale Model',
        icon: 'Box',
        text: 'Close-up of an architectural mockup model, axonometric view, depth of field, closeup, bokeh, highly detailed scale model of this space, clean materials like white foam board, wood, acrylic, precise miniature windows and structures, placed on a presentation table, soft studio lighting.',
      },
      {
        label: 'Pencil Sketch',
        icon: 'PenLine',
        text: 'Convert the photo into an architectural pencil sketch — clean confident line work, cross-hatching for shadows, varying line weights for depth, professional hand-drawn quality, white paper background, artistic architectural illustration.',
      },
      {
        label: '2D Logo',
        icon: 'Hexagon',
        text: 'Create a clean minimal 2D logo inspired by the silhouette and key architectural features of this object — geometric simplification, bold lines, scalable vector style, modern branding aesthetic, single color on white background.',
      },
    ],
  },
];
