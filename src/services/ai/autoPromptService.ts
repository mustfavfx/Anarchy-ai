import { logger } from '../../utils/logger';
import { geminiAgentService } from '../gemini/GeminiAgentService';

export interface AutoPromptOptions {
  mode?: 'generate' | 'inpaint' | 'upscale';
  model?: string;
  language?: 'ar' | 'en' | 'auto';
  preserveArabic?: boolean;
}

export interface AutoPromptResult {
  enhancedPrompt: string;
  originalPrompt: string;
  detectedLanguage: 'ar' | 'en';
  engine: 'gemini' | 'offline_engine';
}

/**
 * Detects if the given text is primarily Arabic
 */
export function detectLanguage(text: string): 'ar' | 'en' {
  if (!text || !text.trim()) return 'en';
  // Check for Arabic Unicode range (\u0600-\u06FF, \u0750-\u077F, \u08A0-\u08FF)
  const arabicCharCount = (text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || []).length;
  const latinCharCount = (text.match(/[a-zA-Z]/g) || []).length;
  return arabicCharCount >= latinCharCount && arabicCharCount > 0 ? 'ar' : 'en';
}

/**
 * Architectural Dictionary & Pattern Expander
 * Contains high-fidelity architectural vocabulary in both Arabic and English.
 */
interface KeywordMapping {
  matchers: (string | RegExp)[];
  expansionEn: string;
  expansionAr: string;
}

