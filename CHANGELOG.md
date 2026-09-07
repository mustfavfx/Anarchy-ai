# Changelog

All notable changes to **Anarchy AI** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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
