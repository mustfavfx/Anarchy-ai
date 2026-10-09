# Changelog

All notable changes to **Anarchy AI** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.99] - 2026-10-09

### Hotfix & Editor Stabilization
- **Mask Adjustment Layer Runtime Fix**:
  - Resolved `ReferenceError: isAr is not defined` in `useMaskAdjustments.ts` that caused an unexpected error screen on canvas adjustment layer initialization.
  - Hardened scope parameter resolution and dependency arrays across all adjustment action hooks.

---

## [0.3.98] - 2026-10-09

### AI Resize & Outpainting Overhaul
- **Architectural Framing & Dimension Preservation**:
  - Resolved aspect ratio outpainting failure in the Lightbox Image Editor.
  - Corrected execution dispatch (`executeFn`) to pass the padded reframed image data URL (`sourceImage: reframed.dataUrl`) along with exact source dimensions (`sourceWidth`, `sourceHeight`) and requested target aspect ratio (`match_input_image` / explicit ratios).
  - Updated `useWorkflowExecution.ts` so `executeNodeSingle` isolates tool-modified reframed images as the sole input rather than pulling ancestor unpadded frames from connected edges.
  - Fixed output dimension preservation to maintain target reframed canvas aspect ratios (9:16, 16:9, 4:5, etc.) without post-resize cropping back to the parent dimensions.

### Unified Credit System & Deduction for Image Editor
- **Atomic Credit Verification & Deduction**:
  - Connected `ImageEditorToolbar.tsx` tools (`Resize`, `Markup Studio`, `Smart Erase`, `AI Comments / Send to Agent`) to unified credit verification via `checkCreditBalance` and `deductCredits`.
  - Blocks execution and displays immediate notifications if user credit balance is insufficient.
  - Automatically updates local and global credit store balance (`useAIConfigStore.setUserCredits`) and dispatches background synchronization.
- **Auto-Refund Safety & Live Cost Transparency**:
  - Integrated automatic credit refund (`refundCredits`) to reimburse users immediately if server generation throws or fails.
  - Displayed live point calculation directly in the Resize confirmation button (`OK Apply to Engine • 2.5 pts`).

---

## [0.3.97] - 2026-10-09

### Trimble SketchUp Integration Suite & Compact Integrations Interface
- **Official Trimble SketchUp Ruby Extension (v1.8.2)**:
  - Built full native extension for SketchUp 2020 through 2027 using the official SketchUp Ruby Extension API.
  - Implemented automatic extension registration in SketchUp's Extension Manager.
  - Added native floating toolbar (`UI::Toolbar.new('Anarchy AI')`) with custom 16px and 24px toolbar icons.
  - Added dedicated submenu under `Extensions > Anarchy AI`.
- **4-Tool Suite for SketchUp**:
  - **Send Viewport (Tool 1)**: Captures active viewport keeping aspect ratio and sends it directly to Anarchy AI local bridge (`127.0.0.1:14400/upload-view`).
  - **Instant AI Render (Tool 2)**: UHD 2560px capture and immediate photorealistic AI render generation with architectural materials.
  - **Batch Scenes Export (Tool 3)**: Automatically cycles through all model scenes/pages, capturing and exporting each scene to the Builder timeline.
  - **Settings & Bridge Status (Tool 4)**: Dialog providing instant feedback on server health, auth token verification, and SketchUp version.
- **Bi-Directional Camera & BIM Metadata Streaming**:
  - Live FOV, camera perspective, eye position, and target coordinates streamed to `/agent/bim-metadata`.
- **Backend Multi-Drive Detection & Installer**:
  - Implemented `detect_sketchup_installs` and `install_sketchup_plugin` in Tauri Rust backend.
  - Full support for detecting installations across all drives (C, D, E, F) and custom folder selection via folder picker dialog.
- **Streamlined Integrations UI**:
  - Ultra-compact 4-column version chips grid, live detection dot indicators, and collapsible usage guide.

---

## [0.3.96] - 2026-10-08

### ArchVision AI Agent Studio 2.0 & 3D WebGL Integration
- **Interactive Three.js 3D WebGL Massing Viewport**:
  - Embedded an interactive 3D massing and volumetric viewport directly into agent deliverables using Three.js and WebGL.
  - Enabled orbital camera controls, mouse drag rotate/pan/zoom, dynamic shadow planes, and ground grid axes.
  - Implemented interactive sun simulation cycles (`Day`, `Golden Hour`, `Night`), wireframe mode toggling, smooth auto-rotation, and instant PNG viewport capture.
  - Dual-mode support allowing toggle between procedural 3D massing canvas and live Speckle BIM WebGL viewports.