const ARCHITECTURAL_MAPPINGS: KeywordMapping[] = [
  // Building / Typology
  {
    matchers: ['فيلا', 'villa', 'mansion', 'قصر', 'بيت فخم'],
    expansionEn: 'ultra-luxurious contemporary residential villa, sleek cantilevered geometric volumes, floating structural slabs',
    expansionAr: 'فيلا سكنية معاصرة فائقة الفخامة، كتل هندسية بارزة وأسقف طائرة وتصميم معماري حديث',
  },
  {
    matchers: ['برج', 'ناطحة سحاب', 'skyscraper', 'tower', 'high rise', 'مبنى شاهق'],
    expansionEn: 'monumental aerodynamic skyscraper tower, parametric diagrid glass facade, soaring vertical silhouette',
    expansionAr: 'ناطحة سحاب شاهقة بتصميم إيروديناميكي حديث، واجهات زجاجية دياجريد بانورامية وخطوط عمودية انسيابية',
  },
  {
    matchers: ['متحف', 'معرض', 'museum', 'cultural center', 'gallery', 'مركز ثقافي'],
    expansionEn: 'sculptural architectural museum pavilion, curvilinear fluid geometries, grand open atrium with diffused natural skylights',
    expansionAr: 'مبنى متحف معماري نحتي، خطوط هندسية انسيابية وفناء مفتوح بإضاءة سماوية طبيعية ساحرة',
  },
  {
    matchers: ['مطبخ', 'kitchen'],
    expansionEn: 'minimalist luxury kitchen, monolithic waterfall island with Calacatta marble, matte black architectural joinery, integrated warm under-cabinet LED strip lighting',
    expansionAr: 'مطبخ مودرن فاخر، جزيرة رخامية شلالية من رخام كالاكاتا الطبيعي، خزائن مدمجة بلون داكن أنيق وإضاءة شريطية مخفية',
  },
  {
    matchers: ['صالون', 'صالة', 'غرفة معيشة', 'living room', 'lounge', 'interior'],
    expansionEn: 'spacious double-height luxury living room, bespoke designer furniture, sunken lounge conversation pit, fluted oak wall panels, floor-to-ceiling panoramic glass',
    expansionAr: 'غرفة معيشة فاخرة فسيحة بارتفاع مضاعف، أثاث عصري مخصص، جلسة غاطسة، جدران مكسوة بشرائح خشب البلوط وزجاج بانورامي واسع',
  },
  {
    matchers: ['غرفة نوم', 'bedroom', 'master bedroom'],
    expansionEn: 'serene master bedroom suite, upholstered headboard wall, acoustic wood slatted ceiling, soft sheer linen drapes, ambient warm twilight lighting',
    expansionAr: 'جناح نوم رئيسي هادئ وفخم، جدار خلفي مبطن، سقف من شرائح الخشب العازلة، ستائر كتان ناعمة وإضاءة شفق دافئة مريحة',
  },
  {
    matchers: ['حمام', 'bathroom', 'spa'],
    expansionEn: 'luxurious spa-like bathroom, freestanding matte stone soaking tub, bookmatched travertine tiles, brass concealed fixtures, recessed LED perimeter coves',
    expansionAr: 'حمام سبا فاخر، حوض استحمام حجري مستقل مطفي، رخام ترافيرتين متطابق العروق وإضاءة محيطية مخفية',
  },
  {
    matchers: ['مسبح', 'حوض سباحة', 'pool', 'infinity pool', 'swimming pool'],
    expansionEn: 'crystalline illuminated infinity pool with submerged seating, dark basalt coping stones, seamless reflective water mirror surface',
    expansionAr: 'مسبح إنفينيتي بماء بلوري عذب وجلسات غاطسة، حواف حجرية داكنة وانعكاسات مرآتية نقية',
  },
  {
    matchers: ['حديقة', 'لاندسكيب', 'landscape', 'garden', 'greenery', 'فناء'],
    expansionEn: 'manicured biophilic architectural landscape, olive trees, sculptural rock boulders, architectural sunken planter boxes, soft pathway uplighting',
    expansionAr: 'لاندسكيب معماري حيوي بأشجار زيتون معمرة وصخور طبيعية منسقة وأحواض نباتية غاطسة وإضاءات أرضية خافتة',
  },

  // Locations / Context
  {
    matchers: ['بحر', 'شاطئ', 'ساحل', 'ocean', 'sea', 'beach', 'coastal'],
    expansionEn: 'perched along a pristine rocky coastline, panoramic azure ocean horizon, gentle sea spray, coastal maritime atmosphere',
    expansionAr: 'مطلة مباشرة على ساحل صخري خلاب وأفق بحري مفتوح برذاذ بحري هادئ وأجواء ساحلية ساحرة',
  },
  {
    matchers: ['صحراء', 'رمل', 'desert', 'dunes', 'oasis', 'واحة'],
    expansionEn: 'dramatic undulating sand dunes, arid desert oasis setting, warm rammed earth masonry, wind-sculpted landscape',
    expansionAr: 'كثبان رملية متموجة وساحرة، واحة صحراوية معمارية دافئة وتناغم بيئي مع الطبيعة',
  },
  {
    matchers: ['جبل', 'جبال', 'mountain', 'cliff', 'alpine', 'منحدر'],
    expansionEn: 'dramatic cliffside alpine topography, rugged pine-forested mountains, morning mist hovering over mountain valleys',
    expansionAr: 'منحدرات جبلية شاهقة، غابات صنوبر جبلية وضباب صباحي يعلو الوديان بجمالية دراماتيكية',
  },
  {
    matchers: ['مدينة', 'شوارع', 'city', 'urban', 'downtown', 'skyline'],
    expansionEn: 'dense metropolitan downtown context, bustling city avenue reflections, architectural streetscape integration',
    expansionAr: 'أجواء وسط المدينة المعاصرة، انعكاسات الشوارع الحضرية ودمج معماري متكامل مع النسيج العمراني',
  },

  // Materials & Finishes
  {
    matchers: ['زجاج', 'واجهات زجاجية', 'glass', 'facade', 'curtain wall', 'نوافذ كبيرة'],
    expansionEn: 'minimalist frameless triple-glazed curtain wall, ultra-clear acoustic low-iron glass, crisp transparent reflections',
    expansionAr: 'واجهات زجاجية بانورامية ممتدة من الأرض إلى السقف، زجاج عازل شفاف فائق النقاء وانعكاسات نقية',
  },
  {
    matchers: ['كونكريت', 'خرسانة', 'اسمنت', 'concrete', 'brutalist'],
    expansionEn: 'architectural board-formed exposed concrete, subtle formwork tie-hole textures, tactile raw matte finish',
    expansionAr: 'خرسانة مكشوفة ناعمة مطبوعة بألواح الخشب، ملمس مطفي واقعي وأصيل بتفاصيل دقيقة',
  },
  {
    matchers: ['خشب', 'باركيه', 'wood', 'timber', 'teak'],
    expansionEn: 'warm natural teak wood louvers, sustainable architectural timber cladding, precise shadow-gap joinery',
    expansionAr: 'شرائح خشب الساج الطبيعي الدافئ، تكسيات خشبية مستدامة بفواصل ظل معمارية دقيقة',
  },
  {
    matchers: ['رخام', 'حجر', 'marble', 'stone', 'travertine'],
    expansionEn: 'honed Roman travertine stone slabs, delicate vein-cut texture, timeless earthy tactile materiality',
    expansionAr: 'ألواح حجر ترافيرتين روماني، ملمس ترابي فاخر وتفاصيل عروق طبيعية ناعمة',
  },
  {
    matchers: ['معدن', 'المنيوم', 'حديد', 'metal', 'steel', 'bronze', 'brass'],
    expansionEn: 'brushed champagne bronze metal trims, dark anodized aluminum reveals, bespoke structural steel articulation',
    expansionAr: 'تفاصيل معدنية برونزية مصقولة، إطارات ألمنيوم داكنة وفواصل معمارية أنيقة',
  },

  // Lighting & Mood
  {
    matchers: ['ليل', 'ليلي', 'night', 'twilight', 'مساء', 'dusk'],
    expansionEn: 'atmospheric twilight blue hour, sophisticated 2700k warm interior illumination spilling outward, subtle landscape uplights',
    expansionAr: 'أجواء الشفق وساعة الزرقة الليلية، إضاءة معمارية داخلية دافئة تنسكب بانسيابية نحو الخارج وإضاءة لاندسكيب مدروسة',
  },
  {
    matchers: ['غروب', 'شمس', 'sunset', 'golden hour', 'شروق', 'sunrise'],
    expansionEn: 'radiant golden hour lighting, long cinematic shadows, warm sunbeams grazing architectural surfaces, atmospheric haze',
    expansionAr: 'إضاءة الساعة الذهبية الدافئة، ظلال سينمائية ممتدة، أشعة شمس تخترق الفراغات المعمارية',
  },
  {
    matchers: ['صباح', 'نهار', 'morning', 'daylight', 'sunny', 'مشمس'],
    expansionEn: 'crisp natural daylight, soft diffused atmospheric skylight, clean balanced directional shadows',
    expansionAr: 'ضوء نهار طبيعي ونقي، إضاءة سماء ناعمة متوازنة وظلال واقعية متناسقة',
  },
  {
    matchers: ['مطر', 'غيم', 'ضباب', 'rain', 'fog', 'mist', 'overcast'],
    expansionEn: 'moody overcast lighting, wet pavement reflections, ethereal atmospheric fog, diffused ambient occlusion',
    expansionAr: 'إضاءة غائمة دراماتيكية، انعكاسات أسطح مبللة وضباب جوي ساحر يعزز العمق البصري',
  },

  // Styles & Movements
  {
    matchers: ['مودرن', 'معاصر', 'modern', 'contemporary', 'minimalist'],
    expansionEn: 'ultra-clean minimalist geometric volumes, deep cantilevered concrete overhangs, seamless indoor-outdoor floor integration, 15mm negative shadow reveals',
    expansionAr: 'كتل هندسية معاصرة بخطوط نقية، أسقف كابولية خرسانية طافية، تداخل فراغي بين الداخل والخارج وفواصل ظل غائرة 15mm',
  },
  {
    matchers: ['مشربية', 'إسلامي', 'mashrabiya', 'islamic', 'oriental'],
    expansionEn: 'contemporary parametric geometric mashrabiya screen panels, cast shadow patterns grazing polished stone surfaces, modern oriental luxury',
    expansionAr: 'واجهات مشربية هندسية معاصرة بارامترية، ظلال شمسية ساحرة مسقطة على الأرضيات الحجرية وفخامة شرقية حديثة',
  },
  {
    matchers: ['ياباني', 'وابي سابي', 'جاباندي', 'japandi', 'wabi sabi', 'zen'],
    expansionEn: 'warm Japandi wabi-sabi architectural aesthetic, tactile micro-cement stucco walls, raw organic timber joinery, quiet serene negative space',
    expansionAr: 'طراز جاباندي ووابي سابي معماري دافئ، جدران ميكروسمنت ناعمة، أخشاب عضوية طبيعية وفراغات هادئة تأملية',
  },
  {
    matchers: ['كلاسيك', 'نيوكلاسيك', 'classic', 'neoclassic'],
    expansionEn: 'monumental neoclassical architectural proportions, refined fluted stone pilasters, symmetrical arched openings, understated grand cornice details',
    expansionAr: 'تناسب كلاسيكي حديث متزن، أعمدة حجرية مضلعة أنيقة، فتحات مقوسة متناظرة وتفاصيل كورنيش فخمة رصينة',
  },

  // Commercial & Hospitality Typologies
  {
    matchers: ['مقهى', 'كوفي', 'كافيه', 'cafe', 'coffee shop'],
    expansionEn: 'bespoke specialty cafe interior, fluted terrazzo bar counter, sculptural acoustic pendant lamps, cozy warm 2700K hospitality lighting',
    expansionAr: 'مقهى عصري فاخر، كاونتر رئيسي من التيرازو الإيطالي، وحدات إضاءة معلقة نحتية وأجواء ضيافة دافئة بحرارة 2700K',
  },
  {
    matchers: ['مكتب', 'مقر', 'شركة', 'office', 'headquarters', 'workspace'],
    expansionEn: 'state-of-the-art biophilic corporate headquarters, open flexible collaborative lounges, acoustic slatted ceilings, floor-to-ceiling curtain wall views',
    expansionAr: 'مقر شركات عصري بتصميم بيوفيليك حيوي، صالات عمل مرنة، أسقف خشبية عازلة للصوت وإطلالات زجاجية بانورامية واسعة',
  },
  {
    matchers: ['مطعم', 'restaurant', 'dining'],
    expansionEn: 'luxurious fine-dining restaurant interior, intimate architectural booth seating, ambient dramatic warm spot-lighting, textured ribbed glass screens',
    expansionAr: 'مطعم راقٍ بتصميم معماري استثنائي، جلسات خاصة مريحة، إضاءات بؤرية دافئة وواجهات زجاجية مضلعة فاخرة',
  },
  {
    matchers: ['فندق', 'منتجع', 'hotel', 'resort'],
    expansionEn: 'five-star luxury architectural resort pavilion, floating timber cabanas, integrated reflecting water mirrors, lush native tropical flora',
    expansionAr: 'منتجع فندقي خمس نجوم فائق الفخامة، مظلات خشبية عائمة، مسطحات مائية عاكسة وأشجار طبيعية منسقة بعناية',
  },

  // Photometrics & Optics
  {
    matchers: ['إضاءة مخفية', 'ليد', 'cove', 'indirect lighting'],
    expansionEn: 'concealed linear 3000K LED coves, indirect warm ambient glow washing monolithic wall planes, trimless architectural downlights',
    expansionAr: 'إضاءة خطية مخفية بحرارة 3000K، توهج دافئ يغسل الجدران الحجرية ووحدات إضاءة سقفية غائرة بدون إطار',
  },
  {
    matchers: ['كاميرا', 'منظور', 'عدسة', 'camera', 'lens', 'perspective'],
    expansionEn: '35mm architectural tilt-shift lens, medium format sensor fidelity, two-point perspective with corrected vertical lines, unclipped dynamic range',
    expansionAr: 'عدسة إمالة وإزاحة معمارية 35mm، دقة مستشعر متوسط الحجم، تصحيح المنظور الرأسي ثنائي النقاط وتوازن ضوئي ديناميكي عالي',
  },
];

