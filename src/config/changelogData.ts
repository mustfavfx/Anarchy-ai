export interface ChangelogFeature {
  type: 'feature' | 'improvement' | 'fix';
  title: string;
  description: string;
}

export interface ChangelogVersion {
  version: string;
  date: string;
  status?: 'current' | 'release';
  features: ChangelogFeature[];
}

export const CHANGELOG_DATA: ChangelogVersion[] = [
  {
    version: 'v0.3.91',
    date: 'September 11, 2026',
    status: 'current',
    features: [
      {
        type: 'fix',
        title: 'Mandatory Update Dialog Enforcement & Unclosable Persistence',
        description: 'Eliminated auto-dismissal timeouts from the update notification. The mandatory update modal now stays firmly pinned with a frosted glass backdrop blocking application interactions until the user explicitly clicks Update Now, guaranteeing all clients transition smoothly to the latest build.'
      },
      {
        type: 'fix',
        title: 'Canvas Builder activeTarget Scope Resolution & Crash Prevention',
        description: 'Fully restored and hardened activeTarget memoization within useBuilderWorkflow, eliminating runtime ReferenceErrors and guaranteeing immediate, stable canvas loading across all tabs.'
      },
      {
        type: 'feature',
        title: 'Universal Aspect Ratio Proportional Geometric Indicators',
        description: 'Crisp, real-time geometric rectangle preview icons representing exact image frame proportions (from ultrawide 4:1 to vertical 9:21) next to aspect ratio numbers across all AI engines and layout reframe tools.'
      }
    ]
  },
  {
    version: 'v0.3.90',
    date: 'September 11, 2026',
    status: 'release',
    features: [
      {
        type: 'feature',
        title: 'Universal Aspect Ratio Proportional Geometric Indicators',
        description: 'Added crisp, real-time geometric rectangle preview icons representing exact image frame proportions (from ultrawide 4:1, 3:1, 21:9 down to portrait 4:5, 3:4, 2:3, 9:16, 9:21) next to aspect ratio numbers across all AI engines (Flux, SDXL, Ideogram, Recraft, Reve, Imagen 3, GPT Image 2.5, Kling, Luma, MiniMax, Seedance) and Layout Reframe panels.'
      },
      {
        type: 'fix',
        title: 'Builder Canvas Modularization Runtime Stability & Hook Alignment',
        description: 'Resolved runtime module dependencies including useBuilderExternalEvents and activeTarget memoization within useBuilderWorkflow following monolith decomposition. Fixed context action node parameters and canvas event callbacks.'
      },
      {
        type: 'improvement',
        title: 'Strict App-Level Type Safety & Production Build Hardening',
        description: 'Achieved 100% strict type-safety verification via tsconfig.app.json with 0 type errors across all 371 workspace files, 100% passing Vitest test suites (249 tests), and error-free Vite production builds.'
      }
    ]
  },
  {
    version: 'v0.3.89',
    date: 'September 11, 2026',
    status: 'release',
    features: [
      {
        type: 'improvement',
        title: 'Architectural Monolith Decomposition & Professional Codebase Modularization',
        description: 'Completed a comprehensive software engineering refactoring across all 371 files in the codebase. Every monolith file exceeding 1,000 lines (including LayoutEditor, useBuilderWorkflow, AIControlPanel, BuilderPage, ReplicateService, useLayoutEditorState, SettingsPage, AnarchyService, ExportService, MaskCanvas, HistoryService) was modularized into clean, decoupled sub-components and hooks using the Zero-Breakage Facade Pattern, achieving zero files over 1,000 lines workspace-wide with 100% backward compatibility.'
      },
      {
        type: 'fix',
        title: 'Anarchy Upscale Sidebar Controls & Execution Pipeline',
        description: 'Fixed parameter syncing for Anarchy Upscale (Clarity Pro) in the right sidebar. Scale factor buttons (2x, 4x, 8x, 16x) and the creativity slider now persist state accurately across renders. Added Replicate version hash resolution and enabled one-click generation for prompt-less upscaler nodes.'
      },
      {
        type: 'fix',
        title: 'Multi-Tenant User Attribution & Cloud Storage Isolation',
        description: 'Enhanced Replicate webhook dispatch and upscaler engines with dynamic authenticated session resolution, ensuring generated images and upscaled outputs are strictly partitioned into each subscriber\'s private Supabase storage directory ([user_id]/[node_id]/).'
      },
      {
        type: 'improvement',
        title: 'Vite Production Bundling & Oxc Transform Engine Hardening',
        description: 'Hardened TypeScript AST boundaries and hook lifecycles across canvas and layout editors, ensuring instantaneous and error-free production builds via Vite.'
      }
    ]
  },
  {
    version: 'v0.3.88',
    date: 'September 10, 2026',
    status: 'release',
    features: [
      {
        type: 'feature',
        title: 'Anarchy Upscale (Clarity Pro) — Flagship AI Upscaler',
        description: 'Added Anarchy Upscale powered by Replicate Clarity Pro (philz1337x/clarity-pro-upscaler) as the #1 primary upscaling engine. Features 2x, 4x, 8x, and 16x scaling presets, a dedicated Creativity slider (-10 to +10) for detail control, live output megapixel preview, and guaranteed 50%+ profit margin credit pricing.'
      },
      {
        type: 'improvement',
        title: 'Revamped Left Navigation Sidebar Icons & Micro-Animations',
        description: 'Upgraded sidebar icons with modern, high-tech Lucide icons (LayoutDashboard, FolderKanban, Workflow, BrainCircuit, Cpu, Shapes, Images, History, Blocks) with smooth hover scaling and active neon glow effects.'
      },
      {
        type: 'feature',
        title: 'Pruna AI Upscale Integration',
        description: 'Integrated Pruna AI P-Image Upscale (prunaai/p-image-upscale) with dual factor mode (1x–16x) and target megapixel mode (1–128 MP), auto-presets, and live credit cost estimation.'
      },
      {
        type: 'improvement',
        title: 'Topaz Labs Upscale Pricing Calibration',
        description: 'Replaced flat credit pricing with official Replicate megapixel brackets (up to 512 MP), preventing revenue leakage on high-resolution inputs and guaranteeing healthy profit margins.'
      },
      {
        type: 'improvement',
        title: 'Clarity Upscaler Hardware-Aligned Compute Pricing',
        description: 'Calibrated Nvidia A100 GPU compute runtime tiers for Clarity Upscaler: 2x (3cr), 4x (10cr), 8x (20cr), 12x (30cr) with real-time hardware compute indicators.'
      },
      {
        type: 'feature',
        title: 'OpenAI GPT Image 2.5 Integration (Flare & Sunburst)',
        description: 'Added support for GPT Image 2.5 Flare (speed) and Sunburst (fidelity) across Edit and Generate modes, featuring a quick toggle pill, full OpenAPI quality tiers, and multi-image editing support.'
      },
      {
        type: 'feature',
        title: 'Standalone Admin Revenue & Subscribers Dashboard',
        description: 'Built a dedicated desktop P&L dashboard for tracking real-time Stripe revenue, Replicate API costs, net profit margins, user credit balances, and one-click CSV export.'
      }
    ]
  },
  {
    version: 'v0.3.59',
    date: 'July 13, 2026',
    status: 'release',
    features: [
      {
        type: 'feature',
        title: 'Video Engines — Seedance 2.0, Kling v3, Grok Video, Pruna P-Video, Veo 3.1, PixVerse v6, Sora 2 Pro',
        description: 'Integrated 7 new professional video generation engines with full resolution, duration, aspect ratio, and audio controls. Each engine includes model-specific parameters (start/end frame, reference video, audio generation, etc.) and an adaptive aspect ratio mode that preserves the source image proportions.'
      },
      {
        type: 'feature',
        title: 'Nano Banana 2 Lite & Seedream 5 Image Engines',
        description: 'Added Google Nano Banana 2 Lite (ultra-fast generation) and Seedream 5 (premium quality with style presets) as new image generation engines with full parameter control.'
      },
      {
        type: 'feature',
        title: 'Architecture Effects — 19 Exclusive Cinematic Video Prompts',
        description: 'Added a dedicated "Architecture Effects" prompt category with 19 signature video prompts: Sketch to Render, Blueprint to Reality, Massing to Masterpiece, Floor-by-Floor Construction, Structural X-Ray, Exploded Axonometric, Section Cut, Seasonal Transformation, and more — fully translated to Arabic.'
      },
      {
        type: 'feature',
        title: 'Dynamic Video Prompt Library',
        description: 'The prompt bar now automatically switches to architecture-specific video prompts (Interior Movements, Exterior Movements, Architecture Effects) when a video engine is selected, and reverts to image prompts otherwise.'
      },
      {
        type: 'improvement',
        title: 'Account Page — Complete Professional Redesign',
        description: 'Rebuilt the account page with a premium layout: real-time credit balance with Stripe top-up integration, usage statistics, subscription management, profile editing, security settings, and a polished dark UI with micro-animations.'
      },
      {
        type: 'improvement',
        title: 'Adaptive Aspect Ratio for All Video Engines',
        description: '"Adaptive" is now the default aspect ratio for all video engines, ensuring generated videos preserve the source image proportions without manual selection.'
      },
      {
        type: 'fix',
        title: 'Video Lightbox — Eye Icon & Close Button',
        description: 'Fixed the eye-icon preview for video nodes: videos now auto-play correctly in the lightbox. The close (X) button has been repositioned to a fixed top-right corner with a glassmorphism style, clearly visible regardless of media dimensions.'
      },
      {
        type: 'fix',
        title: 'Enter Key on Selected Node No Longer Triggers Node Expansion',
        description: 'Pressing Enter to submit a prompt no longer accidentally spawns a ghost node or expands the currently selected canvas node.'
      },
      {
        type: 'improvement',
        title: 'Video Prompt Quality Upgrade',
        description: 'All short one-liner camera movement prompts (Interior & Exterior) were rewritten into full cinematic director-level briefs with material quality, lighting, timing, and composition guidance for significantly better video model outputs.'
      }
    ]
  },
  {
    version: 'v0.3.10',
    date: 'June 27, 2026',
    status: 'release',

    features: [
      {
        type: 'fix',
        title: 'Registry Icon Path Alignment',
        description: 'Corrected the Windows registry path for the .ana file association icon in custom-hooks.nsh. The icon is now correctly mapped to $INSTDIR\\icons\\ana-file.ico (where it is bundled relative to the executable) rather than the non-existent resources folder.'
      }
    ]
  },
  {
    version: 'v0.3.9',
    date: 'June 27, 2026',
    status: 'release',
    features: [
      {
        type: 'fix',
        title: 'Project File Icon Association',
        description: 'Updated NSIS installer scripts to use SHCTX registry contexts and classes path structures. This allows per-user installations (non-admin runs) to successfully register the file extension .ana and correctly display the red A logo icon for project files on Windows.'
      }
    ]
  },
  {
    version: 'v0.3.8',
    date: 'June 27, 2026',
    status: 'release',
    features: [
      {
        type: 'fix',
        title: '3ds Max Localization Support',
        description: 'Fixed 3ds Max plugin installation to detect and write files to all active language profile folders (e.g. DEU, FRA, JPN, CHS, KOR, PTB) instead of only hardcoded English ENU, resolving issues where the plugin would not appear in non-English 3ds Max installations.'
      }
    ]
  },
  {
    version: 'v0.3.7',
    date: 'June 27, 2026',
    status: 'release',
    features: [
      {
        type: 'improvement',
        title: 'GitHub Actions Node.js 24 Upgrade',
        description: 'Upgraded setup-node and checkout actions to v6 to target Node.js 24 natively and resolve runner deprecation warnings.'
      },
      {
        type: 'improvement',
        title: 'SonarCloud Exclusions Setup',
        description: 'Configured .sonarcloud.properties to target production files and exclude build artifacts, dependencies, and test logs, preventing analysis time-outs.'
      }
    ]
  },
  {
    version: 'v0.3.1',
    date: 'June 26, 2026',
    status: 'release',
    features: [
      {
        type: 'improvement',
        title: 'Reactive History Graph Zoom',
        description: 'Fixed the zoom percentage label in the History Evolution Graph toolbar to update dynamically when zooming in, zooming out, or resetting the view.'
      },
      {
        type: 'improvement',
        title: 'Projects List View Spacing',
        description: 'Increased list view row height to 96px and added a clean 8px vertical separation gap between project cards to prevent overlapping and clipping.'
      },
      {
        type: 'improvement',
        title: 'Streamlined Integration Instructions',
        description: 'Raised "How to Use" plugin documentation to the top of the detail modal, and enabled auto-expanding instructions by default for installed integrations to reduce scrolling.'
      },
      {
        type: 'improvement',
        title: 'Cleaned Up Settings Panels',
        description: 'Removed the legacy, unused Sound Effects toggle from the notifications settings UI for a more polished settings panel.'
      }
    ]
  },
  {
    version: 'v0.3.0',
    date: 'June 26, 2026',
    status: 'release',
    features: [
      {
        type: 'feature',
        title: 'Multi-Tab Paste Isolation',
        description: 'Restrained image copy-paste behavior to target only the active workspace, preventing duplicate images from pasting into background tabs.'
      },
      {
        type: 'fix',
        title: 'Fixed Save Image Action',
        description: 'Implemented a hybrid base64 converter to bypass CORS policies and blob URL security restrictions, restoring full node image saving functionality.'
      },
      {
        type: 'improvement',
        title: 'Compact Export Modal & Click Isolation',
        description: 'Resized the export modal to an elegant 320px width and blocked event bubbling to prevent clicking modal buttons from selecting nodes or spawning ghost nodes underneath.'
      },
      {
        type: 'feature',
        title: 'Ghost Node Retention & Branching',
        description: 'Ensured ghost nodes remain active on canvas clicks during generation, and allowed spawning multiple parallel ghost nodes from the same parent.'
      },
      {
        type: 'feature',
        title: 'Advanced Inpainting & FLUX Fill',
        description: 'Integrated the official flux-1-fill model with black-and-white binary mask conversion and redesigned interactive click-and-drag crop handles.'
      },
      {
        type: 'improvement',
        title: 'Protected Production Builds',
        description: 'Disabled F12, developer tools shortcuts, and context menu inspection in production builds for enhanced code protection.'
      }
    ]
  },
  {
    version: 'v0.2.1',
    date: 'June 12, 2026',
    status: 'release',
    features: [
      {
        type: 'fix',
        title: 'Fix Upscale Engines Parameter Mapping',
        description: 'Fixed a bug where Topaz Labs and Clarity parameters were filtered out, ensuring they now produce visibly distinct outputs.'
      },
      {
        type: 'improvement',
        title: 'Optimized Clarity Upscaler',
        description: 'Fixed prompt and seed variables, and simplified the execution process to use a single pass with the target scale factor.'
      },
      {
        type: 'improvement',
        title: 'Removed Real-ESRGAN Model',
        description: 'Removed the legacy Real-ESRGAN engine, its adapter code, and UI selection elements across the builder and settings.'
      },
      {
        type: 'improvement',
        title: 'Replicate API Call Logging',
        description: 'Added detailed payload and response logging for all Replicate API prediction requests.'
      }
    ]
  },
  {
    version: 'v0.0.19',
    date: 'June 12, 2026',
    features: [
      {
        type: 'feature',
        title: 'Dynamic Quick Presets',
        description: 'Added dynamic Quick Presets that shuffle and select 10 random prompts on app launch to inspire creativity.'
      },
      {
        type: 'improvement',
        title: 'Project Thumbnail Selection',
        description: 'Prioritized showing actual source or result node images for project thumbnails instead of empty viewport screenshots.'
      },
      {
        type: 'improvement',
        title: 'Unified Privacy Policy & Terms',
        description: 'Updated and unified the Privacy Policy & Terms of Use with standard professional clauses in a consistent modal view.'
      },
      {
        type: 'improvement',
        title: 'Centered Contact & Support Email',
        description: 'Centered all contact options and added a dynamic button to open the support email messaging interface directly.'
      },
      {
        type: 'fix',
        title: 'Tauri External Links',
        description: 'Fixed external link navigation to open Instagram, website, and Telegram in the user\'s default system browser.'
      }
    ]
  },
  {
    version: 'v0.0.18',
    date: 'June 7, 2026',
    features: [
      {
        type: 'feature',
        title: 'Replicate API Key Fallback',
        description: 'Implemented local Replicate API key fallback support for uninterrupted cloud generations.'
      },
      {
        type: 'feature',
        title: 'Update & Offline Notifications',
        description: 'Added automated update notifications and offline network capability checks.'
      }
    ]
  },
  {
    version: 'v0.07',
    date: 'May 2026',
    features: [
      {
        type: 'feature',
        title: 'Crop Tool in Mask Canvas',
        description: 'Added a full crop tool with corner handles, rule-of-thirds grid, and keyboard shortcuts (C to activate, Enter to apply).'
      },
      {
        type: 'feature',
        title: 'Expanded Mask View',
        description: 'Mask & Crop tools are now available in the fullscreen expanded view for a better editing experience.'
      },
      {
        type: 'improvement',
        title: 'History Now Updates Instantly',
        description: 'Fixed a bug where newly generated images did not appear in History until reopening the app.'
      },
      {
        type: 'fix',
        title: 'Image Persistence in History',
        description: 'Input images are now saved locally before being recorded in history, preventing broken image links.'
      }
    ]
  },
  {
    version: 'v0.06',
    date: 'April 2026',
    status: 'release',
    features: [
      {
        type: 'feature',
        title: 'Node-Based Builder',
        description: 'Complete node-based workflow system for chaining AI generations, upscaling, and image editing.'
      },
      {
        type: 'feature',
        title: 'AI Image Generation',
        description: 'Multi-model AI rendering for architectural visualization with prompt control and reference images.'
      },
      {
        type: 'feature',
        title: 'History & Library',
        description: 'Full generation history with full-res image storage, starring, filtering, and node tree replay.'
      },
      {
        type: 'feature',
        title: 'Compare Mode',
        description: 'Side-by-side A/B comparison of generated images with a draggable slider.'
      }
    ]
  }
];