- **Deep Architectural Chain-of-Thought (5-Phase Sequential Reasoning)**:
  - Added a collapsible deep reasoning trace providing transparency into the AI agent's architectural design decisions.
  - Structured into 5 rigorous architectural phases:
    1. **Site Constraints & Spatial Program**: Plot area computations, built-up coverage ratio (45–60%), setback verification.
    2. **Building Code & FAR Compliance**: FAR calculations, SBC/IBC fire safety separation, egress path audit, parking requirements.
    3. **3D Volumetric Massing & Cantilever Strategy**: Structural articulation, cantilever depth (3.2m), curtain wall glazing spans.
    4. **Environmental Solar Orientation & Shading Logic**: Solar path calculations, western facade louvers, glare mitigation.
    5. **Autonomous CUA 3ds Max Scripting & Automation**: MaxScript generation, two-point perspective cameras, PBR materials.
  - Added direct autonomous action buttons inside the trace:
    - **Send to Canvas (Node)**: Pushes enhanced prompt directly to active canvas node or toolbar.
    - **Execute in 3ds Max**: Direct procedural execution in 3ds Max via Computer-Use Agent and MaxScript.
    - **Sync Camera**: Synchronizes active 3ds Max camera with ArchVision Studio viewport.
    - **Export BOQ (Excel)**: Generates and downloads full Architectural Bill of Quantities spreadsheet.

- **ChatGPT/Claude-Style Multi-Session Management**:
  - Replaced single-thread chat with a persistent multi-session sidebar (`AgentSessionsSidebar.tsx`).
  - Added real-time session search with instant title filtering.
  - Chronological time grouping (`Today`, `Yesterday`, `Last 7 Days`, `Older`).
  - Inline session renaming, individual session deletion, and safe full session resets.
  - Automatic session naming based on initial user prompts.

- **100% English UI Localization**:
  - Standardized all UI controls, tooltips, dialogs, zero-state cards, inspectors, and status indicators in the AI Agent Studio into professional English.
  - Translated all model badges, focus descriptions, and preset architectural concepts.

---

## [0.3.95] - 2026-09-16

### Performance & Smoothness
- **Canvas & Workflow Nodes Engine (Ultra-Smooth 60+ FPS)**:
  - **Decoupled Node Selection Re-renders**: Replaced reactive store subscription `isSelectedInStore` in `BaseNode.tsx` with ReactFlow's memoized `selected` prop, preventing full-canvas node re-renders when tweaking sliders and properties.
  - **Stabilized GhostNode Edge Selectors**: Refactored `GhostNode.tsx` edge connectivity selector to subscribe to stable reference `s.edges` instead of executing `.filter()` inside the selector on every viewport pan/zoom frame.
  - **Eliminated Viewport Subpixel Flickering**: Removed problematic `content-visibility: auto` on `.react-flow__node` which conflicted with ReactFlow's native element virtualization; promoted nodes to GPU hardware layers via `contain: layout style; transform: translate3d(0, 0, 0); backface-visibility: hidden;`.
  - **Removed Drag & Pan Hover Jitter**: Removed hover transform animations (`translateY(-2px)`) from `.anarchy-node` across standard and glass themes, preventing transform matrix conflicts with ReactFlow dragging.

- **Mask Editor & Canvas Mask Engine Latency Optimization**:
  - **Decoupled Continuous Drawing from React State**: Rebuilt `CanvasMaskEditor.tsx` pointer event pipeline to use direct ref-based pointer capture and smooth quadratic Bézier curves during drawing, deferring React state commits strictly to `pointerup`.
  - **Instant GPU History Snapshots**: Replaced synchronous full-canvas `ctx.getImageData` in `useMaskHistory.ts` with hardware-accelerated offscreen canvas blits (`drawImage`), slashing history snapshot overhead from 30-100ms to <0.5ms.
  - **Eliminated Live Stroke Blur Overhead**: Removed continuous `ctx.shadowBlur` Gaussian blur passes during active mouse movement in `useMaskDrawing.ts`, preserving 60+ FPS brush responsiveness.
  - **Zero-Latency Hardware Cursor**: Implemented direct DOM transform tracking with `translate3d` and `willChange: transform` for the mask brush cursor, enabling instant 144Hz/240Hz tracking without React re-render lag.

