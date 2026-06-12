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
    version: 'v0.2.0',
    date: 'June 12, 2026',
    status: 'current',
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