/**
 * Offline fallback generator that expands short or rough prompts into
 * high-fidelity architectural visualization prompts in the SAME language as the input.
 */
function enhanceWithOfflineEngine(rawPrompt: string, options?: AutoPromptOptions): AutoPromptResult {
  const lang = detectLanguage(rawPrompt);
  const isArabic = lang === 'ar';
  const normalized = rawPrompt.toLowerCase().trim();
  const mode = options?.mode || 'generate';

  const collectedTokens: string[] = [];

  for (const item of ARCHITECTURAL_MAPPINGS) {
    const matched = item.matchers.some((matcher) => {
      if (typeof matcher === 'string') {
        return normalized.includes(matcher.toLowerCase());
      }
      return matcher.test(normalized);
    });

    if (matched) {
      collectedTokens.push(isArabic ? item.expansionAr : item.expansionEn);
    }
  }

  // Base photography & rendering quality standards for both languages
  const qualityTokensAr = mode === 'inpaint'
    ? 'دمج سلس ومتناسق، دمج حواف متناهي الدقة، إضاءة محيطية وظلال مطابقة للمشهد بدقة كلفن، انعكاسات متجانسة وتفاصيل مادية ملموسة، تصوير فوتوغرافي معماري احترافي 8k'
    : 'تصوير فوتوغرافي معماري معتمد من Architectural Digest، عدسة إمالة وإزاحة Tilt-Shift 35mm، تصحيح المنظور العمودي ثنائي النقاط، إضاءة حجمية طبيعية متوازنة بحرارة 5200K، فواصل ظل غائرة 15mm، واقعية مادية ملموسة وتفاصيل دقيقة فائقة الجودة 8k';

  const qualityTokensEn = mode === 'inpaint'
    ? 'seamless edge blending, flawless edge cohesion, matching ambient lighting, matched scene irradiance and Kelvin color temperature, specular reflection alignment, subtle contact ambient occlusion, Architectural Digest photography standard'
    : 'masterpiece architectural photography, 35mm tilt-shift lens, two-point perspective with corrected vertical lines, global illumination bounce lighting, 5200K natural daylight balanced with 3000K warm interior accents, 15mm negative shadow reveals, tactile honed stone and timber tectonics, crisp Hasselblad medium format fidelity';

  let enhancedText = '';

  if (isArabic) {
    if (collectedTokens.length > 0) {
      enhancedText = `${rawPrompt.trim()}، ${collectedTokens.join('، ')}، ${qualityTokensAr}`;
    } else {
      if (mode === 'inpaint') {
        enhancedText = `${rawPrompt.trim()}، عنصر معماري مدمج بسلاسة تامة، إضاءة محيطية وظلال وانعكاسات مطابقة لعمق المشهد، جودة تصوير معماري فائق 8k`;
      } else {
        enhancedText = `${rawPrompt.trim()} بتصميم معماري عصري فريد، كتل هندسية متوازنة، مواد إكساء طبيعية راقية، ${qualityTokensAr}`;
      }
    }
  } else {
    if (collectedTokens.length > 0) {
      enhancedText = `${rawPrompt.trim()}, ${collectedTokens.join(', ')}, ${qualityTokensEn}`;
    } else {
      if (mode === 'inpaint') {
        enhancedText = `${rawPrompt.trim()}, seamlessly integrated architectural element, matching ambient irradiance and scene shadows, photorealistic finish, crisp edge cohesion`;
      } else {
        enhancedText = `Bespoke architectural composition of ${rawPrompt.trim()}, premium material articulation, balanced volumetric massing, ${qualityTokensEn}`;
      }
    }
  }

  return {
    enhancedPrompt: enhancedText.replace(/\s+/g, ' ').trim(),
    originalPrompt: rawPrompt,
    detectedLanguage: lang,
    engine: 'offline_engine',
  };
}