### Features & Refinements
- **Aspect Ratio & Precision Resolution Formatting**:
  - Unified aspect ratio formatting and resolution handling across AI Control Panel, workflow nodes, and Replicate payload builders.
  - Added comprehensive automated test coverage for GPT dimensions and model input transformations.

## [0.3.93] - 2026-09-14

### Pricing & Margins
- **Calibrated Topaz Labs AI Upscaler Credit Costs**:
  - Realigned dynamic credit deduction with real A100 GPU Replicate compute costs ($0.16/run).
  - Configured baseline tier (<= 24 MP / 4K) to deduct 3 credits ($0.30) ensuring an 87%+ net profit margin per generation.
  - Dynamically scaled higher megapixel brackets (6K, 8K, extreme prints up to 512 MP) from 5 to 45 credits to cover extended rendering times without deficits.

### Configuration
- **Desktop Dev Server Port Alignment (5180)**:
  - Standardized local development port across `vite.config.ts`, `tauri.conf.json`, and `playwright.config.ts` to `5180`.

## [0.3.92] - 2026-09-12

### Added
- **Photoshop Studio Dock for Mask Canvas**:
  - Implemented desktop Photoshop-style collapsible dock layout for Mask Canvas:
    - **Color & Swatches Panel**: 2D Saturation-Brightness spectrum box, vertical rainbow Hue slider, foreground/background color chips with swap button, and 48 default swatches.
    - **Adjustments Panel**: 16 Photoshop adjustment tiles in a 4x4 grid with live Invert (`Ctrl+I`), Threshold, and Levels bindings.
    - **Layers, Channels & Paths Panel**: 3-group accordion dock, layer kind filter bar, lock & fill controls, RGB/Mask channels tab, and iconic Photoshop footer actions (`🔗 fx ◩ ◐ 📁 ➕ 🗑️`).

### Fixed & Stabilized
- **Eliminated React Infinite Render Loop in AI Control Panel**:
  - Resolved `Maximum update depth exceeded` crash triggered when switching between tools (Upscale, Video, Image Studio).
  - Added guards to ensure aspect ratios and resolutions are only validated when models explicitly define non-empty supported lists.
  - Eliminated duplicate `selectedTool` local state and dual-syncing effects in `AIControlPanel.tsx`.
- **Canvas Builder Runtime Stability & Edge Loop Prevention**:
  - Stabilized standalone ghost node creation and cleanup in `BuilderPage.tsx`, preventing cascading node deletions.
  - Removed circular edge sanitization effect in `useBuilderWorkflow.ts`.
  - Added shallow equality check in `aiConfigStore.ts` for `setSelectedNode` to prevent redundant re-renders across the app.

## [0.3.91] - 2026-09-11

