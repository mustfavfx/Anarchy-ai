# Anarchy AI

<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="Anarchy AI Logo" width="96" height="96" />
</p>

<p align="center">
  <strong>The Professional AI Operating System & Workflow Engine for Architects</strong>
</p>

<p align="center">
  <a href="https://github.com/mustfavfx/Anarchy-ai/releases/latest"><img src="https://img.shields.io/badge/Release-v0.3.85-0066FF?style=for-the-badge&logo=github" alt="Release v0.3.85" /></a>
  <a href="LICENSE.txt"><img src="https://img.shields.io/badge/License-Proprietary%20EULA-blueviolet?style=for-the-badge" alt="EULA License" /></a>
  <img src="https://img.shields.io/badge/Platform-Windows%20x64-00A4EF?style=for-the-badge&logo=windows" alt="Platform Windows" />
  <img src="https://img.shields.io/badge/Architecture-Local--First-22C55E?style=for-the-badge" alt="Local-First" />
</p>

<p align="center">
  <a href="#key-capabilities">Key Capabilities</a> •
  <a href="#core-modules">Core Modules</a> •
  <a href="#cad--bim-live-ecosystem">CAD/BIM Integrations</a> •
  <a href="#supported-ai-engines">AI Engines</a> •
  <a href="#installation">Installation</a> •
  <a href="#official-links">Official Channels</a>
</p>

---

## 🏛️ What is Anarchy AI?

**Anarchy AI** is a desktop-first architectural AI workspace designed specifically for architects, BIM leads, visualizers, and 3D studios. 

Unlike conventional web prompt-boxes that treat AI generation as isolated, ephemeral images, **Anarchy AI** unifies visual node pipelines, complete project memory, intelligent inpainting/outpainting, multi-watermark protection, and direct bidirectional synchronization with industry-standard CAD/BIM software (**Autodesk Revit** and **Autodesk 3ds Max**).

---

## ✨ Key Capabilities

* **Visual Workflow Canvas:** Design modular generation pipelines. Connect inputs, camera views, prompts, control nets, and multi-model blends in an interactive node graph.
* **Smart Mask Studio (Inpainting & Outpainting):** Full-featured architectural canvas with brush, lasso, polygon masking, resolution preservation, and edge expansion.
* **Full Workflow Restoration:** Inspect any past generation in the branching lineage graph and restore the entire node tree, settings, and seed with one click.
* **BIM & CAD Viewport Sync:** Seamlessly capture, link, and route viewports directly from Autodesk Revit and 3ds Max into AI generation pipelines.
* **Multi-Watermark Studio:** Protect design presentations with customizable text, image logos, corner alignments, opacity controls, and pattern tiling.
* **FluidCAD Analysis:** Integrated technical analysis tools for drawings, blueprints, and spatial compositions.
* **Privacy & Local-First:** Your CAD geometry, project layouts, and design workflows remain stored locally on your machine.

---

## 🧩 Core Modules

| Module | Purpose |
| :--- | :--- |
| **Builder Canvas** | Professional node-based visual workflow editor for pipeline design and multi-engine orchestration. |
| **Image Studio** | Precision masking, localized architectural inpainting, resolution upscaling, and canvas expansion. |
| **History Graph** | Deep memory system featuring timeline view, branching lineage trees, instant node restoration, and metrics. |
| **Watermark Studio** | Multi-layer client presentation branding with real-time preview and export protection. |
| **Asset Library** | Centralized project repository for reference imagery, prompt templates, material textures, and outputs. |
| **Project Manager** | Organize architectural phases, design schemes, client revisions, and asset folders cleanly. |

---

## 🔌 CAD & BIM Live Ecosystem

Anarchy AI bridges generative AI directly with production architecture software:

* **Autodesk Revit (2022 – 2027):** Native C# ribbon plugin dynamically built to synchronize active 3D viewports and render passes directly into the Canvas.
* **Autodesk 3ds Max (2022 – 2027):** Dedicated MaxScript connectors and viewport capture macros for high-speed concept testing and styling.

---

## 🤖 Supported AI Engines

Orchestrate top-tier generative models within the same workflow:

* **OpenAI GPT Image 2.5:**
  * `gpt-image-2.5-flare` (Ultra-fast generation & editing)
  * `gpt-image-2.5-sunburst` (High-fidelity photorealistic rendering)
  * Granular quality tiers (`low`, `medium`, `high`, `xhigh`, `max`)
* **Black Forest Labs Flux:** Flux 1.1 Pro, Flux Dev, Flux Schnell, and dedicated Inpainting models.
* **Stable Diffusion XL:** SDXL Base, Lightning, and specialized architectural checkpoints.
* **Ideogram v2 & Recraft v3:** Advanced typographic, vector, and photorealistic design outputs.

---

## 💻 Architecture & Tech Stack

Anarchy AI combines native desktop speed with cloud-scale inference:

* **Frontend:** React 18, TypeScript, Vite, TailwindCSS / Vanilla CSS, Lucide Icons
* **Graph Engine:** React Flow with custom architectural node controllers
* **Desktop Runtime:** Tauri (Rust backend), Microsoft Edge WebView2
* **Storage & Sync:** Local-First (IndexedDB / LocalStorage) with optional Supabase cloud backups
* **Integrations:** C# (.NET Revit API), MaxScript (Autodesk 3ds Max API)
* **Packaging:** Inno Setup (Automated multi-version CAD discovery and silently bundled runtimes)

---

## 📥 Installation

### Windows Installer (Recommended)
1. Download the latest `Anarchy_AI_Setup.exe` from [GitHub Releases](https://github.com/mustfavfx/Anarchy-ai/releases/latest).
2. Run the setup wizard. The installer will automatically detect your installed versions of Autodesk Revit and 3ds Max and deploy the connectors.
3. Launch **Anarchy AI** from your desktop or start menu.

### Development Setup
```bash
# Clone repository
git clone https://github.com/mustfavfx/Anarchy-ai.git
cd Anarchy-ai

# Install dependencies
npm install

# Run Vite dev server
npm run dev

# Run Tauri desktop app in development
npm run tauri:dev
