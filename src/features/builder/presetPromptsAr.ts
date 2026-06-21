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
  'Preset Prompts': 'البرومتات الجاهزة'
};