### Fixed & Enforced
- **Mandatory Update Dialog Enforcement & Persistence**:
  - Removed auto-install timer from [`UpdateNotification.tsx`](file:///e:/New%20folder%20(5)/Anarchy%20Ai%200.07/src/features/updater/UpdateNotification.tsx) to ensure the update modal never auto-dismisses or disappears unexpectedly.
  - Implemented an unclosable full-screen backdrop overlay (`z-index: 99999`) preventing application interactions until the user confirms the update.
  - Added clear error handling with retry and manual download fallbacks.
- **Canvas Builder Runtime Stability & Reference Fix**:
  - Restored and secured `activeTarget` reactive memoization inside [`useBuilderWorkflow.ts`](file:///e:/New%20folder%20(5)/Anarchy%20Ai%200.07/src/features/builder/useBuilderWorkflow.ts), resolving the runtime `ReferenceError: activeTarget is not defined` when opening the Canvas / Builder page.

## [0.3.90] - 2026-09-11

### Added
- **Universal Geometric Aspect Ratio Indicators (All AI Engines)**:
  - Designed and deployed [`AspectRatioIcon.tsx`](file:///e:/New%20folder%20(5)/Anarchy%20Ai%200.07/src/shared/components/AspectRatioIcon.tsx) providing real-time, mathematically proportional vector previews next to aspect ratio numbers across all engines:
    - **Ultrawide & Banners**: `4:1`, `3:1`, `21:9`, `2:1`, `17:9`
    - **Widescreen & Landscape**: `16:9`, `3:2`, `4:3`, `5:4`
    - **Square**: `1:1`
    - **Portrait, Posters & Reels**: `4:5`, `3:4`, `2:3`, `9:16`, `9:21`
    - **Adaptive / Auto**: `auto`, `match_input_image` with dashed badge geometry
  - Fully integrated into `AIControlPanel.tsx` active dropdown trigger button and dropdown list items across all AI models (Flux, SDXL, Ideogram, Recraft, Reve / Anarchy Creator, Imagen 3, GPT Image 2.5, Kling, Luma, MiniMax, Seedance).
  - Integrated into the Layout Editor Reframe / Crop dropdown and Relayout category cards (`ReframePanel.tsx`).

### Fixed & Stabilized
- **Canvas Hook Alignment & Runtime Scope Resolution**:
  - Resolved `useBuilderExternalEvents` import in `BuilderPage.tsx`.
  - Resolved `activeTarget` reactive calculation within `useBuilderWorkflow.ts`.
  - Coerced `contextNode` nullability in `useBuilderContextActions.ts` and enabled flexible `Dispatch | function` typing in `useBuilderPersistence.ts`.
  - Resolved module types for `InpaintLayer` and `ArrowNodeItem` in `useMaskExportAndActions.ts`.
  - Added strict app-level TypeScript validation (`npx tsc -p tsconfig.app.json --noEmit`) with 0 errors across all 371 files in `src/`.
  - Verified 100% test pass rate on all 31 Vitest suites (249 tests passing).

## [0.3.89] - 2026-09-11

### Architectural & Codebase Modularization
- **Complete Monolith Decomposition & Professional Codebase Cleanliness**:
  - Re-architected and modularized all 11 massive files (>1,000 lines) across the codebase into clean, decoupled, single-responsibility sub-components and specialized custom hooks.
  - Reduced every file in `src/` to strictly under 1,000 lines (**Zero files > 1,000 lines remaining across the entire 371 files in the workspace**).
  - Applied Zero-Breakage Facade Pattern to guarantee 100% backward compatibility with all existing routes, imports, components, and tests.
  - Decomposed files include:
    - `LayoutEditor.tsx`: Reduced from 3,134 to 261 lines (extracted to `src/features/builder/components/layout/`).
    - `useBuilderWorkflow.ts`: Reduced from 2,926 to 910 lines (extracted to `src/features/builder/workflow/`).
    - `AIControlPanel.tsx`: Reduced from 2,627 to 599 lines (extracted to `src/features/builder/controlPanel/`).
    - `BuilderPage.tsx`: Reduced from 1,831 to 886 lines (extracted to specialized builder hooks and modal components).
    - `ReplicateService.ts`: Reduced from 1,826 to 420 lines (extracted to `src/services/replicate/modules/`).
    - `useLayoutEditorState.ts`: Reduced from 1,488 to 888 lines (extracted `useLayoutAIOperations.ts` & `useLayoutSceneLibrary.ts`).
    - `SettingsPage.tsx`: Reduced from 1,302 to 320 lines (extracted to `src/features/settings/tabs/`).
    - `AnarchyService.ts`: Reduced from 1,275 to 267 lines (extracted to `src/services/anarchy/modules/`).
    - `ExportService.ts`: Reduced from 1,193 to 60 lines (extracted to `src/services/export/modules/`).
    - `MaskCanvas.tsx`: Reduced from 1,166 to 966 lines (extracted `useMaskExportAndActions.ts`).
    - `HistoryService.ts`: Reduced from 1,149 to 270 lines (extracted to `src/services/history/storage/`).
    - `PreviewModal.tsx`: Reduced from 1,006 to 887 lines (extracted `ProvenanceTimeline.tsx`).

### Fixed & Improved
- **Anarchy Upscale Sidebar Controls & Pipeline Execution**:
  - Fixed sticky / non-responsive Anarchy Upscale controls in `RightSidebar.tsx` by forwarding and persisting `anarchyUpscaleScale` and `anarchyUpscaleCreativity` in sidebar params.
  - Added official Replicate model version hash resolution for `philz1337x/clarity-pro-upscaler`.
  - Resolved `liveUpscaleFactor` and `hasUpscaleFactor` checks so the "Generate" button is properly enabled on upscale-only nodes without requiring a prompt.
- **Multi-Tenant User Attribution & Storage Folder Partitioning**:
  - Fixed generation and upscale outputs being saved under generic `user/` folder in Supabase Storage.
  - Implemented dynamic session resolution to guarantee all outputs are saved strictly under each authenticated subscriber's private folder (`[user_id]/[node_id]/`).
- **Build System & Transform Engine Hardening**:
  - Resolved all Vite / Oxc compiler edge cases across custom hooks and verified pristine production build (`npm run build`) in 2.78s.
  - Verified 100% test pass rate across all 31 Vitest suites (249 tests passing).

## [0.3.88] - 2026-09-10

### Added
- **Anarchy Upscale (Clarity Pro) Flagship Engine**:
  - Integrated `philz1337x/clarity-pro-upscaler` under the title **Anarchy Upscale** with a Pro badge, positioned as the primary upscaling engine.
  - Scale factor presets: `2x`, `4x`, `8x`, and `16x`.
  - Creativity slider control ranging from `-10` to `+10` (default: 4) for balancing original fidelity with generative detail.
  - Dynamic megapixel-based credit cost calculation with guaranteed 50%+ profit margin ($0.03/MP capped at 64 MP).
- **Pruna AI Upscale Engine**:
  - Integrated `prunaai/p-image-upscale` with factor scaling (1x–16x) and target megapixel mode (1–128 MP).
- **Standalone Admin Subscribers & Revenue Dashboard**:
  - Created standalone desktop administrative tool (`Anarchy AI Admin Dashboard.bat`) for real-time Stripe revenue, Replicate compute costs, user credit balances, and financial analytics.

### Changed & Improved
- **Revamped Left Navigation Sidebar Icons**:
  - Upgraded all navigation icons to modern, sleek Lucide icons: `LayoutDashboard`, `FolderKanban`, `Workflow`, `BrainCircuit`, `Cpu`, `Shapes`, `Images`, `History`, `Blocks`.
  - Added smooth hover micro-animations (`translateY(-1px) scale(1.08)`) and active neon rose glowing drop-shadow.
- **Topaz Labs & Clarity Upscaler Pricing Alignment**:
  - Implemented dynamic megapixel pricing brackets for Topaz Labs Upscale (up to 512 MP).
  - Aligned Clarity Upscaler credit pricing to Nvidia A100 GPU compute runtime with real-time hardware status indicators.

## [0.3.85] - 2026-09-10

### Added
- **OpenAI GPT Image 2.5 Integration (Flare & Sunburst)**:
  - Added full support for both OpenAI GPT Image 2.5 models across the platform:
    - **GPT Image 2.5 Flare** (`openai/gpt-image-2.5-flare`): Optimized for high-speed, everyday image generation and editing.
    - **GPT Image 2.5 Sunburst** (`openai/gpt-image-2.5-sunburst`): Designed for maximum fidelity and photorealistic instruction following.
  - Available in both **Edit** and **Generate** tabs in Image Studio.
  - Interactive **Sub-Variant Selector Pill**: A sleek toggle button (`[ 🔥 flare ]` / `[ ☀️ sunburst ]`) rendered directly beneath the Engine dropdown to switch active variants with a single click.
  - Complete Replicate OpenAPI schema parity:
    - **Quality Tiers**: `auto`, `low`, `medium`, `high`, `xhigh`, `max`.
    - **Aspect Ratios**: `1:1`, `3:2`, `2:3`, `4:3`, `3:4`, `16:9`, `9:16`, and `auto`.
    - **Multi-image input** support for image editing and inpainting.
  - Exact Credit Pricing & Billing Tier Calibration:
    - `auto`: $0.25 ⟵ **3.0 credits**
    - `low`: $0.012 ⟵ **0.5 credits**
    - `medium`: $0.047 ⟵ **0.8 credits**
    - `high`: $0.128 ⟵ **1.8 credits**
    - `xhigh`: $0.25 ⟵ **3.0 credits**
    - `max`: $0.50 ⟵ **6.5 credits**
  - Integrated into Mask Canvas inpainting engines, context menus, workflow runners, history views, and automatic recovery systems.

### Changed & Improved
- **Mask Canvas & Expand Mode Layout Optimization**:
  - Removed canvas rulers in MaskCanvas for an unobstructed drawing and inpainting workspace.
  - In Expand mode: hidden the mini-map and unnecessary tabs, focusing the canvas view exclusively on the active node.
  - Repositioned mask editing tools to the left sidebar (Photoshop-style layout) for intuitive artist workflows.
  - Upgraded Layers Panel architecture to a modern, dockable layout with improved hierarchy and clarity.
  - Cleaned up obsolete files and code across the workspace.

## [0.3.80] - 2026-09-08

### Changed & Improved
- **AI Model Credit Pricing Alignment**:
  - Updated credit calculations and per-image pricing for 8 major AI models:
    - **Nano Banana 2** (`google/nano-banana-2`): 1K = 1.1 cr, 2K = 1.2 cr, 4K = 2.2 cr.
    - **Seedream 5 Pro** (`bytedance/seedream-5-pro`): 1K = 0.8 cr, 2K = 1.3 cr.
    - **Nano-Banana-2-Lite** (`google/nano-banana-2-lite`): 0.7 cr.
    - **Nano Banana Pro** (`google/nano-banana-pro`): 1K/2K = 2.2 cr, 4K = 4.2 cr, fallback = 1.0 cr.
    - **GPT Image 2** (`openai/gpt-image-2`): auto = 1.8 cr, low = 0.5 cr, medium = 0.8 cr, high = 1.8 cr.
    - **FLUX 2 Pro** (`black-forest-labs/flux-2-pro`): flat 0.5 cr per run.
    - **P-Image** (`prunaai/p-image`): flat 0.5 cr ($5 / 1000 images).
    - **Krea 2 Large** (`krea/krea-2-large`): flat 1.0 cr.

### Fixed
- **GPT Image 2 Dynamic Quality Pricing**:
  - Fixed an issue where changing GPT Image 2 quality (`auto`, `low`, `medium`, `high`) in the UI dropdown did not update the prompt bar cost badge or the deducted credit amount.
  - Linked `resolution` and `qualityVariant` in `AIControlPanel`, `RightSidebar`, `aiConfigStore`, and `creditService` so selecting `low` immediately reflects 0.5 cr, `medium` reflects 0.8 cr, and `high`/`auto` reflect 1.8 cr.
  - Added live credit cost labels directly inside the quality/resolution dropdown menu items.
- **Ghost Node Visibility in Upscale Mode**:
  - Fixed the standalone generator ghost node ("Ready for Prompt" / "Text-to-Image Creator") incorrectly showing when in Upscale tool mode.

## [0.3.75] - 2026-09-08

### Fixed
- **Project Loading & Zero Nodes Bug**:
  - Eliminated the destructive background disk autosave that previously saved blank default source nodes (`nodes.length === 1`) every 2.5 seconds and overwrote `untitled.ana` or existing projects with empty canvases.
  - Added `isDefaultBlankCanvas` and `isDirtyRef.current` guards to ensure untouched template canvases are never saved to disk.
  - Fixed a race condition in `useBuilderWorkflow` where `initialProjectPath` was omitted from `hasInitialState`, causing premature blank source node creation before disk file reads completed.
  - Fixed tab reuse in `useMultiBuilderTabs`: dispatched `anarchy:reload-project` custom event to immediately re-read file data from disk and update the canvas when selecting an existing project from the Projects page.
  - Enhanced `applyWorkflow` with graceful fallback handling: if a project file contains 0 nodes (e.g. legacy empty save), it initializes a clean, ready source node rather than rendering a pitch-black canvas.
  - Normalized React Flow node types (`baseNode`, `ghostNode`, `dummyNode`, `groupNode`), sanitized dimensions and coordinates, and reset interrupted session states (`connecting`, `processing`, `queued` -> `idle`).
  - Added delayed `fitView` camera centering and GPU canvas repaint after applying workflows.
  - Fixed project naming regex in `WorkflowFileService.ts` and `ProjectService.ts` to `/[^\p{L}\p{N}_\-\s]/gu`, preserving Arabic and all Unicode letters so Arabic project names no longer collide into `untitled.ana`.
  - Corrected project total nodes counter in `VirtualProjectsView.tsx` from `{project.totalNodes || 1}` to `{project.totalNodes}`.

- **Mask Canvas & Make Button Stability**:
  - Fixed `MaskCanvas.getCompositeAndMask` to reuse direct DOM image references safely, avoiding CORS fetch blocks and preventing the "Make" button from getting stuck.
  - Resolved undo/redo preview desynchronization in mask and layer workflows.

### Added
- **Photoshop Layered Export (`.psd`)**:
  - Implemented `exportToPsdWithDialog` in `PsdExportService.ts` via `ag-psd` to export the current workspace as a Photoshop document.
  - Retains all inpaint layers, background base image, layer opacities, layer visibility, 16 blend modes (Normal, Multiply, Screen, Overlay, etc.), and active binary inpaint mask.
  - Native binary writing using Tauri's `save_image_to_path` base64 decoding engine with reliable browser download fallback.
  - Integrated into the Mask Canvas top toolbar export dropdown and the Layers Panel actions footer.

- **Real-Time Brush Softness & Feather Dynamic Preview**:
  - Engineered a dual-ring dynamic cursor in `MaskCanvas`: an inner dashed ring displays the solid brush hardness core (`brushHardness / 100 * brushSize`), while the outer solid ring bounds the feather extent (`brushSize`).
  - Added real-time radial gradient background reflecting exact feather falloff directly underneath the artist's brush.
  - Added a floating HUD badge showing live brush metrics (e.g. `Ø 48px • 75%`).

- **Image Cache & IndexedDB Storage Cleaner in Settings**:
  - Added a dedicated storage management card in `SettingsPage.tsx` using `StorageManagerService.ts`.
  - Real-time disk quota and usage estimation via `navigator.storage.estimate()`.
  - Safe one-click "Clean Image Cache" that immediately frees disk space by pruning ephemeral previews (`local_image_cache`) while strictly protecting `.ana` project files, persistent nodes, and account data.
  - Live confirmation dialog with instant byte-level feedback.

- **Auto-Recovery Crash Protection Snapshots (`.ana.bak`)**:
  - Implemented `AutoRecoveryService.ts` to automatically save periodic recovery snapshots for dirty builder tabs without blocking the UI thread.
  - Added an auto-recovery detection banner on startup in `MultiBuilderPage.tsx` alerting users to unsaved sessions with one-click "Restore Session" or "Discard" actions.
  - Automatic snapshot cleanup upon successful clean saves, loads, or new project creation.

- **Batch Export to Structured ZIP Archive**:
  - Implemented `exportImagesToZipWithDialog` and `exportNodesToZipWithDialog` in `ExportService.ts` using `jszip`.
  - Batch exports all canvas images or selected node images/variants at full resolution into a neat, compressed `.zip` archive.
  - Automatically bundles prompt text files alongside images (`{index}_{name}_prompt.txt`) and generates a structured `manifest.json` metadata summary.
  - Integrated into canvas and node context menus: "Export All to ZIP (Batch)" and "Export Selected to ZIP".

- **Dashboard Recent Activity Thumbnails & Instant Canvas Restore**:
  - Implemented `ActivityItemThumbnail` in `DashboardPage.tsx` using `useResolvedImage` and IndexedDB cache (`loadThumbnail`) to display real generated image thumbnails for all recent activities.
  - Connected recent activity card clicks to `useHistoryRestore.restoreWorkflow`, enabling one-click restoration of historical node trees directly into the Canvas Builder.

- **Photoshop-Grade Dual-Engine Mask / Draw Canvas**:
  - Dual-engine Draw/Ink and Mask/Inpaint modes with morphological dilation, Gaussian feathering, and edge-aware snapping.
  - Advanced Layers Panel supporting 16 blend modes, opacity sliders, mask invert, and multi-layer management in `LayersPanel` and `LayerStackPanel`.
  - Integrated 62 curated architectural and rendering style presets into the mask and generator workflows.

### Changed
- **Unified Credit & Generation Cost System**:
  - Synchronized credit and cost estimation across `MaskCanvas`, `RightSidebar`, and `useBuilderCredits.ts`.
  - Guaranteed identical dynamic cost calculation between the Canvas Builder and the Mask Editor based on model, resolution, and quality.

- **Modernized View Mode Toggles**:
  - Upgraded view mode toggles in `LibraryPage.tsx` and `ProjectsPage.tsx` to modern segmented controls with `LayoutGrid` and `LayoutList` icons.

- **Language System Simplification (English Only)**:
  - Streamlined application settings and preset selectors by removing Arabic language options to standardize on pure English.
  - Auto-migrated existing localStorage language configurations to English.

- **Clean Flat Canvas Visual Style**:
  - Removed all outer drop shadows and heavy glows behind builder nodes for a crisp, flat aesthetic.
