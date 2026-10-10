import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Layers,
  Building2,
  Zap,
  Palette,
  CheckCircle2,
  ArrowRight,
  Rocket,
  Crop,
  ImagePlus,
  Maximize2,
  PenTool,
  Eye,
  Coffee,
  Video,
  Settings,
  Play,
  Box,
  Download
} from 'lucide-react';
import './WhatsNewModal.css';

export interface UpdateFeatureCard {
  icon: 'polygon' | 'image-plus' | 'expand' | 'pen' | 'ai-shape' | 'selection' | 'eye' | 'teapot' | 'lightning' | 'camera' | 'gear' | 'play';
  title: string;
  description: string;
}

export interface UpdateSlide {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  featureCards?: UpdateFeatureCard[];
  graphicType: 'canvas' | 'layers' | 'agent' | 'rendering' | 'prompts' | 'object-masks' | 'mask-tool' | 'max-suite' | 'video-converter' | 'sketchup-suite';
  accentColor: string;
}

const UPDATE_SLIDES: UpdateSlide[] = [
  {
    id: 'revit-cua-v03102',
    badge: 'Latest Release v0.3.102 | Revit Visual Computer-Use Agent',
    title: 'Visual Computer-Use Agent (CUA) for Autodesk Revit',
    subtitle: 'Human-like visual interaction: Autonomous mouse navigation, keyboard shortcuts (WA, DR, WN, ZE), and live drawing on Revit canvas.',
    description: 'Version 0.3.102 evolves the Revit agent into a true visual Computer-Use Agent (CUA). Operating like a real architect seated in front of Revit, the agent focuses the window, visually grounds UI elements with Set-of-Marks, clicks ribbon tools, activates keyboard shortcuts, and draws geometry directly on the viewport canvas with real-time visual progress streaming.',
    features: [
      '1. Autonomous Visual Interaction: Operates Revit directly through visual mouse movements, clicks, drags, and keyboard input',
      '2. Revit Set-of-Marks Grounding: Deterministic visual anchors for Architecture Tab, Wall Tool (WA), Door (DR), Window (WN), and Canvas Points',
      '3. Keyboard Shortcuts & Workflow: Activates native shortcuts (WA for Wall, DR for Door, WN for Window, ZE for Zoom Extents, Escape to reset)',
      '4. Visual Step Streaming: Real-time execution logs and viewport screenshot feedback streamed straight to the user copilot interface',
      '5. Architectural Presets: One-click visual tasks in the Copilot Dock for walls, openings, 3D views, and full layouts',
    ],
    featureCards: [
      {
        icon: 'lightning',
        title: '1. Human-Like UI Control',
        description: 'Moves the mouse, activates tools in the Revit ribbon, and clicks on the drawing canvas just like a real architect.',
      },
      {
        icon: 'camera',
        title: '2. Set-of-Marks Anchors',
        description: 'Deterministic bounding-box anchors identify ribbon buttons, drawing canvas centers, and project browser panels.',
      },
      {
        icon: 'keyboard',
        title: '3. Architectural Shortcuts',
        description: 'Instantly fires shortcuts like WA, DR, WN, and ZE with automated escape sequences between actions.',
      },
      {
        icon: 'agent',
        title: '4. Visual Step Streaming',
        description: 'Each thought, mouse action, and screenshot is logged live into the agent chat interface.',
      },
    ],
    graphicType: 'agent',
    accentColor: '#38bdf8',
  },
  {
    id: 'revit-copilot-v03101',
    badge: 'Previous Release v0.3.101 | Autodesk Revit AI Copilot',
    title: 'Autonomous Autodesk Revit BIM Copilot',
    subtitle: 'Full parametric modeling, architectural villa generation, BIM schedule inspection, and direct canvas viewport sync.',
    description: 'Version 0.3.101 empowers Anarchy AI Agent with full native integration inside Autodesk Revit. Built on thread-safe ExternalEvent architecture and live HTTP polling, the agent executes parametric modeling, camera positioning, and BIM data extractions directly.',
    features: [
      '1. Parametric Villa Modeling: Automatically creates levels, walls, floors, doors, and windows directly in Revit',
      '2. Smart Camera & 3D Perspective: Aligns Revit camera at human eye level (1.7m) with realistic focal depth',
      '3. Instant Viewport Canvas Sync: Captures active 3D views and floor plans and streams them to the AI canvas',
      '4. Deep BIM Inspection: Extracts rooms, floor areas, schedules, material counts, and element metadata',
      '5. Automated BIM Export: Seamlessly triggers background exports to IFC and DWG formats',
    ],
    featureCards: [
      {
        icon: 'teapot',
        title: '1. Parametric Modeling',
        description: 'Command the agent to build villas, floor slabs, and openings with metric dimensions converted accurately to Revit internal units.',
      },
      {
        icon: 'camera',
        title: '2. Perspective Sync',
        description: 'Direct high-resolution viewport streaming from Revit 2027 into the Anarchy AI infinite canvas.',
      },
      {
        icon: 'lightning',
        title: '3. BIM Data Extraction',
        description: 'Query room areas, level elevations, wall counts, and project schedules through conversational agent prompts.',
      },
      {
        icon: 'gear',
        title: '4. Native .NET 10 Plugin',
        description: 'Prebuilt native C# add-in running asynchronously on Revit UI threads via ExternalEvent handling.',
      },
    ],
    graphicType: 'agent',
    accentColor: '#0ea5e9',
  },
  {
    id: 'resize-credits-overhaul-v03100',
    badge: 'v0.3.100 | Workflow & Pipeline Stabilization',
    title: 'AI Resize Outpainting & Unified Credit Billing',
    subtitle: 'High-precision architectural aspect ratio reframing, intelligent outpainting, and transparent credit deduction.',
    description: 'Version 0.3.100 resolves workflow generation node pipeline execution (primaryEdge scope fix), mask adjustment layer initialization, and image framing and aspect ratio outpainting in the Lightbox Image Editor.',
    features: [
      '1. Fixed AI Resize & Framing: Expands canvas to 9:16, 16:9, 4:5 without distorting central architecture',
      '2. Seamless AI Outpainting: Fills surroundings, sky, and foreground cleanly using Nano Banana & GPT Image',
      '3. Real-Time Credit Deduction: Accurate balance deductions across Resize, Markup, Erase, and Comments',
      '4. Live Cost Preview: Transparent points cost displayed on action buttons before initiating generation',
      '5. Auto-Refund Protection: Immediate credit restoration if server-side generation fails',
    ],
    featureCards: [
      {
        icon: 'expand',
        title: '1. Fixed Aspect Ratio Outpaint',
        description: 'Reframed images and exact dimensions are transmitted accurately to the AI engine without reverting to unpadded frames.',
      },
      {
        icon: 'lightning',
        title: '2. Unified Credit Billing',
        description: 'All editor tools are now fully synchronized with checkCreditBalance and atomic credit deduction.',
      },
      {
        icon: 'ai-shape',
        title: '3. Architectural Preservation',
        description: '100% preservation of original structure, materials, and lighting in the center of the expanded frame.',
      },
      {
        icon: 'gear',
        title: '4. Refund & Cost Safety',
        description: 'Live point display on confirmation buttons and automatic credit refund upon unexpected generation failures.',
      },
    ],
    graphicType: 'canvas',
    accentColor: '#ff2a6d',
  },
  {
    id: 'sketchup-4tool-suite',
    badge: 'Major Release v0.3.97 | SketchUp AI Suite',
    title: 'Official Trimble SketchUp Integration Suite',
    subtitle: 'Lightning-fast AI for SketchUp: Send Viewport, Instant AI Render & Batch Scenes Export',
    description: 'Version 0.3.97 introduces official native integration for Trimble SketchUp (2020–2027) with a dedicated Ruby extension suite, floating toolbar, camera metadata sync, and ultra-compact integrations interface.',
    features: [
      '1. Send Viewport: Stream active 3D camera view straight into Anarchy AI with 1 click',
      '2. Instant AI Render: High-resolution (UHD 2560px) AI render with realistic architectural lighting',
      '3. Batch Scenes Export: Export and render all scene tabs across your SketchUp model in seconds',
      '4. Bi-directional Camera & BIM Metadata: Live FOV, perspective angles, and scene naming',
      '5. Compact Integrations Hub: Multi-drive custom folder installation and version detection',
    ],
    featureCards: [
      {
        icon: 'camera',
        title: '1. Send Viewport',
        description: 'Send current viewport to Anarchy AI to create realistic architectural visualizations and animations.',
      },
      {
        icon: 'lightning',
        title: '2. Instant AI Render',
        description: 'Generate an instant photorealistic AI render with a single click directly from SketchUp.',
      },
      {
        icon: 'expand',
        title: '3. Batch Scenes Export',
        description: 'Cycle through all saved SketchUp scene tabs automatically and render them in Anarchy AI.',
      },
      {
        icon: 'gear',
        title: '4. Native Toolbar & Settings',
        description: 'Automatic floating toolbar and Extensions menu inside SketchUp with live token authentication.',
      },
    ],
    graphicType: 'sketchup-suite',
    accentColor: '#e11d48',
  },
  {
    id: 'generate-refine-object-masks',
    badge: "What's new",
    title: 'Generate and refine object masks',
    subtitle: 'Create masks for objects in your image, load them into Draw, and refine the selected details with much greater precision.',
    description: 'Create masks for objects in your image, load them into Draw, and refine the selected details with much greater precision.',
    features: [
      'Select any object to automatically generate a focused mask',
      'Bring generated masks into Draw to refine the selection boundary',
      'Upscale or recolor selected elements without affecting the rest of the image',
    ],
    featureCards: [
      {
        icon: 'polygon',
        title: 'Generate masks for any object',
        description: 'Select the object you need and let Anarchy AI create a focused mask for it.',
      },
      {
        icon: 'image-plus',
        title: 'Load and refine masks',
        description: 'Bring generated masks into Draw and improve the selection before editing.',
      },
      {
        icon: 'expand',
        title: 'More precise edits',
        description: 'Upscale selected details or change their colors without affecting the rest of the image.',
      },
    ],
    graphicType: 'object-masks',
    accentColor: '#06b6d4',
  },
  {
    id: 'draw-precise-masks',
    badge: "What's new",
    title: 'Draw precise masks with the Mask Tool',
    subtitle: 'Create accurate masks by hand, convert them into an AI shape, and use the selected area as the foundation for a new generation.',
    description: 'Create accurate masks by hand, convert them into an AI shape, and use the selected area as the foundation for a new generation.',
    features: [
      'Mark exactly the area you want to use with the dedicated Mask Tool',
      'Turn your hand-drawn mask into a shape that Anarchy AI can use for generation',
      'Start a new generation focused on the shape and keep the edit under control',
    ],
    featureCards: [
      {
        icon: 'pen',
        title: 'Draw masks precisely',
        description: 'Mark exactly the area you want to use with the dedicated Mask Tool.',
      },
      {
        icon: 'ai-shape',
        title: 'Convert a mask to an AI shape',
        description: 'Turn your hand-drawn mask into a shape that Anarchy AI can use for AI generation.',
      },
      {
        icon: 'selection',
        title: 'Generate inside your selection',
        description: 'Start a new generation focused on the shape you created and keep the edit under control.',
      },
    ],
    graphicType: 'mask-tool',
    accentColor: '#06b6d4',
  },
  {
    id: '3dsmax-5tool-tip',
    badge: 'ⓘ 3ds Max Plugin Tip',
    title: 'The 3ds Max Toolbar Provides Five Tools',
    subtitle: 'Full 5-tool toolbar directly inside Autodesk 3ds Max for seamless 1-click workflows',
    description: 'The Anarchy AI toolbar provides five tools: Send Viewport, Send VFB, Instant Render, Batch Render, and Plugin Settings. If you don\'t see the plugin, please restart 3ds Max.',
    features: [
      '1. Send Viewport: Send current viewport to Anarchy AI to create realistic visualizations',
      '2. Send VFB: Send current render directly from the VFB to continue editing',
      '3. Instant Render: Generate an instant AI render with a single click',
      '4. Batch Render: Send views from all cameras in the scene with a single click',
      '5. Plugin Settings: Configure Instant Render and viewport export optimization settings',
    ],
    featureCards: [
      {
        icon: 'eye',
        title: '1. Send Viewport',
        description: 'Send the current viewport to Anarchy AI to create realistic visualizations and animations.',
      },
      {
        icon: 'teapot',
        title: '2. Send VFB',
        description: 'Send your current render directly from the VFB to Anarchy AI, then continue working on it by editing the visualization and creating animations.',
      },
      {
        icon: 'lightning',
        title: '3. Instant Render',
        description: 'Generate an instant AI render with a single click.',
      },
      {
        icon: 'camera',
        title: '4. Batch Render',
        description: 'Send views from all cameras in the scene with a single click and render them with AI in Anarchy AI.',
      },
      {
        icon: 'gear',
        title: '5. Plugin Settings',
        description: 'Configure Instant Render and viewport export optimization settings.',
      },
    ],
    graphicType: 'max-suite',
    accentColor: '#38bdf8',
  },
  {
    id: 'video-converter-suite',
    badge: 'Video Converter Plugin',
    title: 'Video converter plugin',
    subtitle: 'Downloading video converter... (Windows x64)',
    description: 'Download the video converter package directly to your Anarchy AI environment to unlock smooth camera animations, frame interpolation, and instant video exports.',
    features: [
      'Dedicated Windows x64 media converter package',
      'High-speed 1080p and 4K architectural video rendering',
      'Seamless timeline sync with Anarchy AI Canvas',
    ],
    featureCards: [
      {
        icon: 'play',
        title: 'Video converter package',
        description: 'Anarchy AI • Windows x64 dedicated converter package.',
      },
      {
        icon: 'lightning',
        title: 'GPU Accelerated Interpolation',
        description: 'Render smooth 60fps walkthroughs and architectural animations in seconds.',
      },
      {
        icon: 'selection',
        title: 'Builder Timeline Sync',
        description: 'Directly push generated video loops and turntable renders into your active canvas.',
      },
    ],
    graphicType: 'video-converter',
    accentColor: '#06b6d4',
  },
  {
    id: 'archvision-studio-2',
    badge: 'Major Release v0.3.96 | ArchVision AI Studio',
    title: 'ArchVision AI Agent Studio 2.0 & Interactive WebGL 3D Viewport',
    subtitle: 'Comprehensive Generative Studio: Interactive 3D Viewport, Deep Chain-of-Thought & Multi-Session Management',
    description: 'Major evolution for ArchVision AI Agent Studio: featuring an embedded interactive 3D WebGL massing viewport powered by Three.js, a 5-phase Deep Architectural Chain-of-Thought reasoning trace, persistent multi-session chat management with instant search, and autonomous 3ds Max and Canvas execution.',
    features: [
      'Embedded Three.js WebGL 3D massing viewport with dynamic sun cycles, wireframe mode, and auto-rotation',
      'Deep Architectural Chain-of-Thought auditing site constraints, building codes, and solar orientation',
      'Professional multi-session chat sidebar with real-time search, inline rename, and local persistence',
      'Direct procedural 3ds Max execution via CUA, AutoCAD DXF export, and automated BOQ Excel schedules',
      'Full English studio environment with one-click canvas node synchronization and visual prompt tuning',
    ],
    graphicType: 'agent',
    accentColor: '#ec4899',
  },
  {
    id: 'studio-workspace',
    badge: 'Studio Workspace v0.07',
    title: 'Infinite Canvas & Architectural Intelligence',
    subtitle: 'Interactive node-based workspace built for boundless creative exploration',
    description: 'Unlimited control over architectural ideation, branching, and comparison with high-performance GPU acceleration and permanent asset persistence via Cloudflare R2 and Supabase Storage.',
    features: [
      'Hardware-accelerated infinite canvas with smooth 60+ FPS navigation',
      'Instant node branching, image generation, and multi-version comparison',
      'Direct permanent cloud storage ensuring image URLs never expire or break',
    ],
    graphicType: 'canvas',
    accentColor: '#e11d48',
  },
  {
    id: 'studio-canvas-layers',
    badge: 'Studio Layers & Inpainting',
    title: 'Ultra-Fast Studio Canvas & Adjustment Dock',
    subtitle: 'Collapsible dock with professional retouching tools that never obscure your canvas',
    description: 'Upgraded mask and layer editor running at 120 FPS with direct ref-based drawing capture, zero-latency hardware cursor tracking, and live color adjustment curves (Levels, Exposure, Curves, Hue/Sat).',
    features: [
      'Collapsible Photoshop-style dock keeping your primary canvas unobstructed',
      'Real-time adjustment layers: Levels, Curves, Exposure, and Hue/Saturation',
      'Instant zero-latency drawing with GPU offscreen history snapshots',
    ],
    graphicType: 'layers',
    accentColor: '#38bdf8',
  },
  {
    id: 'architect-agent',
    badge: 'Resident Architectural Agent',
    title: 'Autonomous Architectural Agent with Strict Single-Model Routing',
    subtitle: 'Intelligent execution exclusively on your selected model with zero token waste',
    description: 'Agent inference is strictly dedicated to your chosen reasoning engine (Claude Sonnet 5.5, GPT-6.1 Sol, Grok 4.1), eliminating wasteful fallback loops while enabling live 3D procedural modeling in 3ds Max.',
    features: [
      'Dedicated routing to your selected model preventing parallel token consumption',
      'Deterministic building code and zoning audit (SBC, IBC, Municipal FAR/Setbacks)',
      'Direct bidirectional computer-use integration with Autodesk 3ds Max',
    ],
    graphicType: 'agent',
    accentColor: '#a855f7',
  },
  {
    id: 'rendering-engines',
    badge: 'Ultra Rendering Engines',
    title: 'FLUX 3 & Midjourney Turbo High-Resolution Upscaling',
    subtitle: 'Highest architectural fidelity with real-time super-resolution upscaling',
    description: 'Integrated high-throughput FLUX 3 and Midjourney Turbo engines delivering crisp 8K textures, razor-sharp building facades, and photorealistic daylighting without CDN expiration.',
    features: [
      'Instant Auto 1:1 initialization with FLUX 3 adaptive detail preservation',
      'Rapid super-resolution upscaling via Midjourney Turbo',
      'Bypasses CDN expiration limits while retaining 8K print-ready resolution',
    ],
    graphicType: 'rendering',
    accentColor: '#f59e0b',
  },
  {
    id: 'prompt-engineering',
    badge: 'Prompt Engineering',
    title: 'Photographic Architectural Prompt Synthesis',
    subtitle: 'Professional visual composition grounded in architectural photography standards',
    description: 'Updated prompt matrix calibrated with real architectural optics: 35mm Tilt-Shift lenses, Kelvin daylight balance (3200K–5600K), and authentic material textures (Travertine, Timber, Low-E glass).',
    features: [
      'Automated architectural prompt generation free of robotic filler words',
      'Precise material specifications: vein-cut travertine, white oak, anodized aluminum',
      'Realistic daylight distribution, bounce lighting, and geometric architectural shadows',
    ],
    graphicType: 'prompts',
    accentColor: '#10b981',
  },
];

