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
    version: 'v0.3.8',
    date: 'June 27, 2026',
    status: 'current',
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