/**
 * Main AutoPrompt Service Class
 */
class AutoPromptService {
  /**
   * Enhances a prompt using Gemini AI if available, strictly preserving the user's input language,
   * falling back smoothly to the offline engine.
   */
  public async enhancePrompt(rawPrompt: string, options?: AutoPromptOptions): Promise<AutoPromptResult> {
    const cleanPrompt = rawPrompt?.trim();
    if (!cleanPrompt) {
      return {
        enhancedPrompt: '',
        originalPrompt: '',
        detectedLanguage: 'en',
        engine: 'offline_engine',
      };
    }

    const lang = options?.language && options.language !== 'auto' 
      ? options.language 
      : detectLanguage(cleanPrompt);

    const isArabic = lang === 'ar';
    const apiKey = geminiAgentService.getApiKey();

    // If no API key is set, use the offline architectural engine immediately
    if (!apiKey) {
      logger.log('[AutoPromptService] No Gemini API key detected, utilizing offline architectural engine.');
      return enhanceWithOfflineEngine(cleanPrompt, { ...options, language: lang });
    }

    // Call Gemini 1.5 Flash API with language-preserving prompt engineering instructions
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const mode = options?.mode || 'generate';

      const systemPrompt = `You are AutoPrompt, the elite AI prompt engineer for Anarchy AI (specializing in architectural visualization, photorealistic design, and modern diffusion models including FLUX, Midjourney, and SDXL).

User prompt: "${cleanPrompt}"
Detected language: ${isArabic ? 'Arabic' : 'English'}
Mode: ${mode === 'inpaint' ? 'Inpainting (Mask replacement)' : 'Full Image Generation'}

CRITICAL LANGUAGE RULE:
${isArabic
  ? `The user's prompt is in ARABIC. You MUST generate the enhanced prompt STRICTLY in HIGH-END PROFESSIONAL ARABIC (باللغة العربية الفصحى المعمارية الاحترافية). DO NOT TRANSLATE TO ENGLISH. All your output MUST be in Arabic.`
  : `The user's prompt is in ENGLISH. You MUST generate the enhanced prompt STRICTLY in HIGH-END PROFESSIONAL ENGLISH.`}

OBJECTIVE:
Enrich and expand the user's prompt into an elite, photorealistic architectural prompt that maximizes diffusion model fidelity:
1. Preserve the user's exact concept, typology, and intent.
2. Detail authentic architectural materials and tectonics (e.g., vein-cut Roman travertine, fair-faced post-tensioned concrete, quarter-sawn oak louvers, 20mm slimline aluminum profiles, 15mm negative shadow beads).
3. Establish precise lighting optics and Kelvin temperatures (e.g., 5200K daylight with balanced 3000K interior warm coves, diffuse bounce global illumination, twilight blue hour contrast).
4. Specify professional architectural photography camera parameters: 35mm tilt-shift lens, 2-point perspective with perfectly straight vertical lines, crisp Hasselblad medium-format detail.
${mode === 'inpaint' ? '5. For Inpainting: Ensure seamless edge cohesion, matching ambient scene irradiance, realistic contact shadows, and unified depth of field.' : ''}

OUTPUT:
Return ONLY the final enhanced prompt in ${isArabic ? 'ARABIC' : 'ENGLISH'}. No intro, no conversational text, no quotation marks.`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 300,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error ${response.status}`);
      }

      const data = await response.json();
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (candidateText && candidateText.length > 10) {
        const sanitized = candidateText.replace(/^["'`]|["'`]$/g, '').trim();
        logger.log('[AutoPromptService] Successfully enhanced prompt via Gemini 1.5 Flash.');
        return {
          enhancedPrompt: sanitized,
          originalPrompt: cleanPrompt,
          detectedLanguage: lang,
          engine: 'gemini',
        };
      }

      throw new Error('Gemini returned an empty or invalid response');
    } catch (err) {
      logger.warn('[AutoPromptService] Gemini enhancement failed or timed out; falling back to offline engine:', err);
      return enhanceWithOfflineEngine(cleanPrompt, { ...options, language: lang });
    }
  }
}

export const autoPromptService = new AutoPromptService();