const STORAGE_KEY = 'anarchy_whats_new_v0.3.100_seen';

const renderCardIcon = (icon: UpdateFeatureCard['icon'], color: string) => {
  switch (icon) {
    case 'polygon':
      return <Crop size={20} style={{ color }} />;
    case 'image-plus':
      return <ImagePlus size={20} style={{ color }} />;
    case 'expand':
      return <Maximize2 size={20} style={{ color }} />;
    case 'pen':
      return <PenTool size={20} style={{ color }} />;
    case 'ai-shape':
      return <Layers size={20} style={{ color }} />;
    case 'selection':
      return <Sparkles size={20} style={{ color }} />;
    case 'eye':
      return <Eye size={20} style={{ color }} />;
    case 'teapot':
      return <Coffee size={20} style={{ color }} />;
    case 'lightning':
      return <Zap size={20} style={{ color }} />;
    case 'camera':
      return <Video size={20} style={{ color }} />;
    case 'gear':
      return <Settings size={20} style={{ color }} />;
    case 'play':
      return <Play size={20} style={{ color }} />;
    default:
      return <Sparkles size={20} style={{ color }} />;
  }
};

export interface WhatsNewModalProps {
  forceOpen?: boolean;
  onCloseManual?: () => void;
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({
  forceOpen = false,
  onCloseManual,
}) => {
  const [isOpen, setIsOpen] = useState(forceOpen);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setActiveIndex(0);
    };
    window.addEventListener('anarchy:open-whats-new', handleOpen);
    return () => window.removeEventListener('anarchy:open-whats-new', handleOpen);
  }, []);

  useEffect(() => {
    if (forceOpen) {
      setIsOpen(true);
      return;
    }
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      const timer = setTimeout(() => setIsOpen(true), 600);
      return () => clearTimeout(timer);
    }
  }, [forceOpen]);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem(STORAGE_KEY, 'true');
    if (onCloseManual) onCloseManual();
  };

  const handleNext = () => {
    if (activeIndex < UPDATE_SLIDES.length - 1) {
      setActiveIndex((prev) => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) {
      setActiveIndex((prev) => prev - 1);
    }
  };

  // Keyboard navigation (Escape, ArrowLeft, ArrowRight)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') handleNext();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeIndex]);

  if (!isOpen) return null;

  const currentSlide = UPDATE_SLIDES[activeIndex];

  return (
    <div className="anarchy-wn-backdrop" onClick={handleClose}>
      <div className="anarchy-wn-card" onClick={(e) => e.stopPropagation()}>
        {/* Glow halo */}
        <div
          className="anarchy-wn-glow-orb"
          style={{ background: currentSlide.accentColor }}
        />

        {/* Header */}
        <div className="anarchy-wn-header">
          <div className="anarchy-wn-brand">
            <div className="anarchy-wn-logo-badge">A</div>
            <div>
              <div className="anarchy-wn-app-title">Anarchy AI Studio</div>
              <div className="anarchy-wn-version-tag">Release v0.3.100 Updates</div>
            </div>
          </div>
          <button
            type="button"
            className="anarchy-wn-close-btn"
            onClick={handleClose}
            title="Close Window (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="anarchy-wn-body">
          {/* Left: Interactive Graphic Illustration */}
          <div className="anarchy-wn-graphic-panel">
            <div className="anarchy-wn-graphic-canvas">
              {currentSlide.graphicType === 'canvas' && (
                <svg viewBox="0 0 320 240" className="anarchy-wn-svg-illu">
                  <defs>
                    <linearGradient id="gradNode1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#e11d48" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#881337" stopOpacity="0.4" />
                    </linearGradient>
                    <linearGradient id="gradNode2" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#0369a1" stopOpacity="0.4" />
                    </linearGradient>
                  </defs>
                  {/* Grid Lines */}
                  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                  </pattern>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                  {/* Connection Curve */}
                  <path
                    d="M 90 90 C 140 90, 150 150, 210 150"
                    fill="none"
                    stroke="#e11d48"
                    strokeWidth="3"
                    strokeDasharray="6 4"
                    className="anarchy-wn-pulse-line"
                  />
                  {/* Node 1 */}
                  <rect x="30" y="55" width="85" height="70" rx="10" fill="url(#gradNode1)" stroke="#e11d48" strokeWidth="1.5" />
                  <rect x="40" y="65" width="65" height="36" rx="4" fill="rgba(0,0,0,0.5)" />
                  <circle cx="72" cy="83" r="10" fill="#e11d48" opacity="0.8" />
                  <rect x="40" y="108" width="45" height="6" rx="3" fill="#ffffff" opacity="0.7" />
                  {/* Node 2 */}
                  <rect x="200" y="115" width="95" height="80" rx="10" fill="url(#gradNode2)" stroke="#38bdf8" strokeWidth="1.5" />
                  <rect x="210" y="125" width="75" height="44" rx="4" fill="rgba(0,0,0,0.5)" />
                  <rect x="210" y="176" width="55" height="6" rx="3" fill="#38bdf8" opacity="0.8" />
                </svg>
              )}

              {currentSlide.graphicType === 'layers' && (
                <svg viewBox="0 0 320 240" className="anarchy-wn-svg-illu">
                  <defs>
                    <linearGradient id="gradCurve" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                  {/* Background Board */}
                  <rect x="40" y="30" width="240" height="180" rx="12" fill="#18181b" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
                  {/* Histogram Bars */}
                  <g opacity="0.25">
                    {[15, 35, 60, 90, 110, 80, 50, 40, 25, 10].map((h, i) => (
                      <rect key={i} x={60 + i * 20} y={190 - h} width="16" height={h} fill="#38bdf8" rx="2" />
                    ))}
                  </g>
                  {/* Curves Grid */}
                  <line x1="60" y1="190" x2="260" y2="190" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <line x1="60" y1="50" x2="60" y2="190" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <path
                    d="M 60 190 Q 130 180, 160 120 T 260 50"
                    fill="none"
                    stroke="url(#gradCurve)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  {/* Control Points */}
                  <circle cx="60" cy="190" r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
                  <circle cx="160" cy="120" r="6" fill="#a855f7" stroke="#ffffff" strokeWidth="2.5" />
                  <circle cx="260" cy="50" r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
                  {/* Mask Brush Laser Ring */}
                  <circle cx="210" cy="140" r="22" fill="rgba(225,29,72,0.2)" stroke="#e11d48" strokeWidth="2" strokeDasharray="4 2" />
                  <circle cx="210" cy="140" r="2" fill="#ffffff" />
                </svg>
              )}

              {currentSlide.graphicType === 'agent' && (
                <svg viewBox="0 0 320 240" className="anarchy-wn-svg-illu">
                  <defs>
                    <linearGradient id="gradBlueprint" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#1e1b4b" />
                      <stop offset="100%" stopColor="#0f172a" />
                    </linearGradient>
                  </defs>
                  <rect x="30" y="30" width="260" height="180" rx="12" fill="url(#gradBlueprint)" stroke="#6366f1" strokeWidth="1.5" />
                  {/* Architectural Blueprint Isometric House */}
                  <g transform="translate(160, 120)" stroke="#a855f7" strokeWidth="2" fill="none" strokeLinejoin="round">
                    {/* Main Mass */}
                    <path d="M 0 -50 L 60 -20 L 0 10 L -60 -20 Z" fill="rgba(168,85,247,0.15)" />
                    <path d="M -60 -20 L 0 10 L 0 60 L -60 30 Z" fill="rgba(99,102,241,0.2)" />
                    <path d="M 0 10 L 60 -20 L 60 30 L 0 60 Z" fill="rgba(147,51,234,0.3)" />
                    {/* Cantilever Box */}
                    <path d="M -20 -30 L 40 0 L 40 25 L -20 -5 Z" fill="rgba(56,189,248,0.3)" stroke="#38bdf8" />
                    {/* Dimension Lines */}
                    <line x1="-70" y1="-20" x2="-70" y2="30" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 3" />
                    <line x1="-60" y1="40" x2="0" y2="70" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 3" />
                  </g>
                  {/* Badge */}
                  <rect x="45" y="45" width="85" height="22" rx="11" fill="rgba(168,85,247,0.25)" stroke="#a855f7" strokeWidth="1" />
                  <text x="87" y="60" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold">3ds Max • BIM</text>
                </svg>
              )}

              {currentSlide.graphicType === 'rendering' && (
                <svg viewBox="0 0 320 240" className="anarchy-wn-svg-illu">
                  <defs>
                    <linearGradient id="gradFlame" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#b45309" />
                    </linearGradient>
                  </defs>
                  {/* Outer Frame */}
                  <rect x="40" y="30" width="240" height="180" rx="12" fill="#18181b" stroke="#f59e0b" strokeWidth="1.5" />
                  {/* Lightning / Turbo Speed */}
                  <path
                    d="M 170 45 L 125 125 L 160 125 L 140 195 L 205 110 L 165 110 Z"
                    fill="url(#gradFlame)"
                    filter="drop-shadow(0 0 14px rgba(245,158,11,0.6))"
                  />
                  {/* Super-Resolution Grid overlay */}
                  <g opacity="0.3" stroke="#f59e0b" strokeWidth="1">
                    <line x1="60" y1="70" x2="100" y2="70" />
                    <line x1="60" y1="90" x2="110" y2="90" />
                    <line x1="220" y1="150" x2="260" y2="150" />
                    <line x1="210" y1="170" x2="260" y2="170" />
                  </g>
                  <rect x="185" y="45" width="80" height="22" rx="11" fill="rgba(245,158,11,0.2)" stroke="#f59e0b" strokeWidth="1" />
                  <text x="225" y="60" textAnchor="middle" fill="#fef08a" fontSize="10" fontWeight="bold">MJ Turbo ⚡</text>
                </svg>
              )}

              {currentSlide.graphicType === 'prompts' && (
                <svg viewBox="0 0 320 240" className="anarchy-wn-svg-illu">
                  <defs>
                    <linearGradient id="gradAperture" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#047857" />
                    </linearGradient>
                  </defs>
                  <rect x="40" y="30" width="240" height="180" rx="12" fill="#064e3b" stroke="#10b981" strokeWidth="1.5" opacity="0.4" />
                  {/* Camera Aperture / Lens Rings */}
                  <circle cx="160" cy="120" r="55" fill="none" stroke="#10b981" strokeWidth="2.5" />
                  <circle cx="160" cy="120" r="42" fill="none" stroke="#34d399" strokeWidth="1.5" strokeDasharray="6 3" />
                  <circle cx="160" cy="120" r="24" fill="rgba(16,185,129,0.3)" stroke="#10b981" strokeWidth="2" />
                  {/* Crosshair */}
                  <line x1="160" y1="50" x2="160" y2="190" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <line x1="90" y1="120" x2="230" y2="120" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                  <text x="160" y="195" textAnchor="middle" fill="#6ee7b7" fontSize="10" fontWeight="bold">35mm • Tilt-Shift • 3200K</text>
                </svg>
              )}

              {currentSlide.graphicType === 'object-masks' && (
                <svg viewBox="0 0 320 240" className="anarchy-wn-svg-illu">
                  <defs>
                    <linearGradient id="gradMaskBg" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#083344" />
                      <stop offset="100%" stopColor="#0f172a" />
                    </linearGradient>
                  </defs>
                  <rect x="30" y="30" width="260" height="180" rx="12" fill="url(#gradMaskBg)" stroke="#06b6d4" strokeWidth="1.5" />
                  {/* Image Facade mockup */}
                  <rect x="50" y="55" width="220" height="130" rx="8" fill="#131722" stroke="rgba(255,255,255,0.08)" />
                  <g opacity="0.3" stroke="#64748b" strokeWidth="1">
                    <line x1="60" y1="90" x2="260" y2="90" />
                    <line x1="60" y1="130" x2="260" y2="130" />
                    <line x1="120" y1="65" x2="120" y2="175" />
                    <line x1="200" y1="65" x2="200" y2="175" />
                  </g>
                  {/* Selected Object Polygon Contour (glowing cyan) */}
                  <polygon
                    points="95,85 175,75 215,115 185,160 85,150 75,110"
                    fill="rgba(6,182,212,0.25)"
                    stroke="#22d3ee"
                    strokeWidth="2.5"
                    strokeDasharray="6 3"
                  />
                  {/* Anchor vertices */}
                  {[
                    [95, 85], [175, 75], [215, 115], [185, 160], [85, 150], [75, 110]
                  ].map(([x, y], idx) => (
                    <circle key={idx} cx={x} cy={y} r="4" fill="#ffffff" stroke="#06b6d4" strokeWidth="2" />
                  ))}
                  {/* Badge */}
                  <rect x="105" y="42" width="110" height="20" rx="10" fill="rgba(6,182,212,0.2)" stroke="#06b6d4" strokeWidth="1" />
                  <text x="160" y="56" textAnchor="middle" fill="#67e8f9" fontSize="9" fontWeight="bold">✦ Object Mask Active</text>
                </svg>
              )}

              {currentSlide.graphicType === 'mask-tool' && (
                <svg viewBox="0 0 320 240" className="anarchy-wn-svg-illu">
                  <defs>
                    <linearGradient id="gradDrawBg" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#042f2e" />
                      <stop offset="100%" stopColor="#09111e" />
                    </linearGradient>
                  </defs>
                  <rect x="30" y="30" width="260" height="180" rx="12" fill="url(#gradDrawBg)" stroke="#06b6d4" strokeWidth="1.5" />
                  {/* Grid Lines */}
                  <g opacity="0.15" stroke="#22d3ee" strokeWidth="1">
                    {[60, 90, 120, 150, 180].map(y => <line key={y} x1="40" y1={y} x2="280" y2={y} />)}
                    {[70, 110, 150, 190, 230].map(x => <line key={x} x1={x} y1="40" x2={x} y2="200" />)}
                  </g>
                  {/* Hand drawn mask shape */}
                  <path
                    d="M 80 140 C 90 90, 140 70, 180 85 C 220 100, 240 145, 210 165 C 180 185, 120 175, 80 140 Z"
                    fill="rgba(6, 182, 212, 0.28)"
                    stroke="#22d3ee"
                    strokeWidth="3"
                  />
                  {/* Dashed Bounding Box (AI Shape conversion) */}
                  <rect x="70" y="70" width="165" height="115" rx="6" fill="none" stroke="#67e8f9" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.7" />
                  {/* Pen marker cursor */}
                  <g transform="translate(190, 85)">
                    <circle cx="0" cy="0" r="10" fill="rgba(6,182,212,0.4)" />
                    <circle cx="0" cy="0" r="3" fill="#ffffff" />
                  </g>
                  {/* AI Stars */}
                  <path d="M 230 75 L 233 82 L 240 85 L 233 88 L 230 95 L 227 88 L 220 85 L 227 82 Z" fill="#22d3ee" />
                  <text x="160" y="200" textAnchor="middle" fill="#67e8f9" fontSize="10" fontWeight="bold">Mask → AI Shape Foundation</text>
                </svg>
              )}

              {currentSlide.graphicType === 'max-suite' && (
                <svg viewBox="0 0 320 240" className="anarchy-wn-svg-illu">
                  {/* Dark 3ds Max Viewport Window (Screenshot 1 Recreated) */}
                  <rect x="20" y="20" width="280" height="200" rx="8" fill="#1c1d22" stroke="#333842" strokeWidth="1.5" />
                  {/* Title Bar */}
                  <rect x="20" y="20" width="280" height="18" fill="#282a32" />
                  <rect x="25" y="24" width="10" height="10" rx="2" fill="#0284c7" />
                  <text x="40" y="32" fill="#cbd5e1" fontSize="7" fontFamily="sans-serif">Untitled - Autodesk 3ds Max 2026</text>
                  {/* Menu items row */}
                  <rect x="20" y="38" width="280" height="14" fill="#20222a" />
                  <text x="26" y="48" fill="#94a3b8" fontSize="6" fontFamily="sans-serif">File  Edit  Tools  Group  Views  Create  Modifiers  Animation</text>
                  {/* Viewport View Grid */}
                  <g opacity="0.12" stroke="#94a3b8" strokeWidth="0.8">
                    {[70, 95, 120, 145, 170, 195].map(y => <line key={y} x1="20" y1={y} x2="300" y2={y} />)}
                    {[55, 95, 135, 175, 215, 255].map(x => <line key={x} x1={x} y1="52" x2={x} y2="220" />)}
                  </g>
                  {/* Vertical Docked Toolbar Container with Dashed Outline */}
                  <rect x="26" y="60" width="34" height="145" rx="6" fill="#2b2d35" stroke="#ffffff" strokeWidth="1.2" strokeDasharray="3 3" />
                  {/* 5 Stacked Tool Buttons */}
                  {/* 1. Eye (Viewport) */}
                  <g transform="translate(30, 64)">
                    <rect x="0" y="0" width="26" height="24" rx="4" fill="#383b45" />
                    <circle cx="13" cy="12" r="7" fill="none" stroke="#38bdf8" strokeWidth="1.2" />
                    <circle cx="13" cy="12" r="2.5" fill="#38bdf8" />
                  </g>
                  {/* 2. Teapot (VFB) */}
                  <g transform="translate(30, 92)">
                    <rect x="0" y="0" width="26" height="24" rx="4" fill="#383b45" />
                    <ellipse cx="13" cy="13" rx="6" ry="5" fill="#38bdf8" opacity="0.8" />
                    <rect x="10" y="6" width="6" height="2" fill="#38bdf8" />
                  </g>
                  {/* 3. Lightning (Instant Render) */}
                  <g transform="translate(30, 120)">
                    <rect x="0" y="0" width="26" height="24" rx="4" fill="#383b45" />
                    <path d="M 14 4 L 9 13 L 13 13 L 11 20 L 17 11 L 13 11 Z" fill="#38bdf8" />
                  </g>
                  {/* 4. Camera (Batch Render) */}
                  <g transform="translate(30, 148)">
                    <rect x="0" y="0" width="26" height="24" rx="4" fill="#383b45" />
                    <rect x="6" y="8" width="10" height="8" rx="1.5" fill="#38bdf8" />
                    <polygon points="16,10 20,7 20,17 16,14" fill="#38bdf8" />
                  </g>
                  {/* 5. Gear (Settings) */}
                  <g transform="translate(30, 176)">
                    <rect x="0" y="0" width="26" height="24" rx="4" fill="#383b45" />
                    <circle cx="13" cy="12" r="4.5" fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="3 1.5" />
                  </g>

                  {/* Numbers 1, 2, 3, 4, 5 */}
                  <text x="70" y="81" fill="#ffffff" fontSize="16" fontWeight="900" fontFamily="sans-serif">1</text>
                  <text x="70" y="109" fill="#ffffff" fontSize="16" fontWeight="900" fontFamily="sans-serif">2</text>
                  <text x="70" y="137" fill="#ffffff" fontSize="16" fontWeight="900" fontFamily="sans-serif">3</text>
                  <text x="70" y="165" fill="#ffffff" fontSize="16" fontWeight="900" fontFamily="sans-serif">4</text>
                  <text x="70" y="193" fill="#ffffff" fontSize="16" fontWeight="900" fontFamily="sans-serif">5</text>

                  {/* Big White Pointing Arrow (Matching Screenshot 1) */}
                  <polygon
                    points="95,137 145,105 145,123 215,123 215,151 145,151 145,169"
                    fill="#ffffff"
                    filter="drop-shadow(0 4px 10px rgba(0,0,0,0.6))"
                  />
                </svg>
              )}

              {currentSlide.graphicType === 'video-converter' && (
                <svg viewBox="0 0 320 240" className="anarchy-wn-svg-illu">
                  <defs>
                    <linearGradient id="gradVcChip" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#0891b2" stopOpacity="0.1" />
                    </linearGradient>
                  </defs>
                  {/* Dark base station */}
                  <rect x="40" y="30" width="240" height="180" rx="12" fill="#0f172a" stroke="#06b6d4" strokeWidth="1.5" />
                  {/* Orbit ring */}
                  <ellipse cx="160" cy="140" rx="90" ry="24" stroke="#06b6d4" strokeWidth="1.2" strokeDasharray="6 4" opacity="0.6" />
                  {/* Floating Media Chip Plate */}
                  <g transform="translate(115, 60)">
                    <rect x="0" y="0" width="90" height="95" rx="12" fill="url(#gradVcChip)" stroke="#22d3ee" strokeWidth="2" transform="skewY(-8)" />
                    {/* Play symbol */}
                    <circle cx="45" cy="45" r="18" fill="rgba(6,182,212,0.3)" stroke="#22d3ee" strokeWidth="1.5" transform="skewY(-8)" />
                    <polygon points="40,37 54,45 40,53" fill="#ffffff" transform="skewY(-8)" />
                  </g>
                  {/* Beaming download arrow */}
                  <path d="M 160 140 L 160 170 M 150 160 L 160 170 L 170 160" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  {/* Base light */}
                  <ellipse cx="160" cy="180" rx="40" ry="10" fill="rgba(6,182,212,0.4)" stroke="#06b6d4" strokeWidth="2" />
                  <text x="160" y="204" textAnchor="middle" fill="#67e8f9" fontSize="9" fontWeight="bold">Video Converter Package • Win x64</text>
                </svg>
              )}

              {currentSlide.graphicType === 'sketchup-suite' && (
                <svg viewBox="0 0 320 240" className="anarchy-wn-svg-illu">
                  <defs>
                    <linearGradient id="gradSuBg" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#1e2029" />
                      <stop offset="100%" stopColor="#111217" />
                    </linearGradient>
                    <linearGradient id="gradSuToolbar" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#2c2d36" />
                      <stop offset="100%" stopColor="#1e1f26" />
                    </linearGradient>
                  </defs>
                  {/* SketchUp Window Outline */}
                  <rect x="20" y="20" width="280" height="200" rx="8" fill="url(#gradSuBg)" stroke="#3f414d" strokeWidth="1.5" />
                  
                  {/* Title Bar with SketchUp Red Accent */}
                  <rect x="20" y="20" width="280" height="20" fill="#252630" rx="8" />
                  <rect x="20" y="32" width="280" height="8" fill="#252630" />
                  {/* SketchUp Red 3D Cube Icon */}
                  <rect x="28" y="24" width="12" height="12" rx="2" fill="#ef4444" />
                  <polygon points="34,25 38,27 38,33 34,35 30,33 30,27" fill="#ffffff" opacity="0.9" />
                  <text x="46" y="33" fill="#cbd5e1" fontSize="7.5" fontWeight="bold" fontFamily="sans-serif">Untitled - Trimble SketchUp Pro 2026</text>

                  {/* Menu bar row */}
                  <rect x="20" y="40" width="280" height="13" fill="#1b1c22" />
                  <text x="28" y="49" fill="#94a3b8" fontSize="6" fontFamily="sans-serif">File  Edit  View  Camera  Draw  Tools  Window  Extensions</text>

                  {/* 3D Origin Axes (Red X, Green Y, Blue Z) */}
                  <g opacity="0.6">
                    {/* Z Axis (Blue Up) */}
                    <line x1="160" y1="130" x2="160" y2="60" stroke="#3b82f6" strokeWidth="1.5" />
                    {/* X Axis (Red Right) */}
                    <line x1="160" y1="130" x2="260" y2="165" stroke="#ef4444" strokeWidth="1.5" />
                    {/* Y Axis (Green Left/Back) */}
                    <line x1="160" y1="130" x2="70" y2="155" stroke="#22c55e" strokeWidth="1.5" />
                  </g>

                  {/* 3D Massing Building in SketchUp */}
                  <g transform="translate(170, 115)" stroke="#64748b" strokeWidth="1.2">
                    {/* Main Building Body */}
                    <polygon points="0,-40 45,-20 0,5 -45,-15" fill="rgba(241, 245, 249, 0.85)" stroke="#0f172a" />
                    <polygon points="-45,-15 0,5 0,45 -45,25" fill="rgba(203, 213, 225, 0.75)" stroke="#0f172a" />
                    <polygon points="0,5 45,-20 45,20 0,45" fill="rgba(148, 163, 184, 0.9)" stroke="#0f172a" />
                    {/* Glass Cantilever Corner */}
                    <polygon points="5,-10 35,5 35,25 5,10" fill="rgba(6, 182, 212, 0.55)" stroke="#06b6d4" strokeWidth="1" />
                  </g>

                  {/* Floating "Anarchy AI" Toolbar in SketchUp */}
                  <g transform="translate(28, 62)">
                    {/* Toolbar Container */}
                    <rect x="0" y="0" width="36" height="126" rx="6" fill="url(#gradSuToolbar)" stroke="#ef4444" strokeWidth="1.5" filter="drop-shadow(0 4px 12px rgba(0,0,0,0.5))" />
                    <rect x="2" y="2" width="32" height="12" rx="4" fill="#ef4444" />
                    <text x="18" y="10" textAnchor="middle" fill="#ffffff" fontSize="5.5" fontWeight="bold">Anarchy</text>

                    {/* Tool 1: Camera (Send Viewport) */}
                    <g transform="translate(5, 18)">
                      <rect x="0" y="0" width="26" height="23" rx="4" fill="#292a34" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
                      <circle cx="13" cy="11.5" r="5.5" fill="none" stroke="#ef4444" strokeWidth="1.4" />
                      <circle cx="13" cy="11.5" r="2" fill="#ef4444" />
                    </g>

                    {/* Tool 2: Instant Render (Sparkle / Lightning) */}
                    <g transform="translate(5, 44)">
                      <rect x="0" y="0" width="26" height="23" rx="4" fill="#292a34" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
                      <path d="M 14 4 L 9 12 L 13 12 L 11 19 L 17 11 L 13 11 Z" fill="#f59e0b" />
                    </g>

                    {/* Tool 3: Batch Scenes (Stacked Layers) */}
                    <g transform="translate(5, 70)">
                      <rect x="0" y="0" width="26" height="23" rx="4" fill="#292a34" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
                      <rect x="7" y="5" width="12" height="8" rx="1.5" fill="none" stroke="#94a3b8" strokeWidth="1" />
                      <rect x="5" y="9" width="12" height="8" rx="1.5" fill="none" stroke="#ef4444" strokeWidth="1.2" />
                    </g>

                    {/* Tool 4: Settings (Gear) */}
                    <g transform="translate(5, 96)">
                      <rect x="0" y="0" width="26" height="23" rx="4" fill="#292a34" stroke="rgba(255,255,255,0.1)" strokeWidth="0.8" />
                      <circle cx="13" cy="11.5" r="4.5" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3 1.5" />
                    </g>
                  </g>

                  {/* Highlighting Arrow from Toolbar to Model */}
                  <path d="M 72 105 L 115 105 M 107 98 L 115 105 L 107 112" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

                  {/* Bridge Status Indicator Pill */}
                  <g transform="translate(145, 190)">
                    <rect x="0" y="0" width="145" height="18" rx="9" fill="rgba(15, 23, 42, 0.85)" stroke="#22c55e" strokeWidth="1" />
                    <circle cx="12" cy="9" r="3.5" fill="#22c55e" />
                    <text x="22" y="12.5" fill="#f8fafc" fontSize="6.8" fontWeight="600" fontFamily="sans-serif">Bridge Online: 127.0.0.1:14400</text>
                  </g>
                </svg>
              )}
            </div>

            {/* Slide Index Pill */}
            <div className="anarchy-wn-step-indicator">
              Slide {activeIndex + 1} of {UPDATE_SLIDES.length}
            </div>
          </div>

          {/* Right: Text Details & Feature Highlights */}
          <div className="anarchy-wn-text-panel">
            <div
              className="anarchy-wn-badge-chip"
              style={{
                color: currentSlide.accentColor,
                borderColor: `${currentSlide.accentColor}55`,
                background: `${currentSlide.accentColor}18`,
              }}
            >
              <Sparkles size={13} />
              <span>{currentSlide.badge}</span>
            </div>

            <h2 className="anarchy-wn-slide-title">{currentSlide.title}</h2>
            <h4 className="anarchy-wn-slide-subtitle">{currentSlide.subtitle}</h4>
            <p className="anarchy-wn-slide-desc">{currentSlide.description}</p>

            {currentSlide.featureCards && currentSlide.featureCards.length > 0 ? (
              <div className="anarchy-wn-card-stack">
                {currentSlide.featureCards.map((card, i) => (
                  <div key={i} className="anarchy-wn-feature-card">
                    <div
                      className="anarchy-wn-feature-card-icon"
                      style={{
                        borderColor: `${currentSlide.accentColor}44`,
                        background: `${currentSlide.accentColor}14`,
                      }}
                    >
                      {renderCardIcon(card.icon, currentSlide.accentColor)}
                    </div>
                    <div className="anarchy-wn-feature-card-text">
                      <div className="anarchy-wn-feature-card-title">{card.title}</div>
                      <div className="anarchy-wn-feature-card-desc">{card.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="anarchy-wn-features-list">
                {currentSlide.features.map((feat, i) => (
                  <div key={i} className="anarchy-wn-feature-item">
                    <CheckCircle2
                      size={16}
                      style={{ color: currentSlide.accentColor, flexShrink: 0, marginTop: '2px' }}
                    />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Navigation Bar */}
        <div className="anarchy-wn-footer">
          {/* Dots Indicator */}
          <div className="anarchy-wn-dots">
            {UPDATE_SLIDES.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                className={`anarchy-wn-dot ${i === activeIndex ? 'active' : ''}`}
                style={{
                  background: i === activeIndex ? slide.accentColor : undefined,
                }}
                onClick={() => setActiveIndex(i)}
                title={slide.title}
              />
            ))}
          </div>

          {/* Buttons Group */}
          <div className="anarchy-wn-btn-group">
            {activeIndex > 0 && (
              <button
                type="button"
                className="anarchy-wn-prev-btn"
                onClick={handlePrev}
              >
                <ChevronLeft size={16} />
                <span>Previous</span>
              </button>
            )}

            <button
              type="button"
              className="anarchy-wn-next-btn"
              style={{
                background: currentSlide.accentColor,
                boxShadow: `0 4px 20px ${currentSlide.accentColor}55`,
              }}
              onClick={handleNext}
            >
              <span>{activeIndex === UPDATE_SLIDES.length - 1 ? 'Get Started' : 'Next'}</span>
              {activeIndex === UPDATE_SLIDES.length - 1 ? (
                <Rocket size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
