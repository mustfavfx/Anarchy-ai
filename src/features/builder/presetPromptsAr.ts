/**
 * Preset Prompts Arabic Translation Dictionary
 * Contains professional Arabic translations for categories, labels, prompts, and notes.
 * Keys are plain string literals to prevent Vite/OXC parsing errors.
 */

export const PRESETS_TRANSLATIONS_AR: Record<string, string> = {
  // ─── Categories ────────────────────────────────────────────────────────────
  'Rendering & Realism': 'الرندرة والواقعية',
  'Interior Styles': 'أنماط التصميم الداخلي',
  'Lighting & Mood': 'الإضاءة والمزاج',
  'Sky & Atmosphere': 'السماء والغلاف الجوي',
  'Weather & Seasons': 'الطقس والفصول',
  'Landscape & Nature': 'المناظر الطبيعية والطبيعة',
  'People & Activity': 'الأشخاص والنشاط',
  'Camera & Composition': 'الكاميرا والتكوين',
  'Close-ups & Materials': 'لقطات مقربة ومواد',
  'Style & Aesthetics': 'الأسلوب والجماليات',
  'Technical & Presentation': 'التقديم والرسومات الفنية',

  // ─── Labels (Titles) ────────────────────────────────────────────────────────
  'Photorealistic': 'واقعي للغاية',
  'Enhance Realism': 'تحسين الواقعية',
  'Developer Finish': 'تشطيب المطور الأساسي',
  'Construction State': 'مرحلة العظم والبناء',
  'Match Style': 'مطابقة النمط',

  'Scandinavian Minimal': 'اسكندنافي بسيط',
  'Industrial Loft': 'لوفت صناعي',
  'Biophilic': 'حيوي / بيوفيليك',
  'Japandi': 'جاباندي الهجين',
  'Luxury Contemporary': 'معاصر فاخر',
  'Rustic Warm': 'ريفي دافئ',
  'Maximalist Art Deco': 'آرت ديكو جريء',

  'Night Scene': 'مشهد ليلي',
  'Night + LED Strips': 'ليلي مع إضاءة LED',
  'Day to Night': 'تحويل النهار إلى ليل',
  'Night to Day': 'تحويل الليل إلى نهار',
  'Golden Hour': 'الساعة الذهبية',
  'Brighten Scene': 'تفتيح المشهد',
  'Candlelight': 'إضاءة الشموع',

  'Dramatic Clouds': 'غيوم دراماتيكية',
  'Sunset Sky': 'سماء الغروب',
  'Starry Night Sky': 'سماء مرصعة بالنجوم',
  'Overcast Soft': 'غائم ناعم',
  'Volumetric Rays': 'أشعة شمس حجمية',

  'Rainy Day': 'يوم ممطر',
  'Autumn': 'الخريف',
  'Winter Snow': 'ثلوج الشتاء',
  'Fog': 'ضباب جوي',
  'Spring Blossom': 'زهور الربيع',

  'Add Flowers': 'إضافة زهور',
  'Lush Lawn': 'عشب كثيف',
  'Add Trees': 'إضافة أشجار',
  'Waterfront': 'واجهة مائية',
  'Desert Landscape': 'منظر صحراوي',

  'Add People': 'إضافة أشخاص',
  'Blurred Pedestrians': 'مشاة ضبابيون (حركة)',
  'Family at Home': 'عائلة في المنزل',
  'Add Cars': 'إضافة سيارات',
  'Moving Traffic': 'حركة مرور متحركة',
  'Birds in Sky': 'طيور في السماء',
  'Animal Detail': 'تفاصيل الحيوانات',

  'Drone View': 'لقطة طائرة درون',
  'Worm\'s Eye': 'منظور من الأسفل للأعلى',
  'Interior from Entrance': 'لقطة داخلية من المدخل',
  'Aerial 45°': 'لقطة جوية 45 درجة',
  'Right-Side View': 'منظور الجانب الأيمن',
  'Top-Down Plan': 'مسقط أفقي من الأعلى',
  'Close-up Detail': 'تفاصيل مقربة',

  'Material Macro': 'تصوير ماكرو للمواد',
  'Life Activity': 'أنشطة الحياة اليومية',
  'Texture Study': 'دراسة الملمس والنقش',

  'Cinematic Film': 'فيلم سينمائي',
  'Dezeen Editorial': 'مقال Dezeen التحريري',
  'Clay Render': 'رندرة طينية (أبيض مطفي)',
  'Pencil Sketch': 'رسم بقلم الرصاص',
  'Watercolour': 'ألوان مائية',

  'Material Moodboard': 'لوحة مزاج المواد',
  'Editorial Board': 'لوحة تقديم تحريرية',
  'Technical Drawings': 'رسومات فنية معمارية',
  '3D Section Cut': 'قطاع ثلاثي الأبعاد',
  'Scale Model': 'مجسم مصغر (ماكيت)',
  'Urban Context Map': 'خريطة السياق العمراني',

  // ─── Preset Texts (Descriptions) ───────────────────────────────────────────
  'Create a photorealistic image with accurate lighting, natural cast shadows, high-resolution surface textures, realistic reflections, and professional architectural photography quality.':
    'أنشئ صورة واقعية للغاية مع إضاءة دقيقة، وظلال طبيعية، وأنسجة أسطح عالية الدقة، وانعكاسات واقعية، وجودة تصوير معماري احترافي.',

  'Make this render photorealistic: add realistic cast shadows and ambient occlusion, high-contrast directional light, enhance surface textures with fine grain and natural imperfections, add subtle depth of field, professional color grading.':
    'اجعل هذه الرندرة واقعية للغاية: أضف ظلالاً واقعية وتظليلاً محيطاً (ambient occlusion)، وإضاءة اتجاهية عالية التباين، وحسّن أنسجة الأسطح بحبيبات دقيقة وعيوب طبيعية، وأضف عمق مجال خفيف، وتدريج ألوان احترافي.',

  'Transform into a shell-and-core developer handover condition. Keep the original geometry, layout, and camera angle unchanged. Apply smooth painted white walls, finished screeded floors, clean plastered ceilings, installed windows and doors. No furniture. Empty, clean, ready for fit-out.':
    'حوّل المساحة إلى حالة تسليم المطور (طوب أحمر ومحارة). حافظ على الهندسة الأصلية والتخطيط وزاوية الكاميرا دون تغيير. ضع جدراناً بيضاء ناعمة مطلية، وأرضيات أسمنتية منتهية، وأسقفاً مجصصة نظيفة، ونوافذ وأبواباً مركبة. بدون أثاث. فارغة ونظيفة وجاهزة للتشطيب النهائي.',

  'Transform the scene into a realistic unfinished construction state. Expose raw concrete, blockwork, and structural surfaces. Show unpainted walls, visible reinforcement edges, dust, and natural building imperfections. Maintain the original architecture and camera position.':
    'حوّل المشهد إلى حالة بناء غير مكتملة بشكل واقعي. كشف الخرسانة الخام، وأعمال البلوك، والأسطح الإنشائية. أظهر جدراناً غير مطلية، وحواف حديد التسليح المرئية، والغبار، وعيوب البناء الطبيعية. حافظ على العمارة الأصلية وموقع الكاميرا.',

  'Match the visual style of the reference image exactly — replicate its rendering technique, color grading, texture quality, lighting approach, and overall aesthetic while keeping the architectural content unchanged.':
    'طابق النمط البصري للصورة المرجعية تماماً — كرر تقنية الرندرة، وتدريج الألوان، وجودة الملمس، وأسلوب الإضاءة، والجمالية العامة مع الحفاظ على المحتوى المعماري دون تغيير.',

  'Transform into Scandinavian minimalist interior — white and light grey walls, natural white-oak flooring, linen and bouclé textiles, simple functional furniture with tapered legs, large windows flooding the space with diffused daylight, a few indoor plants in terracotta pots, hygge warmth, clean lines, photorealistic quality.':
    'تحويل إلى تصميم داخلي اسكندنافي بسيط — جدران بيضاء ورمادية فاتحة، أرضيات من خشب البلوط الأبيض الطبيعي، أقمشة من الكتان والبوكليه، أثاث بسيط وعملي بأرجل مستدقة، نوافذ ضخمة تغمر المساحة بضوء النهار المنتشر، نباتات داخلية قليلة في أواني فخارية، دفء وهدوء وخطوط نظيفة، جودة واقعية.',

  'Convert to industrial loft aesthetic — exposed polished concrete ceiling, visible dark steel beams, weathered brick accent wall, Edison bulb pendant clusters, blackened metal window frames, distressed reclaimed wood surfaces, raw urban atmosphere, moody dramatic lighting, photorealistic.':
    'تحويل إلى جمالية لوفت صناعي — سقف خرساني مصقول مكشوف، عوارض فولاذية داكنة مرئية، جدار طوب أحمر قديم، مصابيح إديسون متدلية، إطارات نوافذ معدنية سوداء، أسطح خشبية معتقة، جو حضري خام، إضاءة دراماتيكية مزاجية، واقعي للغاية.',

  'Apply biophilic design — integrate large tropical plants throughout (monstera, fiddle-leaf fig, trailing pothos), a full living moss accent wall, natural travertine stone surfaces, exposed timber ceiling beams, diffused natural light filtered through vegetation, organic curved forms, earthy palette of terracotta, sage and warm white, photorealistic.':
    'تطبيق التصميم الحيوي (بيوفيليك) — دمج نباتات استوائية ضخمة في جميع أنحاء المساحة (مونستيرا، تين مجفف، بوتس متدلي)، جدار مميز مغطى بالطحالب الحية الطبيعية، أسطح حجر الترافرتين الطبيعي، عوارض خشبية مكشوفة في السقف، ضوء طبيعي منتشر تمت تصفيته عبر النباتات، أشكال منحنية عضوية، لوحة ألوان ترابية من التراكوتا والمريمية والأبيض الدافئ، واقعي.',

  'Japandi fusion — wabi-sabi imperfect beauty, natural linen and warm ash-wood tones, minimalist furniture with organic rounded shapes, shoji-inspired diffused light, handmade ceramic and rattan accents, serene neutral palette of ivory, warm grey and muted sage, decluttered negative space, zen atmosphere, photorealistic.':
    'تصميم جاباندي الهجين — جمال وبساطة الـ (وابي-سابي) غير المكتمل، كتان طبيعي ودرجات خشب الرماد الدافئ، أثاث بسيط بأشكال مستديرة عضوية، إضاءة منتشرة مستوحاة من الشوجي الياباني، لمسات من السيراميك المصنوع يدوياً والقش، لوحة ألوان هادئة ومحايدة من العاج والرمادي الدافئ والمريمية الباهتة، مساحات مفتوحة وخالية من الفوضى، جو زن، واقعي للغاية.',

  'Luxury contemporary interior — Italian marble floors with book-matched slabs, floor-to-ceiling fluted plaster walls, indirect cove lighting with warm CCT, bespoke furniture in rich bouclé and velvet, brushed brass and smoked glass accents, curated art and sculptural objects, five-star hospitality atmosphere, photorealistic.':
    'تصميم داخلي معاصر فاخر — أرضيات رخامية إيطالية متطابقة، جدران مغطاة بالجبس المضلع من الأرض إلى السقف، إضاءة مخفية دافئة، أثاث مخصص من أقمشة البوكليه والمخمل الغنية، لمسات من النحاس المصنوع يدوياً والزجاج المدخن، لوحات فنية ومنحوتات مختارة بعناية، جو ضيافة خمس نجوم، واقعي.',

  'Warm rustic interior — exposed hand-hewn timber ceiling beams, rough stone feature wall with open fireplace, wide-plank reclaimed oak flooring, leather and wool upholstery in cognac and forest green, antique brass fittings, candle and firelight warmth, cosy countryside atmosphere, photorealistic.':
    'تصميم داخلي ريفي دافئ — عوارض خشبية مكشوفة منحوتة يدوياً في السقف، جدار حجري خشن مع مدفأة مفتوحة، أرضيات من خشب البلوط القديم عريض الألواح، تنجيد من الجلد والصوف بألوان الكوُنياك والأخضر الغابي، تركيبات نحاسية عتيقة، دفء الشموع ونار المدفأة، جو ريفي دافئ، واقعي.',

  'Maximalist Art Deco interior — rich jewel tones of emerald, sapphire and gold, bold geometric wall panelling with brass inlays, dramatic arched openings, opulent pendant chandeliers, patterned marble floors, velvet upholstery, glamorous theatrical atmosphere, photorealistic.':
    'تصميم داخلي آرت ديكو جريء — ألوان جوهرية غنية من الزمرد والياقوت والذهبي، ألواح جدران هندسية جريئة مع لمسات نحاسية، فتحات مقوسة دراماتيكية، ثريات متدلية فاخرة، أرضيات رخامية منقوشة، تنجيد مخملي، جو مسرحي ساحر، واقعي.',

  'Convert daytime to a moody night shot. Bright moon as primary light source from the window direction (moon not visible in frame), soft rim light outlining objects. Warm interior lights contrasting with cool moonlight. Subtle atmospheric haze for a cinematic feel. Realistic shadows, natural night white balance, high quality.':
    'تحويل المشهد النهاري إلى لقطة ليلية مزاجية. القمر الساطع كمصدر رئيسي للضوء من اتجاه النافذة (القمر غير مرئي في الكادر)، ضوء خفيف يحدد حواف الأجسام. أضواء داخلية دافئة تتناقض مع ضوء القمر البارد. ضباب خفيف لأجواء سينمائية. ظلال واقعية، توازن طبيعي للون الأبيض ليلاً، جودة عالية.',

  'Change day to night. Add LED strips running along architectural edges and recesses. Turn all interior lights on at warm 2700 K. Create a cosy inviting glow with realistic light falloff and warm reflections on all surfaces.':
    'تغيير النهار إلى ليل. أضف أشرطة LED تمتد على طول الحواف والفتحات المعمارية. قم بتشغيل جميع الأضواء الداخلية بوهج دافئ عند 2700 كلفن. اخلق توهجاً دافئاً ومرحباً مع سقوط ضوء واقعي وانعكاسات دافئة على جميع الأسطح.',

  'Convert the daytime scene to night. Keep all interior and exterior artificial lights on — warm interior glow contrasting with a deep blue-black sky. Realistic night atmosphere, correct light falloff, high-quality photorealistic result.':
    'تحويل مشهد النهار إلى ليل. حافظ على تشغيل جميع الأضواء الاصطناعية الداخلية والخارجية — توهج داخلي دافئ يتناقض مع سماء زرقاء داكنة تقارب السواد. جو ليلي واقعي، توزيع ضوء صحيح، نتيجة واقعية للغاية وعالية الجودة.',

  'Change night to bright natural daylight. Clear blue sky with sunlight streaming through windows, soft natural shadows, daylight white balance (5500 K), bright and airy atmosphere, photorealistic.':
    'تغيير الليل إلى ضوء نهار طبيعي مشرق. سماء زرقاء صافية مع تدفق أشعة الشمس عبر النوافذ، وظلال طبيعية ناعمة، وتوازن اللون الأبيض لضوء النهار (5500 كلفن)، وأجواء مشرقة ومبهجة، واقعي للغاية.',

  'Golden hour mood — low warm sun rays at 10–15 degrees angle, rich amber and honey tones, long dramatic shadows stretching across the scene, magical warm atmosphere, subtle anamorphic lens flare, photorealistic.':
    'أجواء الساعة الذهبية — أشعة شمس دافئة منخفضة بزاوية 10-15 درجة، درجات غنية من اللون الكهرماني والعسلي، ظلال دراماتيكية طويلة تمتد عبر المشهد، أجواء دافئة ساحرة، توهج عدسة خفيف، واقعي للغاية.',

  'Increase overall ambient light naturally, soften harsh shadows, improve exposure while maintaining realistic lighting balance and color accuracy.':
    'زيادة الإضاءة المحيطة الإجمالية بشكل طبيعي، وتنعيم الظلال القاسية، وتحسين التعرض للضوء مع الحفاظ على توازن الإضاءة الواقعي ودقة الألوان.',

  'Intimate candlelight atmosphere — multiple candles with realistic flame glow, warm amber pools of light, deep dramatic shadows beyond the lit areas, romantic moody atmosphere, photorealistic flame and wax detail.':
    'أجواء دافئة بضوء الشموع — شموع متعددة مع توهج لهب واقعي، بقع ضوئية كهرمانية دافئة، ظلال دراماتيكية عميقة خارج المناطق المضاءة، أجواء رومانسية مزاجية، تفاصيل واقعية للهب والشمع.',

  'Replace sky with dramatic storm clouds — dark cumulonimbus formations, rays of golden light breaking through gaps, high contrast moody atmosphere, cinematic composition, photorealistic cloud detail and lighting.':
    'استبدل السماء بسحب عاصفة دراماتيكية — تشكيلات غيوم ركامية داكنة، أشعة من الضوء الذهبي تخترق الفجوات، جو مزاجي عالي التباين، تكوين سينمائي، تفاصيل سحاب وإضاءة واقعية.',

  'Replace sky with a spectacular sunset — vibrant gradient from deep orange through magenta to violet, scattered clouds catching warm light, golden reflections across all surfaces, cinematic atmosphere, photorealistic.':
    'استبدل السماء بغروب شمس مذهل — تدريج نابض بالحياة من البرتقالي العميق والأرجواني إلى البنفسجي، سحب متناثرة تلتقط الضوء الدافئ، انعكاسات ذهبية عبر جميع الأسطح، جو سينمائي، واقعي.',

  'Clear night sky with visible stars and faint Milky Way arc, full-moon atmosphere, warm interior lights casting glow, deep blue-to-black sky gradient, photorealistic star field, long-exposure photography aesthetic.':
    'سماء ليلية صافية مع نجوم مرئية وقوس مجرة درب التبانة الخافت، أجواء البدر، أضواء داخلية دافئة تلقي بوهجها، تدريج سماء من الأزرق الداكن إلى الأسود، حقل نجوم واقعي، جمالية تصوير فوتوغرافي بالتعريض الطويل.',

  'Replace sky with uniform soft overcast — high white cloud layer acting as a giant softbox, perfectly diffused shadowless light, muted cool palette, photorealistic studio-quality exterior lighting.':
    'استبدل السماء بغيوم ناعمة موحدة — طبقة سحاب بيضاء عالية تعمل كصندوق إضاءة عملاق (softbox)، إضاءة مثالية خالية من الظلال، لوحة ألوان باردة وهادئة، إضاءة خارجية واقعية بجودة الاستوديو.',

  'Add volumetric god rays cutting through trees and structures, atmospheric haze enhancing depth, dramatic light beams with realistic dust particles, cinematic light-scattering effect, photorealistic.':
    'أضف أشعة شمس حجمية تخترق الأشجار والمباني، ضباب جوي يعزز العمق، حزم ضوئية دراماتيكية مع جزيئات غبار واقعية، تأثير انتشار ضوئي سينمائي، واقعي للغاية.',

  'Overcast rainy day — soft diffused light, wet reflective surfaces, realistic rain streaks on glass, puddles with ripples on ground, subtle water reflections, moody muted atmosphere, photorealistic.':
    'يوم غائم وممطر — ضوء خافت منتشر، أسطح مبللة عاكسة، خيوط مطر واقعية على الزجاج، برك ماء مع تموجات على الأرض، انعكاسات مائية خفيفة، جو مزاجي هادئ، واقعي.',

  'Ultra-realistic autumn scene — overcast sky, soft diffused light, light mist, wet ground with subtle reflections, deep warm browns and muted oranges mixed with cool grey shadows, fallen leaves scattered naturally, damp textures, cinematic mood, 8K photorealistic.':
    'مشهد خريفي واقعي للغاية — سماء غائمة، ضوء منتشر ناعم، ضباب خفيف، أرض رطبة مع انعكاسات خفيفة، درجات بني دافئة وبرتقالي باهت مختلق مع ظلال رمادية باردة، أوراق شجر متساقطة متناثرة بشكل طبيعي، ملامح رطبة، جو سينمائي، واقعية 8K.',

  'Blanket of snow on roofs, ground, and landscape, frost on window edges, overcast winter sky, cold blue-white palette, icicles on architectural edges, photorealistic winter atmosphere.':
    'شتاء واقعي — غطاء من الثلج على الأسطح والأرض والمناظر الطبيعية، صقيع على حواف النوافذ، سماء شتوية غائمة، لوحة ألوان بيضاء وباردة، قشور جليدية على الحواف المعمارية، جو شتوي واقعي.',

  'Add realistic atmospheric fog — soft diffusion of distant elements, gradual depth-fog reducing far visibility, mysterious mood, subtle light scattering, photorealistic volumetric haze.':
    'أضف ضباباً جوياً واقعياً — انتشار ناعم للعناصر البعيدة، ضباب عميق يقلل من الرؤية البعيدة تدريجياً، جو غامض، انتشار ضوئي خفيف، ضباب حجمي واقعي.',

  'Spring atmosphere — cherry or almond blossom trees in full flower, soft pink and white petals drifting in a gentle breeze, fresh green grass, bright morning light, optimistic warm palette, photorealistic.':
    'أجواء الربيع — أشجار الكرز أو اللوز المزهرة بالكامل، بتلات وردية وبيضاء ناعمة تنجرف مع نسيم لطيف، عشب أخضر نضر، ضوء صباح مشرق، لوحة ألوان دافئة متفائلة، واقعي.',

  'Add realistic flowers and flowering plants — garden beds, potted arrangements, climbing vines. Natural colour palette, realistic petals and leaves, appropriate scale, soft natural lighting, photorealistic.':
    'إضافة زهور ونباتات مزهرة واقعية — أحواض حدائق، تنسيقات في أواني، نباتات متسلقة. لوحة ألوان طبيعية، بتلات وأوراق واقعية، حجم مناسب، إضاءة طبيعية ناعمة، واقعي.',

  'Add lush realistic grass and ground cover, natural variation in height and colour, wildflowers mixed in, realistic soil edges at transitions, photorealistic lawn textures.':
    'أضف عشباً واقعياً كثيفاً وغطاء أرضياً، وتنوعاً طبيعياً في الارتفاع واللون، وزهوراً برية مختلطة، وحواف تربة واقعية عند الانتقالات، وأنسجة عشبية واقعية.',

  'Add mature realistic trees appropriate to the climate, natural canopy shapes, detailed bark and leaf textures, realistic dappled shadows cast on ground and building, photorealistic foliage.':
    'أضف أشجاراً ناضجة وواقعية مناسبة للمناخ، وأشكال مظلات طبيعية، وأنسجة لحاء وأوراق مفصلة، وظلال مرقطة واقعية تُلقى على الأرض والمبنى، وأوراق شجر واقعية.',

  'Place the building beside a calm body of water — lake, river, or harbour. Add realistic water surface with gentle ripples, reflections of the building and sky, waterfront vegetation, boats if appropriate, photorealistic.':
    'ضع المبنى بجوار مسطح مائي هادئ — بحيرة أو نهر أو مرفأ. أضف سطح ماء واقعي بتموجات لطيفة، وانعكاسات للمبنى والسماء، ونباتات على الواجهة المائية، وقوارب إذا كان ذلك مناسباً، واقعي.',

  'Surround with an arid desert landscape — warm sandy terrain, scattered cacti and drought-tolerant plants, terracotta rock formations, intense directional sunlight casting strong shadows, clear deep-blue sky, photorealistic.':
    'أحط المبنى بمنظر طبيعي صحراوي جاف — تضاريس رملية دافئة، ونباتات صبار ونباتات مقاومة للجفاف متناثرة، وتشكيلات صخرية من التراكوتا، وضوء شمس اتجاهي مكثف يلقي ظلالاً قوية، وسماء زرقاء صافية عميقة، واقعي.',

  'Add photorealistic people naturally inhabiting the space — walking, sitting, conversing. Diverse group, contemporary casual clothing, natural relaxed poses, correct scale and perspective, realistic shadows matching the scene lighting.':
    'أضف أشخاصاً واقعيين يسكنون المساحة بشكل طبيعي — يمشون، يجلسون، يتحادثون. مجموعة متنوعة، ملابس كاجوال معاصرة، وضعيات مريحة طبيعية، مقياس ومنظور صحيح، ظلال واقعية تطابق إضاءة المشهد.',

  'Add blurred pedestrians in motion, long-exposure motion-blur effect, ghostly silhouettes suggesting urban life and activity, realistic movement trails, architectural photography style.':
    'أضف مشاة مشوشين أثناء الحركة، تأثير ضبابية الحركة بالتعريض الطويل، ظلال خفيفة توحي بالحياة والنشاط الحضري، مسارات حركة واقعية، أسلوب التصوير المعماري.',

  'Photorealistic family scene — adults and children naturally interacting with the interior space, reading, cooking, relaxing. Warm lifestyle photography feel, natural indoor lighting, correct scale.':
    'مشهد عائلي واقعي للغاية — كبار وأطفال يتفاعلون بشكل طبيعي مع المساحة الداخلية، يقرأون، يطبخون، يسترخون. إحساس تصوير دافئ لأسلوب الحياة، إضاءة داخلية طبيعية، مقياس صحيح.',

  'Add photorealistic parked cars at correct scale and perspective, realistic paint reflections, natural ground shadows, modern vehicle models appropriate to the context.':
    'أضف سيارات واقعية متوقفة بمقياس ومنظور صحيحين، وانعكاسات طلاء واقعية، وظلال أرضية طبيعية، وموديلات سيارات حديثة مناسبة للسياق.',

  'Add blurred cars in motion, long-exposure light trails from headlights and tail-lights, dynamic movement suggesting urban activity, photorealistic.':
    'أضف سيارات متحركة مشوشة، مسارات ضوئية بالتعريض الطويل من المصابيح الأمامية والخلفية، حركة ديناميكية توحي بالنشاط الحضري، واقعي للغاية.',

  'Add birds flying naturally in the sky, scattered in a realistic flock pattern at various distances for depth, natural flight silhouettes, photorealistic.':
    'أضف طيوراً تحلق بشكل طبيعي في السماء، متناثرة في نمط سرب واقعي على مسافات مختلفة لخلق عمق، ظلال طيران طبيعية، واقعي.',

  'Cinematic close-up of a domestic animal (cat or dog) naturally resting or moving through the space, shallow depth of field, warm lighting, photorealistic fur detail.':
    'لقطة مقربة سينمائية لحيوان أليف (قطة أو كلب) يستريح أو يتحرك بشكل طبيعي في المساحة، عمق مجال ضئيل، إضاءة دافئة، تفاصيل فراء واقعية.',

  'Move the camera to a high drone viewpoint above the scene, revealing a wide surrounding environment. Keep the main object clearly visible. Bird\'s-eye perspective, wide context, maintain original frame proportions.':
    'انقل الكاميرا إلى نقطة رؤية عالية لطائرة درون فوق المشهد، لتكشف عن بيئة محيطة واسعة. حافظ على وضوح رؤية المجسم الرئيسي. منظور عين الطائر، سياق واسع، الحفاظ على نسب الإطار الأصلي.',

  'Dramatic low-angle camera looking upward — emphasise the height and mass of the structure, converging vertical lines, wide sky above, photorealistic.':
    'كاميرا بزاوية منخفضة دراماتيكية تنظر للأعلى — تؤكد على ارتفاع وكتلة الهيكل، خطوط عمودية متقاربة، سماء واسعة في الأعلى، واقعي.',

  'Camera standing at the entrance threshold looking into the space — reveal the full depth of the interior, correct one-point perspective, natural lighting from within, photorealistic.':
    'كاميرا تقف عند عتبة المدخل وتنظر إلى المساحة — تكشف عن العمق الكامل للتصميم الداخلي، منظور نقطة واحدة صحيح، إضاءة طبيعية من الداخل، واقعي.',

  'Drone at a 45-degree oblique angle — balanced between plan and elevation, revealing rooftop and two façades simultaneously, wide contextual surroundings, photorealistic.':
    'درون بزاوية مائلة 45 درجة — متوازنة بين المسقط الأفقي والواجهة، تكشف عن السطح وواجهتين في وقت واحد، محيط سياقي واسع، واقعي.',

  'Move camera fully to the right side — show the object from a right-side perspective with accurate vanishing points and realistic proportions.':
    'انقل الكاميرا بالكامل إلى الجانب الأيمن — أظهر المجسم من منظور الجانب الأيمن مع نقاط تلاشي دقيقة ونسب واقعية.',

  'Directly overhead plan view — all elements visible from directly above, correct proportions and spatial relationships, clean overhead composition.':
    'مسقط أفقي مباشر من الأعلى لأسفل — جميع العناصر مرئية من الأعلى مباشرة، نسب وعلاقات مكانية صحيحة، تكوين علوي نظيف.',

  'Beautiful macro close-up of one architectural detail — shallow depth of field blurring surroundings, fine material detail in sharp focus, bokeh highlights, a few small decorative objects for scale, cinematic quality.':
    'لقطة مقربة جميلة لتفصيل معماري واحد — عمق مجال ضئيل يشوش المحيط، تفاصيل مواد دقيقة في تركيز حاد، إضاءة بوكيه مميزة، بضع قطع ديكور صغيرة للمقياس، جودة سينمائية.',

  'Extreme macro of a material surface from the scene — revealing fine texture, realistic imperfections and grain, surrounding objects softly visible in background, cinematic macro photography with shallow depth of field, 8K detail.':
    'تصوير ماكرو فائق لملمس مادة من المشهد — يكشف عن الملمس الدقيق والعيوب الطبيعية والحبيبات، الأجسام المحيطة مرئية بنعومة في الخلفية، تصوير ماكرو سينمائي بعمق مجال ضئيل، تفاصيل 8K.',

  'Close-up of everyday activity within the environment — natural human interaction with the space, cinematic depth of field, warm natural lighting, lifestyle photography aesthetic, photorealistic.':
    'لقطة مقربة للنشاط اليومي داخل البيئة — تفاعل بشري طبيعي مع المساحة، عمق مجال سينمائي، إضاءة طبيعية دافئة، جمالية تصوير أسلوب الحياة، واقعي.',

  'Flat-lay or angled close-up study of a single material — stone, wood, fabric, or metal — isolated against a neutral background, perfect studio lighting showing every surface detail, 8K photorealistic.':
    'دراسة مسطحة أو بزاوية مقربة لمادة واحدة — حجر، خشب، قماش، أو معدن — معزولة على خلفية محايدة، إضاءة استوديو مثالية تظهر كل تفاصيل السطح، واقعية 8K.',

  'Ultra-cinematic architectural photography — anamorphic lens characteristics, atmospheric depth, subtle film grain, moody contrast, realistic exposure rolloff, award-winning ArchDaily visual quality.':
    'تصوير معماري سينمائي للغاية — خصائص عدسة أنامورفيك، عمق جوي، حبيبات فيلم خفيفة، تتباين مزاجي، تلاشي تعريض واقعي، جودة بصرية تضاهي مجلة ArchDaily الشهيرة.',

  'Professional architectural editorial photography — Dezeen magazine aesthetic, carefully balanced composition, realistic environmental context, premium storytelling quality.':
    'تصوير تحريري معماري احترافي — جمالية مجلة Dezeen، تكوين متوازن بعناية، سياق بيئي واقعي، جودة سرد بصري ممتازة.',

  'Monochromatic clay render study — white matte material override on all surfaces, soft diffused studio lighting, no colour or texture, pure architectural form, concept-level visualisation.':
    'رندرة طينية أحادية اللون — مادة بيضاء غير لامعة تغطي جميع الأسطح، إضاءة استوديو منتشرة ناعمة، بدون لون أو ملمس، شكل معماري نقي، تصور بمستوى مفهوم التصميم.',

  'Convert to architectural pencil sketch — confident varied linework, cross-hatching for shadow areas, varying line weights for depth, professional hand-drawn quality, white paper background.':
    'تحويل إلى رسم معماري بقلم الرصاص — خطوط واثقة ومتنوعة، تظليل متقاطع لمناطق الظلال، سماكات خطوط متفاوتة للعمق، جودة رسم يدوي احترافية، خلفية ورقية بيضاء.',

  'Convert to architectural watercolour illustration — soft washes of colour, wet-on-wet blending, visible paper texture, loose expressive linework, warm pastel palette, artistic presentation quality.':
    'تحويل إلى رسم معماري مائي — ألوان مائية ناعمة، دمج رطب على رطب، ملمس ورق مرئي، خطوط معبرة وحرة، لوحة ألوان دافئة، جودة عرض فنية.',

  'Create a high-end interior material moodboard using only the materials present in the 3D scene. Arrange samples in an artistic layered composition similar to luxury architectural boards — stone, wood, fabric, metal, and colour swatches as physical tiles and samples. Soft studio lighting, refined neutral background, premium photorealistic aesthetic.':
    'لوحة مزاج للمواد المعمارية الفاخرة باستخدام المواد الموجودة في المشهد ثلاثي الأبعاد فقط. ترتيب العينات في تكوين فني متعدد الطبقات مشابه للوحات المعمارية الفاخرة — عينات من الحجر والخشب والقماش والمعدن والطلاء كبلاطات طبيعية. إضاءة استوديو ناعمة، خلفية محايدة، جمالية واقعية فاخرة.',

  'High-end editorial presentation board — do not redesign the project, only present it. Include: one large dominant axonometric cut-away view as focal point, a front elevation with subtle dimensions, a secondary elevation highlighting materials, curated material swatches, minimal elegant annotations, clear visual hierarchy. Modern editorial layout, Behance premium style, minimal Scandinavian mood, soft beige and warm wood palette.':
    'لوحة تقديم تحريرية راقية — لا تقم بإعادة تصميم المشروع، فقط قم بتقديمه. تشمل: لقطة قطاع أكسونومتري كبيرة كعنصر تركيز أساسي، واجهة أمامية مع أبعاد خفيفة، واجهة ثانوية توضح المواد، عينات مواد منسقة، شروح توضيحية بسيطة وأنيقة، تسلسل هرمي بصري واضح. تخطيط تحريري حديث، أسلوب Behance الراقي، مزاج اسكندنافي بسيط، لوحة ألوان بيج دافئة وخشبية.',

  'Clean technical architectural drawings — precise linework, proper line weights, dimension annotations, section markers, material hatching, professional drafting aesthetic, white background, CAD-quality presentation.':
    'رسومات فنية معمارية نظيفة — خطوط دقيقة، سماكات خطوط صحيحة، شروح الأبعاد، علامات القطاعات، تهشير المواد، جمالية صياغة احترافية، خلفية بيضاء، جودة تقديم CAD.',

  'Axonometric 3D cross-section — top ¾ view, clean cut plane revealing interior spaces and structure, contrasting cut surface with visible interior, professional architectural section perspective.':
    'قطاع ثلاثي أبعاد أكسونومتري — رؤية علوية بزاوية 3/4، مستوى قطع نظيف يكشف عن المساحات الداخلية والهيكل، سطح قطع متباين مع داخل مرئي، منظور قطاع معماري احترافي.',

  'Close-up of a precise architectural scale model — axonometric view, depth of field bokeh, white foam-board and laser-cut acrylic, miniature windows and structural detail, placed on a presentation table, soft studio lighting.':
    'لقطة مقربة لمجسم مصغر (ماكيت) معماري دقيق — منظور أكسونومتري، تأثير بوكيه لعمق المجال، لوح فوم أبيض وأكريليك مقطوع بالليزر، تفاصيل هيكلية ونوافذ مصغرة، موضوع على طاولة تقديم، إضاءة استوديو ناعمة.',

  'Aerial site-analysis view — add surrounding city blocks, streets, green spaces, and urban fabric around the project. Clearly distinguish the subject building with contrast or colour. Professional urban-planning presentation quality.':
    'عرض تحليل الموقع الجغرافي جوياً — أضف الكتل العمرانية المحيطة والشوارع والمساحات الخضراء والنسيج العمراني حول المشروع. ميز مبنى المشروع بوضوح باستخدام التباين أو اللون. تقديم تخطيط عمراني احترافي الجودة.',

  // ─── Notes ─────────────────────────────────────────────────────────────────
  'Attach a reference render in the second input slot.': 'أرفق رندرة مرجعية في خانة الإدخال الثانية.',
  'Warning: Needs a reference image but none is uploaded!': 'تحذير: يحتاج صورة مرجعية ولكن لم يتم رفع أي صورة!',
  'Requires reference image': 'يتطلب صورة مرجعية',
  'Advanced': 'متقدم',
  'Preset Prompts': 'البرومتات الجاهزة',

  // ─── Video Prompts — Categories ────────────────────────────────────────────
  'Interior Camera Movements': 'حركات كاميرا داخلية',
  'Exterior Camera Movements': 'حركات كاميرا خارجية',

  // ─── Architecture Effects — Labels ─────────────────────────────────────────
  'Sketch to Render': 'من الرسم إلى الرندرة',
  'Blueprint to Reality': 'من المخططات إلى الواقع',
  'Massing to Masterpiece': 'من المجسم إلى تحفة معمارية',
  'Materialization Effect': 'تأثير المواد التدريجي',
  'Design Evolution': 'تطور مراحل التصميم',
  'Facade Build-Up': 'بناء الواجهة تدريجياً',
  'Floor-by-Floor Construction': 'البناء طابق بطابق',
  'Structural X-Ray': 'رؤية هيكل المبنى بالأشعة',
  'Exploded Axonometric': 'مجسم أكسونومتري منفجر',
  'Section Cut Animation': 'حركة القطع المقطعي',
  'Furniture Auto Assembly': 'تجميع الأثاث التلقائي',
  'Landscape Growth': 'نمو تدريجي للمناظر الطبيعية',
  'Lights Turning On': 'إضاءة تدريجية',
  'Glass Reflection Sweep': 'انعكاسات الزجاج المتحركة',
  'Seasonal Transformation': 'التحول عبر الفصول',
  'Interior to Exterior Transition': 'الانتقال من الداخل للخارج',
  'Exterior to Interior Transition': 'الانتقال من الخارج للداخل',
  'Day to Night Transition': 'انتقال النهار إلى الليل',
  'Rain Cleanup': 'تنظيف المطر للمبنى',

  // ─── Interior Camera — Labels ───────────────────────────────────────────────
  'Smooth Walkthrough': 'جولة سلسة',
  'Slow Push Forward': 'تقدم سينمائي بطيء',
  'Pull Back Reveal': 'كشف بالتراجع',
  'Orbit Around': 'دوران حول النقطة المحورية',
  'Enter Room': 'دخول الغرفة',
  'Corner Reveal': 'كشف من الزاوية',
  'Hallway Walk': 'مشي في الممر',
  'Ceiling Reveal': 'كشف السقف',
  'Floor Detail Close-Up': 'لقطة مقربة للأرضية',
  'Material Close-Up': 'لقطة مقربة للمواد',
  'Furniture Focus': 'تركيز على الأثاث',
  'Window Reveal': 'كشف النافذة',
  'Lighting Showcase': 'عرض الإضاءة',
  'Natural Light Sweep': 'انسياب الضوء الطبيعي',
  'Depth of Field': 'عمق المجال السينمائي',
  'Luxury Hotel Feel': 'أجواء فندق فاخر',
  'Interior Timelapse': 'فاصل زمني داخلي',
  'Floating Camera': 'كاميرا عائمة',

  // ─── Exterior Camera — Labels ───────────────────────────────────────────────
  'Drone Rise': 'صعود الطائرة',
  'Drone Descend': 'هبوط الطائرة',
  'Drone Orbit': 'مدار جوي',
  'Hero Shot': 'لقطة بطولية معمارية',
  'Front Facade Reveal': 'كشف الواجهة الأمامية',
  'Side Elevation Walk': 'مشي محاذي للواجهة الجانبية',
  'Low Angle Drama': 'زاوية منخفضة درامية',
  'High Angle Overview': 'نظرة عامة من الأعلى',
  'Street Level Approach': 'اقتراب بمستوى الشارع',
  'Pedestrian Arrival': 'وصول المشاة',
  'Fly Through Outdoor': 'التحليق عبر الفضاء الخارجي',
  'Landscape Reveal': 'كشف المناظر الطبيعية',
  'Pool Reflection': 'انعكاس المسبح',
  'Zoom In': 'تكبير سينمائي',
  'Zoom Out': 'تصغير سينمائي',
  'Sunset Reveal': 'كشف الغروب الذهبي',
  'Night Reveal': 'كشف الإضاءة الليلية الفاخرة',
  'Rain Atmosphere': 'أجواء المطر السينمائية',

  // ─── Video Prompts — Full Texts ────────────────────────────────────────────
  'Time-lapse architectural construction progressing from foundation to completed luxury building, cranes, workers, structure assembly, facade installation, landscape completion, cinematic aerial view.':
    'فاصل زمني لبناء معماري يتطور من الأساس حتى اكتمال المبنى الفاخر، رافعات، عمال، تجميع الهيكل، تركيب الواجهة، اكتمال المناظر الطبيعية، منظور جوي سينمائي.',

  'Transform the white architectural massing model into a fully detailed photorealistic architectural visualization with premium materials, landscaping, reflections, lighting and cinematic atmosphere.':
    'حوّل مجسم الكتلة المعمارية البيضاء إلى تصور معماري فوتوواقعي مفصل بالكامل مع مواد فاخرة، تنسيق حدائق، انعكاسات، إضاءة وأجواء سينمائية.',

  'Transform from bright daylight into cinematic blue hour and finally luxury night lighting, preserving architecture, realistic sun movement, dynamic sky, smooth transition, premium visualization.':
    'انتقال من ضوء النهار الساطع إلى الساعة الزرقاء السينمائية وأخيرًا إضاءة ليلية فاخرة، مع الحفاظ على المعمارية وحركة الشمس الواقعية والسماء الديناميكية والانتقال السلس.',

  'Transform the architectural sketch into a fully realistic building with smooth morphing transition, preserving composition and proportions, cinematic reveal, premium materials appearing gradually, realistic lighting evolution, ultra realistic architecture.':
    'حوّل الرسم المعماري إلى مبنى واقعي بالكامل مع انتقال تحوّل سلس، مع الحفاظ على التكوين والنسب، كشف سينمائي، مواد فاخرة تظهر تدريجياً، تطور إضاءة واقعي، عمارة فائقة الواقعية.',

  'Smooth cinematic walkthrough': 'جولة مشي سينمائية سلسة',
  'Slow cinematic push forward': 'تقدم سينمائي بطيء للأمام',
  'Slow cinematic pull back': 'تراجع سينمائي بطيء للخلف',
  'Slow orbit around the focal point': 'دوران بطيء حول النقطة المحورية',
  'Reveal the space by moving smoothly around the corner': 'كشف الفضاء بالتحرك بسلاسة حول الزاوية',
  'Walk naturally through the corridor': 'المشي بشكل طبيعي عبر الممر',
  'Smoothly enter the room through the doorway': 'الدخول بسلاسة إلى الغرفة عبر المدخل',
  'Tilt upward to reveal the ceiling design': 'إمالة لأعلى للكشف عن تصميم السقف',
  'Tilt downward to showcase flooring details': 'إمالة لأسفل لعرض تفاصيل الأرضية',
  'Macro cinematic material close-up': 'لقطة مقربة ماكرو سينمائية للمواد',
  'Focus on furniture while keeping the background softly blurred': 'التركيز على الأثاث مع إبقاء الخلفية ضبابية بلطف',
  'Move toward the window and reveal the outside view': 'التحرك نحو النافذة والكشف عن المشهد الخارجي',
  'Highlight indirect lighting and ambient illumination': 'إبراز الإضاءة غير المباشرة والإنارة المحيطة',
  'Follow the sunlight across the interior': 'متابعة أشعة الشمس عبر الفضاء الداخلي',
  'Slow cinematic rotation around the furniture arrangement': 'دوران سينمائي بطيء حول ترتيب الأثاث',
  'Luxury hotel cinematic interior movement': 'حركة داخلية سينمائية بأجواء فندق فاخر',
  'Natural eye-level walking camera': 'كاميرا مشي طبيعية بمستوى العين',
  'Floating steady cinematic camera': 'كاميرا سينمائية عائمة ثابتة',
  'Cinematic depth of field focus transition': 'انتقال تركيز سينمائي لعمق المجال',
  'Interior daylight transition timelapse': 'فاصل زمني لانتقال ضوء النهار في الداخل',
  'Slow cinematic drone rise': 'صعود سينمائي بطيء للطائرة المسيّرة',
  'Slow cinematic drone descend': 'هبوط سينمائي بطيء للطائرة المسيّرة',
  'Smooth aerial orbit around the building': 'مدار جوي سلس حول المبنى',
  'Cinematic fly around the building': 'تحليق سينمائي حول المبنى',
  'Reveal the front facade with a smooth approach': 'كشف الواجهة الأمامية بنهج سلس',
  'Reveal the side elevation with a smooth lateral movement': 'كشف الارتفاع الجانبي بحركة جانبية سلسة',
  'Epic architectural hero shot': 'لقطة بطولية ملحمية للمعمار',
  'Natural street-level walkthrough': 'جولة طبيعية بمستوى الشارع',
  'Walk naturally toward the entrance': 'المشي بشكل طبيعي نحو المدخل',
  'Low angle cinematic shot': 'لقطة سينمائية بزاوية منخفضة',
  'High angle architectural overview': 'نظرة عامة معمارية بزاوية عالية',
  'Smooth cinematic zoom in': 'تكبير سينمائي سلس',
  'Smooth cinematic zoom out': 'تصغير سينمائي سلس',
  'Fly through the outdoor space': 'التحليق عبر الفضاء الخارجي',
  'Reveal the landscape gradually': 'كشف المناظر الطبيعية تدريجياً',
  'Highlight the swimming pool and reflections': 'إبراز المسبح والانعكاسات',
  'Golden hour cinematic reveal': 'كشف سينمائي في الساعة الذهبية',
  'Luxury night lighting showcase': 'عرض إضاءة ليلية فاخرة',
  'Cinematic rainy atmosphere': 'أجواء ممطرة سينمائية',

  // ─── Architecture Effects — Category ───────────────────────────────────────
  'Architecture Effects': 'مؤثرات معمارية',

  // ─── Architecture Effects — Labels ─────────────────────────────────────────
  'Sketch to Render': 'من الرسم إلى الرندرة',
  'Clay Render Reveal': 'كشف مجسم الطين',
  'White Model to Reality': 'من النموذج الأبيض إلى الواقع',
  'Blueprint Animation': 'رسوم لوحة الكتروستات',
  'Materialization Effect': 'تأثير المواد التدريجي',
  'Construction Assembly': 'تجميع مراحل البناء',
  'Facade Build-Up': 'بناء الواجهة تدريجياً',
  'Floor-by-Floor Construction': 'البناء طابق بطابق',
  'Structural X-Ray': 'رؤية هيكل المبنى بالأشعة',
  'Exploded Axonometric': 'مجسم أكسونومتري منفجر',
  'Section Cut Animation': 'حركة القطع المقطعي',
  'Interior to Exterior Transition': 'الانتقال من الداخل للخارج',
  'Exterior to Interior Transition': 'الانتقال من الخارج للداخل',
  'Furniture Auto Assembly': 'تجميع الأثاث التلقائي',
  'Landscape Growth': 'نمو تدريجي للمناظر الطبيعية',
  'Lights Turning On': 'إضاءة تدريجية',
  'Glass Reflection Sweep': 'انعكاسات الزجاج المتحركة',
  'Rain Cleanup': 'تنظيف المطر للمبنى',
  'Seasonal Transformation': 'التحول عبر الفصول',
  'Design Evolution': 'تطور مراحل التصميم',

  // ─── Architecture Effects — Full Texts ─────────────────────────────────────
  'Cinematic morphing transition from hand-drawn architectural line sketch to fully photorealistic rendered building. Pencil strokes gradually dissolve into premium materials, textures, and realistic lighting. Smooth progressive reveal, architectural precision maintained throughout, ultra-high detail emergence.':
    'انتقال سينمائي من رسم معماري يدوي بالخطوط إلى مبنى فوتوواقعي مكتمل. تتلاشى ضربات القلم تدريجياً لتكشف عن مواد فاخرة وملمس واقعي وإضاءة احترافية. كشف تدريجي سلس مع الحفاظ على الدقة المعمارية طوال الانتقال.',

  'Smooth cinematic transition from uniform white clay massing model to fully detailed photorealistic architectural visualization. Materials, glazing, cladding, and landscaping emerge progressively over the pristine white base. Elegant material materialization effect, cinematic lighting, premium architectural quality.':
    'انتقال سينمائي سلس من مجسم الطين الأبيض الموحد إلى تصور معماري فوتوواقعي مفصل بالكامل. تظهر المواد والزجاج والكسوة وتنسيق الحدائق تدريجياً فوق القاعدة البيضاء النقية. تأثير تجسيد المواد الأنيق مع الإضاءة السينمائية.',

  'Transform a white architectural scale model into a photorealistic full-scale building. Simulate the effect of reality gradually replacing the miniature — correct scale, premium materials, natural lighting, surrounding environment, cinematic depth of field transition from model to reality.':
    'تحويل مجسم مصغر أبيض إلى مبنى واقعي بالحجم الطبيعي. محاكاة تأثير الواقع الذي يحل تدريجياً محل المجسم — نسب صحيحة، مواد فاخرة، إضاءة طبيعية، بيئة محيطة، انتقال سينمائي بعمق المجال من المجسم إلى الواقع.',

  'Cinematic animation beginning from technical architectural blueprint drawings — blue-white technical lines, dimensions, and annotations — then progressively transitioning into a fully realized photorealistic building. Technical precision evolves into architectural reality, smooth morphing, cinematic reveal.':
    'حركة سينمائية تبدأ من لوحات التصميم الهندسي الزرقاء — خطوط تقنية وأبعاد وتعليقات — ثم تنتقل تدريجياً إلى مبنى فوتوواقعي مكتمل. الدقة التقنية تتطور إلى واقع معماري، مورفينج سلس وكشف سينمائي.',

  'Building structure appears as invisible wireframe or transparent ghost form, then materials gradually materialize surface by surface — concrete, glass, steel, wood cladding, stone — each layer solidifying with cinematic timing. Luxury material reveal, realistic reflections appear progressively, architectural detail emerges.':
    'يظهر هيكل المبنى كإطار سلكي أو شبح شفاف، ثم تتجسد المواد تدريجياً سطحاً تلو الآخر — خرسانة، زجاج، فولاذ، خشب، حجر. كل طبقة تتصلب بتوقيت سينمائي دقيق مع ظهور الانعكاسات الواقعية تدريجياً.',

  'Ultra-fast cinematic timelapse of a complete building construction sequence — foundation pour, structural frame erection, floor slab casting, facade panel installation, glazing insertion, MEP rough-in, finishing, landscaping. Smooth accelerated assembly, crane movements, workers at scale, dramatic architectural reveal at completion.':
    'فاصل زمني سينمائي سريع لمراحل بناء مكتملة — صب الأساسات، رفع الهيكل الإنشائي، صب البلاطات، تركيب ألواح الواجهة، إدخال الزجاج، أعمال الإنهاء، تنسيق الحدائق. تجميع متسارع وسلس مع حركات الرافعات والعمال وكشف معماري درامي عند الاكتمال.',

  'Cinematic close-up animation of architectural facade panels assembling from left to right or bottom to top. Each cladding panel, curtain wall module, louver, or stone tile clicks precisely into position. Material quality and texture revealed progressively, realistic shadows and reflections appear with each new element, premium architectural detail.':
    'حركة مقربة سينمائية لألواح الواجهة المعمارية تتجمع من اليسار لليمين أو من الأسفل لأعلى. كل لوح كسوة أو وحدة جدار ستائري أو شريحة حجرية تستقر في موضعها بدقة. الجودة والملمس يُكشفان تدريجياً مع ظهور الظلال والانعكاسات الواقعية.',

  'Dramatic architectural animation showing building construction progressing floor by floor from ground level upward. Each storey materializes with structural columns, beams, slabs, then facade closure — stacking progressively into the completed tower. Aerial cinematic perspective, realistic scale, construction realism.':
    'حركة معمارية درامية تُظهر تقدم البناء طابقاً بطابق من مستوى الأرض لأعلى. كل طابق يتجسد بأعمدته وعوارضه وبلاطاته ثم إغلاق الواجهة، يتراكم تدريجياً في برج مكتمل. منظور جوي سينمائي بنسب واقعية وتفاصيل بناء حقيقية.',

  'Cinematic X-ray visualization revealing the structural skeleton beneath the architectural facade. Exterior cladding becomes transparent to expose the internal structural system — columns, shear walls, beams, slabs, core — highlighted with technical precision. Smooth fade between opaque exterior and transparent structural reveal, architectural engineering visualization.':
    'تصور سينمائي بالأشعة يكشف الهيكل الإنشائي الداخلي تحت الواجهة المعمارية. تصبح الكسوة الخارجية شفافة لتكشف عن المنظومة الإنشائية — الأعمدة وجدران القص والعوارض والبلاطات والنواة. تلاشٍ سلس بين الواجهة الكاملة والكشف الإنشائي الشفاف.',

  'Smooth cinematic exploded axonometric animation — building components separate and float apart layer by layer revealing internal organization: foundation, structure, services, floors, facade, roof. Each system drifts to its exploded position with precise architectural labelling, then reassembles perfectly. Premium technical visualization quality.':
    'حركة أكسونومترية سينمائية سلسة منفجرة — مكونات المبنى تنفصل وتطفو متباعدة طبقة تلو الأخرى لتكشف التنظيم الداخلي: الأساس، الهيكل، الخدمات، الطوابق، الواجهة، السقف. ثم تعود لتجميع نفسها بدقة. جودة تصور تقني فاخرة.',

  'Dramatic architectural section-cut animation — an invisible precision cutting plane slices through the building revealing interior spaces, floor plates, room arrangements, material thicknesses, and structural sections. Cut plane moves smoothly through the building, interior spaces illuminate progressively, architectural section quality rendering.':
    'حركة قطع مقطعي معمارية درامية — مستوى قطع دقيق غير مرئي يخترق المبنى ليكشف الفراغات الداخلية والبلاطات وترتيب الغرف وسماكات المواد والمقاطع الإنشائية. مستوى القطع يتحرك بسلاسة والفراغات الداخلية تضيء تدريجياً.',

  'Seamless cinematic transition beginning inside a luxury interior space — moving forward through a glazed facade or window — and smoothly transitioning to a full exterior architectural view of the building. Interior ambiance dissolves into exterior daylight, material continuity maintained, architectural coherence preserved.':
    'انتقال سينمائي سلس يبدأ من داخل فضاء داخلي فاخر — يتحرك للأمام عبر واجهة زجاجية أو نافذة — وينتقل بسلاسة إلى منظر خارجي معماري كامل للمبنى. يتلاشى المناخ الداخلي في ضوء النهار الخارجي مع الحفاظ على استمرارية المواد.',

  'Smooth cinematic journey beginning from an exterior aerial or street-level view of the building, flying or walking through the facade into a fully detailed luxury interior. Exterior cladding transitions seamlessly into interior finishes, daylight follows the camera through glazing, architectural spatial sequence revealed.':
    'رحلة سينمائية سلسة تبدأ من منظر خارجي جوي أو بمستوى الشارع، تحلق أو تمشي عبر الواجهة إلى داخل فاخر مفصل بالكامل. الكسوة الخارجية تنتقل بسلاسة إلى التشطيبات الداخلية، ضوء النهار يتبع الكاميرا عبر الزجاج.',

  'Cinematic animation of furniture pieces appearing and self-assembling within an empty architectural interior — chairs, tables, sofas, lighting fixtures, and decorative objects materialize from invisible to fully placed, scaling in from zero or floating into final position. Room transforms from empty shell to fully furnished luxury space, elegant timing.':
    'حركة سينمائية لقطع الأثاث تظهر وتجمع نفسها تلقائياً داخل فضاء داخلي معماري فارغ — كراسي وطاولات وأرائك ومصابيح وعناصر ديكور تتجسد من الغياب إلى موضعها النهائي. الغرفة تتحول من قشرة فارغة إلى فضاء فاخر مفروش بالكامل.',

  'Cinematic time-accelerated growth animation of architectural landscape — bare earth transforms progressively as trees grow from saplings to mature canopy, grass fills in, water features activate, planting beds bloom, pathways complete. Building remains constant while living landscape establishes itself around it, ultra-realistic botanical progression.':
    'حركة نمو متسارعة سينمائياً للمناظر الطبيعية المعمارية — الأرض العارية تتحول تدريجياً بينما تنمو الأشجار من شتلات إلى ظل ناضج، والعشب يتغطى، والمسطحات المائية تنشط، وأسرة النباتات تتفتح، والمسارات تكتمل.',

  'Cinematic dusk-to-night animation of an architectural building where interior and exterior lights progressively activate — room by room, floor by floor. Warm interior ambient glow appears behind glazing, architectural accent lighting illuminates facade elements, landscape uplighting activates, reflections on surfaces appear. Luxury night lighting choreography.':
    'حركة سينمائية من الغسق إلى الليل حيث تنشط الأضواء الداخلية والخارجية تدريجياً — غرفة بغرفة وطابقاً بطابق. تظهر إضاءة الأجواء الدافئة خلف الزجاج، وتضيء إضاءة الواجهة التشكيلية عناصر الواجهة، وتنشط الإضاءة التصاعدية للحدائق.',

  'Cinematic sweep of light reflections across large architectural glass surfaces — curtain walls, skylights, glazed facades. A moving light source or time-lapse sky creates dynamic reflections that sweep dramatically across the glass, revealing structural framing behind, interior spaces glimpsed through the reflections. Premium glazing material quality.':
    'انعكاسات سينمائية تجتاح الأسطح الزجاجية المعمارية الكبيرة — الجدران الستائرية والمصابيح الضوئية والواجهات الزجاجية. مصدر ضوء متحرك أو سماء متسارعة تخلق انعكاسات ديناميكية تجتاح الزجاج بشكل درامي.',

  'Cinematic architectural transformation where heavy rain gradually cleans and refreshes the building — dust washes away, surfaces gleam wet, puddles reflect the facade, materials darken with moisture then dry revealing pristine finishes. Smooth weather transition from overcast rain to clearing sky, architecture revealed in fresh clarity.':
    'تحول معماري سينمائي حيث يُنظف المطر الغزير المبنى تدريجياً — يُزال الغبار، الأسطح تلمع رطبة، البرك تعكس الواجهة، المواد تُعتم بالرطوبة ثم تجف لتكشف عن تشطيبات نقية. انتقال جوي سلس من المطر الغائم إلى السماء الصافية.',

  'Ultra-smooth cinematic timelapse of an architectural building through all four seasons — spring blossom, summer full canopy, autumn golden foliage, winter bare structure and snow. Sky, vegetation, and light quality transform while architecture remains constant. Seamless seasonal morphing, realistic environmental transitions, full year in one elegant sequence.':
    'فاصل زمني سينمائي فائق النعومة عبر فصول السنة الأربعة — ازدهار الربيع والمظلة الصيفية الكاملة وأوراق الخريف الذهبية وهيكل الشتاء الجرداء والثلج. السماء والغطاء النباتي وجودة الضوء تتحول بينما تبقى العمارة ثابتة.',

  'Cinematic morphing sequence showing the architectural design evolution — from concept massing to schematic design to design development to final photorealistic detail. Each stage transitions smoothly into the next with increasing material resolution, detail depth, and environmental richness. Design thinking process visualized cinematically, architectural progression.':
    'تسلسل مورفينج سينمائي يُظهر تطور التصميم المعماري — من الكتلة المفاهيمية إلى التصميم التخطيطي إلى تطوير التصميم إلى التفاصيل الفوتوواقعية النهائية. كل مرحلة تنتقل بسلاسة إلى التالية مع تزايد دقة المواد وعمق التفاصيل وثراء البيئة المحيطة.'
};
