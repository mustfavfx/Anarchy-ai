// Anarchy AI Admin Dashboard - Replicate AI Models Registry & Cost Formulas
const MODEL_REGISTRY = {
      'google/nano-banana-2': {
        name: 'Nano Banana 2',
        vendor: 'Google (Gemini 3.1 Flash)',
        icon: '🍌',
        baseCostUsd: 0.067,
        baseCredits: 1.1,
        calcCost: (input) => {
          const res = String(input?.resolution || '').toUpperCase();
          if (res.includes('4K')) return { usd: 0.134, credits: 2.2 };
          if (res.includes('2K')) return { usd: 0.073, credits: 1.2 };
          return { usd: 0.067, credits: 1.1 };
        }
      },
      'google/nano-banana-2-lite': {
        name: 'Nano Banana 2 Lite',
        vendor: 'Google',
        icon: '🍌',
        baseCostUsd: 0.034,
        baseCredits: 0.7
      },
      'google/nano-banana-pro': {
        name: 'Nano Banana Pro',
        vendor: 'Google (Gemini 3 Pro)',
        icon: '🍌',
        baseCostUsd: 0.134,
        baseCredits: 2.2,
        calcCost: (input) => {
          const res = String(input?.resolution || '').toUpperCase();
          if (res.includes('4K')) return { usd: 0.240, credits: 4.2 };
          return { usd: 0.134, credits: 2.2 };
        }
      },
      'bytedance/seedream-5-pro': {
        name: 'Seedream 5 Pro',
        vendor: 'ByteDance',
        icon: '🌊',
        baseCostUsd: 0.045,
        baseCredits: 0.8,
        calcCost: (input) => {
          const res = String(input?.resolution || '').toUpperCase();
          if (res.includes('2K') || res.includes('4K')) return { usd: 0.075, credits: 1.3 };
          return { usd: 0.045, credits: 0.8 };
        }
      },
      'bytedance/seedream-4.5': {
        name: 'Seedream 4.5',
        vendor: 'ByteDance',
        icon: '🌊',
        baseCostUsd: 0.055,
        baseCredits: 1.0,
        calcCost: (input) => {
          const res = String(input?.resolution || '').toUpperCase();
          if (res.includes('4K')) return { usd: 0.082, credits: 1.5 };
          return { usd: 0.055, credits: 1.0 };
        }
      },
      'black-forest-labs/flux-2-pro': {
        name: 'FLUX 2 Pro',
        vendor: 'Black Forest Labs',
        icon: '⚡',
        baseCostUsd: 0.015,
        baseCredits: 0.5
      },
      'black-forest-labs/flux-1.1-pro': {
        name: 'FLUX 1.1 Pro',
        vendor: 'Black Forest Labs',
        icon: '⚡',
        baseCostUsd: 0.040,
        baseCredits: 1.0
      },
      'black-forest-labs/flux-1.1-pro-ultra': {
        name: 'FLUX 1.1 Pro Ultra',
        vendor: 'Black Forest Labs',
        icon: '⚡',
        baseCostUsd: 0.060,
        baseCredits: 1.5
      },
      'black-forest-labs/flux-dev': {
        name: 'FLUX Dev',
        vendor: 'Black Forest Labs',
        icon: '⚡',
        baseCostUsd: 0.025,
        baseCredits: 0.8
      },
      'black-forest-labs/flux-schnell': {
        name: 'FLUX Schnell',
        vendor: 'Black Forest Labs',
        icon: '⚡',
        baseCostUsd: 0.003,
        baseCredits: 0.3
      },
      'openai/gpt-image-2': {
        name: 'GPT Image 2',
        vendor: 'OpenAI',
        icon: '🤖',
        baseCostUsd: 0.128,
        baseCredits: 1.8,
        calcCost: (input) => {
          const q = String(input?.quality || '').toLowerCase();
          if (q === 'low') return { usd: 0.032, credits: 0.5 };
          if (q === 'medium') return { usd: 0.048, credits: 0.8 };
          return { usd: 0.128, credits: 1.8 };
        }
      },
      'openai/gpt-image-2.5-flare': {
        name: 'GPT Image 2.5 Flare',
        vendor: 'OpenAI',
        icon: '✨',
        baseCostUsd: 0.250,
        baseCredits: 3.0,
        calcCost: (input, metrics) => {
          if (metrics?.predict_time && metrics.predict_time < 22) {
            return { usd: 0.010, credits: 0.5 };
          }
          if (metrics?.model_variant === 'medium') {
            return { usd: 0.010, credits: 0.5 };
          }
          return { usd: 0.250, credits: 3.0 };
        }
      },
      'openai/gpt-image-2.5-sunburst': {
        name: 'GPT Image 2.5 Sunburst',
        vendor: 'OpenAI',
        icon: '☀️',
        baseCostUsd: 0.250,
        baseCredits: 3.0
      },
      'midjourney/mj-turbo-upscale': {
        name: 'Midjourney Turbo Upscale',
        vendor: 'Midjourney (CometAPI)',
        icon: '⚡',
        baseCostUsd: 0.150,
        baseCredits: 3.0
      },
      'midjourney/mj-turbo-upscale-subtle': {
        name: 'Midjourney Turbo Subtle',
        vendor: 'Midjourney (CometAPI)',
        icon: '⚡',
        baseCostUsd: 0.315,
        baseCredits: 6.0
      },
      'midjourney/mj-turbo-upscale-creative': {
        name: 'Midjourney Turbo Creative',
        vendor: 'Midjourney (CometAPI)',
        icon: '✨',
        baseCostUsd: 0.315,
        baseCredits: 6.0
      },
      'midjourney/mj-fast-upscale': {
        name: 'Midjourney Fast Upscale',
        vendor: 'Midjourney (CometAPI)',
        icon: '⏱️',
        baseCostUsd: 0.052,
        baseCredits: 1.0
      },
      'midjourney/mj-fast-upscale-subtle': {
        name: 'Midjourney Fast Subtle',
        vendor: 'Midjourney (CometAPI)',
        icon: '⏱️',
        baseCostUsd: 0.105,
        baseCredits: 2.0
      },
      'midjourney/mj-fast-upscale-creative': {
        name: 'Midjourney Fast Creative',
        vendor: 'Midjourney (CometAPI)',
        icon: '✨',
        baseCostUsd: 0.105,
        baseCredits: 2.0
      },
      'topazlabs/image-upscale': {
        name: 'Topaz Labs AI Upscale',
        vendor: 'Topaz Labs',
        icon: '💎',
        baseCostUsd: 0.160,
        baseCredits: 3.0
      },
      'topazlabs/topaz-photo-ai': {
        name: 'Topaz Labs AI Upscale',
        vendor: 'Topaz Labs',
        icon: '💎',
        baseCostUsd: 0.160,
        baseCredits: 3.0
      },
      'philz1337x/clarity-upscaler': {
        name: 'Clarity Upscaler',
        vendor: 'Clarity AI',
        icon: '🔍',
        baseCostUsd: 0.100,
        baseCredits: 3.0
      },
      'philz1337x/clarity-pro-upscaler': {
        name: 'Anarchy Clarity Pro',
        vendor: 'Anarchy AI',
        icon: '🔬',
        baseCostUsd: 0.030,
        baseCredits: 2.0
      },
      'prunaai/p-image': {
        name: 'Pruna P-Image',
        vendor: 'Pruna AI',
        icon: '🎨',
        baseCostUsd: 0.005,
        baseCredits: 0.5
      },
      'prunaai/p-image-upscale': {
        name: 'Pruna Upscaler',
        vendor: 'Pruna AI',
        icon: '📐',
        baseCostUsd: 0.010,
        baseCredits: 0.5
      },
      'prunaai/p-image-upscaler': {
        name: 'Pruna Upscaler',
        vendor: 'Pruna AI',
        icon: '📐',
        baseCostUsd: 0.010,
        baseCredits: 0.5
      },
      'krea/krea-2-large': {
        name: 'Krea 2 Large',
        vendor: 'Krea AI',
        icon: '🖌️',
        baseCostUsd: 0.060,
        baseCredits: 1.0
      },
      'stability-ai/stable-diffusion-3.5-large': {
        name: 'SD 3.5 Large',
        vendor: 'Stability AI',
        icon: '🌌',
        baseCostUsd: 0.065,
        baseCredits: 1.2
      },
      'stability-ai/sdxl': {
        name: 'SDXL',
        vendor: 'Stability AI',
        icon: '🎨',
        baseCostUsd: 0.008,
        baseCredits: 0.3
      },
      'bytedance/sdxl-lightning-4step': {
        name: 'SDXL Lightning',
        vendor: 'ByteDance',
        icon: '⚡',
        baseCostUsd: 0.003,
        baseCredits: 0.2
      },
      'recraft-ai/recraft-v3': {
        name: 'Recraft v3',
        vendor: 'Recraft AI',
        icon: '📐',
        baseCostUsd: 0.040,
        baseCredits: 1.0
      },
      'ideogram-ai/ideogram-v2': {
        name: 'Ideogram v2',
        vendor: 'Ideogram',
        icon: '🔤',
        baseCostUsd: 0.080,
        baseCredits: 1.5
      },
      'minimax/video-01': {
        name: 'MiniMax Video-01',
        vendor: 'MiniMax',
        icon: '🎬',
        baseCostUsd: 0.250,
        baseCredits: 14.0
      },
      'bytedance/seedance-2.0': {
        name: 'SeaDance 2.0 Video',
        vendor: 'ByteDance',
        icon: '🎬',
        baseCostUsd: 0.280,
        baseCredits: 14.0
      },
      'kwaivgi/kling-v3-omni-video': {
        name: 'Kling v3 Video',
        vendor: 'Kuaishou Kling',
        icon: '🎬',
        baseCostUsd: 0.300,
        baseCredits: 15.0
      },
      'xai/grok-imagine-video-1.5': {
        name: 'Grok Imagine Video',
        vendor: 'xAI',
        icon: '🎬',
        baseCostUsd: 0.250,
        baseCredits: 14.0
      },
      'prunaai/p-video': {
        name: 'Pruna Fast Video',
        vendor: 'Pruna AI',
        icon: '🎬',
        baseCostUsd: 0.150,
        baseCredits: 10.0
      },
      'google/veo-3.1-fast': {
        name: 'Google Veo 3.1 Fast',
        vendor: 'Google DeepMind',
        icon: '🎥',
        baseCostUsd: 0.350,
        baseCredits: 18.0
      },
      'pixverse/pixverse-v6': {
        name: 'PixVerse v6 Video',
        vendor: 'PixVerse',
        icon: '🎬',
        baseCostUsd: 0.200,
        baseCredits: 12.0
      },
      'openai/sora-2-pro': {
        name: 'OpenAI Sora 2 Pro',
        vendor: 'OpenAI',
        icon: '🎥',
        baseCostUsd: 0.500,
        baseCredits: 25.0
      },
      'wavespeedai/wan-2.1-i2v-480p': {
        name: 'Wan 2.1 Video (480p)',
        vendor: 'WaveSpeed AI',
        icon: '🎬',
        baseCostUsd: 0.120,
        baseCredits: 8.0
      },
      'wavespeedai/wan-2.1-i2v-720p': {
        name: 'Wan 2.1 Video (720p)',
        vendor: 'WaveSpeed AI',
        icon: '🎬',
        baseCostUsd: 0.220,
        baseCredits: 12.0
      }
    };

    function resolveModelEconomics(item, measuredWidth, measuredHeight) {
      const w = measuredWidth || item.width || item.input?.width || 0;
      const h = measuredHeight || item.height || item.input?.height || 0;
      const sz = item.size || 0;
      const fn = (item.fileName || '').toLowerCase();
      const fold = (item.folderName || '').toLowerCase();
      const p = (item.prompt || '').toLowerCase();
      const mime = (item.mimetype || '').toLowerCase();

      let modelKey = item.model;

      // 1. If model was explicitly identified from Replicate API or DB, preserve and normalize it
      if (modelKey && modelKey !== 'unknown') {
        if (modelKey.includes('flare')) modelKey = 'openai/gpt-image-2.5-flare';
        else if (modelKey.includes('sunburst')) modelKey = 'openai/gpt-image-2.5-sunburst';
        else if (modelKey.includes('image-upscale') || modelKey.includes('topaz')) modelKey = 'topazlabs/image-upscale';
        else if (modelKey.includes('mj_turbo_upscale_subtle') || modelKey.includes('mj-turbo-upscale-subtle')) modelKey = 'midjourney/mj-turbo-upscale-subtle';
        else if (modelKey.includes('mj_turbo_upscale_creative') || modelKey.includes('mj-turbo-upscale-creative')) modelKey = 'midjourney/mj-turbo-upscale-creative';
        else if (modelKey.includes('mj_fast_upscale_subtle') || modelKey.includes('mj-fast-upscale-subtle')) modelKey = 'midjourney/mj-fast-upscale-subtle';
        else if (modelKey.includes('mj_fast_upscale_creative') || modelKey.includes('mj-fast-upscale-creative')) modelKey = 'midjourney/mj-fast-upscale-creative';
        else if (modelKey.includes('mj_fast_upscale') || modelKey.includes('mj-fast-upscale')) modelKey = 'midjourney/mj-fast-upscale';
        else if (modelKey.includes('mj_turbo_upscale') || modelKey.includes('mj-turbo-upscale')) modelKey = 'midjourney/mj-turbo-upscale';
      }

      // 2. Fallback Smart Fingerprinting (only when model is unknown or null):
      if (!modelKey || modelKey === 'unknown') {
        // A. Topaz Labs AI Upscale / Clarity Upscale:
        // Size > 2.0MB OR Resolution >= 2400px (e.g. 6688x3764 @ 8.26MB)
        if (sz > 2.0 * 1024 * 1024 || w >= 2400 || h >= 2400 || fn.includes('topaz') || fold.includes('topaz') || p.includes('topaz') || fn.includes('upscale')) {
          modelKey = 'topazlabs/image-upscale';
        } else if (fn.includes('clarity') || fold.includes('clarity') || p.includes('clarity')) {
          modelKey = 'philz1337x/clarity-upscaler';
        }
        // B. Video Model Families:
        else if (item.isVideo || fn.endsWith('.mp4') || fn.endsWith('.mov') || fn.endsWith('.webm')) {
          if (fn.includes('kling') || fold.includes('kling')) modelKey = 'kwaivgi/kling-v3-omni-video';
          else if (fn.includes('seedance') || fold.includes('seedance')) modelKey = 'bytedance/seedance-2.0';
          else if (fn.includes('veo') || fold.includes('veo')) modelKey = 'google/veo-3.1-fast';
          else if (fn.includes('sora') || fold.includes('sora')) modelKey = 'openai/sora-2-pro';
          else if (fn.includes('wan') || fold.includes('wan')) modelKey = 'wavespeedai/wan-2.1-i2v-720p';
          else modelKey = 'minimax/video-01';
        }
        // C. GPT Image 2.5 Flare / Sunburst / DALL-E:
        else if (fn.includes('flare') || fold.includes('flare') || fn.includes('gpt') || fold.includes('gpt') || p.includes('gpt') || fn.includes('dall-e')) {
          modelKey = 'openai/gpt-image-2.5-flare';
        }
        // D. FLUX 2 Pro signatures:
        else if ((w === 1536 && h === 1024) || (w === 1024 && h === 1536) || (w === 1440 && h === 960) || fn.includes('flux') || fold.includes('flux') || p.includes('flux')) {
          modelKey = 'black-forest-labs/flux-2-pro';
        }
        // E. Seedream 5 Pro signatures (ByteDance 2K):
        else if ((w >= 2048 && w < 2400) || (h >= 2048 && h < 2400) || (w === 1536 && h === 1536) || fn.includes('seedream') || fold.includes('seedream') || p.includes('seedream')) {
          modelKey = 'bytedance/seedream-5-pro';
        }
        // F. Nano Banana Pro (Gemini 3 Pro):
        else if (fn.includes('nano-pro') || p.includes('nano pro')) {
          modelKey = 'google/nano-banana-pro';
        }
        // G. Default to Nano Banana 2 (Google Gemini Flash Image - standard 1376x768 / 1024x1024):
        else {
          modelKey = 'google/nano-banana-2';
        }
      }

      let reg = MODEL_REGISTRY[modelKey];
      if (!reg) {
        const foundKey = Object.keys(MODEL_REGISTRY).find(k => k.toLowerCase().includes(modelKey.toLowerCase()) || modelKey.toLowerCase().includes(k.toLowerCase()));
        if (foundKey) reg = MODEL_REGISTRY[foundKey];
      }

      let name = reg ? reg.name : modelKey.split('/').pop();
      let vendor = reg ? reg.vendor : 'AI Engine';
      let icon = reg ? reg.icon : '⚡';
      let costUsd = reg ? reg.baseCostUsd : 0.050;
      let credits = reg ? reg.baseCredits : 1.0;

      // Adjust pricing for high-scale deep upscales (6K/8K)
      if (modelKey.includes('topaz') || modelKey.includes('upscale')) {
        if (w >= 6000 || h >= 3500 || sz > 5 * 1024 * 1024) {
          costUsd = 0.200; // Ultra high-res upscale (e.g. 6688x3764 @ 8.26MB)
          credits = 3.0;
        } else {
          costUsd = 0.160;
          credits = 2.0;
        }
      } else if (reg && reg.calcCost) {
        const calculated = reg.calcCost(item.input, item.metrics);
        costUsd = calculated.usd;
        credits = calculated.credits;
      }

      if (item.creditAmount && item.creditAmount > 0) {
        credits = item.creditAmount;
      }

      const revenueUsd = credits * 0.10;
      let profitMargin = 0;
      if (revenueUsd > 0) {
        profitMargin = Math.round(((revenueUsd - costUsd) / revenueUsd) * 100);
      }

      return {
        modelKey,
        modelName: name,
        vendor,
        icon,
        costUsd,
        credits,
        revenueUsd,
        profitMargin: Math.max(0, profitMargin)
      };
    }

    function getStandardAspectRatio(w, h) {
      if (!w || !h) return null;
      const ratio = w / h;
      if (Math.abs(ratio - 16 / 9) < 0.06) return '16:9';
      if (Math.abs(ratio - 1) < 0.04) return '1:1';
      if (Math.abs(ratio - 9 / 16) < 0.06) return '9:16';
      if (Math.abs(ratio - 4 / 3) < 0.05) return '4:3';
      if (Math.abs(ratio - 3 / 4) < 0.05) return '3:4';
      if (Math.abs(ratio - 3 / 2) < 0.05) return '3:2';
      if (Math.abs(ratio - 2 / 3) < 0.05) return '2:3';
      if (Math.abs(ratio - 21 / 9) < 0.08) return '21:9';
      if (Math.abs(ratio - 4 / 5) < 0.05) return '4:5';
      if (Math.abs(ratio - 5 / 4) < 0.05) return '5:4';
      return ratio > 1 ? `${ratio.toFixed(2)}:1` : `1:${(1 / ratio).toFixed(2)}`;
    }

    function getAspectRatioDescription(ar) {
      if (!ar) return '';
      const map = {
        '16:9': 'أفقي عريض (Landscape / يوتيوب وعرض شاشة)',
        '1:1': 'مربع قياسي (Square / منشورات السوشيال)',
        '9:16': 'طولي كامل (Story / ريلز وتيك توك)',
        '4:3': 'شاشة قياسية (Standard Classic)',
        '3:4': 'بورتريه كلاسيكي (Classic Portrait)',
        '3:2': 'تصوير فوتوغرافي أفقي (DSLR Photo)',
        '2:3': 'بورتريه فوتوغرافي طولي (Portrait Photo)',
        '4:5': 'منشور انستغرام طولي (Instagram Feed Post)',
        '21:9': 'سينمائي عريض فائق (Ultrawide Cinema)'
      };
      return map[ar] || 'نسبة أبعاد مخصصة';
    }

