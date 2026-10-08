import React from 'react';
import {
  Sliders,
  Bot,
  Building2,
  Compass,
  Sparkles,
  Ruler,
  Box,
  Download,
  ExternalLink,
  ChevronDown,
  Check,
} from 'lucide-react';
import {
  BUILDING_TYPOLOGIES,
  ARCHITECTURAL_STYLES,
  RENDERING_ENGINES,
  ASPECT_RATIOS,
  ARCHITECTURE_MODELS,
} from '../hooks/useAgentChat';
import { CURATED_CONCEPTS } from '../constants';

interface StudioInspectorProps {
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  selectedModelInfo?: { id: string; label: string; vendor: string; focus: string; badge?: string };
  showModelDropdown: boolean;
  setShowModelDropdown: (b: boolean) => void;
  modelDropdownRef: React.RefObject<HTMLDivElement | null>;
  selectedTypology: string;
  setSelectedTypology: (t: string) => void;
  showTypologyDropdown: boolean;
  setShowTypologyDropdown: (b: boolean) => void;
  typologyDropdownRef: React.RefObject<HTMLDivElement | null>;
  selectedStyle: string;
  setSelectedStyle: (s: string) => void;
  showStyleDropdown: boolean;
  setShowStyleDropdown: (b: boolean) => void;
  styleDropdownRef: React.RefObject<HTMLDivElement | null>;
  siteAreaSqm: number;
  setSiteAreaSqm: (a: number) => void;
  targetEngine: string;
  setTargetEngine: (e: string) => void;
  showEngineDropdown: boolean;
  setShowEngineDropdown: (b: boolean) => void;
  engineDropdownRef: React.RefObject<HTMLDivElement | null>;
  aspectRatio: string;
  setAspectRatio: (r: string) => void;
  autoRender: boolean;
  setAutoRender: (a: boolean) => void;
  exportCadPlan: () => void;
  isExportingCad: boolean;
  exportBimModel: () => void;
  isExportingBim: boolean;
  setDraft: (d: string) => void;
}

export const StudioInspector: React.FC<StudioInspectorProps> = ({
  selectedModel,
  setSelectedModel,
  selectedModelInfo,
  showModelDropdown,
  setShowModelDropdown,
  modelDropdownRef,
  selectedTypology,
  setSelectedTypology,
  showTypologyDropdown,
  setShowTypologyDropdown,
  typologyDropdownRef,
  selectedStyle,
  setSelectedStyle,
  showStyleDropdown,
  setShowStyleDropdown,
  styleDropdownRef,
  siteAreaSqm,
  setSiteAreaSqm,
  targetEngine,
  setTargetEngine,
  showEngineDropdown,
  setShowEngineDropdown,
  engineDropdownRef,
  aspectRatio,
  setAspectRatio,
  autoRender,
  setAutoRender,
  exportCadPlan,
  isExportingCad,
  exportBimModel,
  isExportingBim,
  setDraft,
}) => {
  return (
    <aside className="arch-inspector-panel">
      <div className="inspector-header">
        <div className="inspector-title-wrap">
          <Sliders size={13} className="inspector-icon" />
          <h3>Studio Inspector</h3>
        </div>
        <span className="inspector-badge">Active</span>
      </div>

      <div className="inspector-scroll-area">
        {/* SECTION 0: AI INTELLIGENCE & REASONING MODEL */}
        <div className="inspector-section">
          <div className="section-label">AI Reasoning Engine</div>

          {/* Model Selector Dropdown */}
          <div className="inspector-control" ref={modelDropdownRef}>
            <label className="control-label">Intelligence Model</label>
            <div
              className="control-dropdown-trigger"
              onClick={() => setShowModelDropdown(!showModelDropdown)}
            >
              <Bot size={13} className="trigger-icon purple" />
              <span className="trigger-text">
                {selectedModelInfo?.label || 'Gemini 3.6 Flash'}
              </span>
              <ChevronDown size={13} className={`chevron ${showModelDropdown ? 'open' : ''}`} />
            </div>

            {showModelDropdown && (
              <div className="control-dropdown-menu model-menu">
                {ARCHITECTURE_MODELS.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    className={`menu-item engine-item ${selectedModel === model.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedModel(model.id);
                      setShowModelDropdown(false);
                    }}
                  >
                    <div className="engine-meta">
                      <div className="model-name-row">
                        <span className="engine-name">{model.label}</span>
                        {model.badge && <span className="model-badge">{model.badge}</span>}
                      </div>
                      <span className="engine-vendor">{model.vendor} • {model.focus}</span>
                    </div>
                    {selectedModel === model.id && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 1: ARCHITECTURAL PARAMETERS */}
        <div className="inspector-section">
          <div className="section-label">Building Parameters</div>

          {/* Typology Dropdown */}
          <div className="inspector-control" ref={typologyDropdownRef}>
            <label className="control-label">Building Typology</label>
            <div
              className="control-dropdown-trigger"
              onClick={() => setShowTypologyDropdown(!showTypologyDropdown)}
            >
              <Building2 size={13} className="trigger-icon blue" />
              <span className="trigger-text">{selectedTypology}</span>
              <ChevronDown size={13} className={`chevron ${showTypologyDropdown ? 'open' : ''}`} />
            </div>

            {showTypologyDropdown && (
              <div className="control-dropdown-menu">
                {BUILDING_TYPOLOGIES.map((typology) => (
                  <button
                    key={typology}
                    type="button"
                    className={`menu-item ${selectedTypology === typology ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedTypology(typology);
                      setShowTypologyDropdown(false);
                    }}
                  >
                    <span>{typology}</span>
                    {selectedTypology === typology && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Architectural Style Dropdown */}
          <div className="inspector-control" ref={styleDropdownRef}>
            <label className="control-label">Architectural Style</label>
            <div
              className="control-dropdown-trigger"
              onClick={() => setShowStyleDropdown(!showStyleDropdown)}
            >
              <Compass size={13} className="trigger-icon rose" />
              <span className="trigger-text">{selectedStyle}</span>
              <ChevronDown size={13} className={`chevron ${showStyleDropdown ? 'open' : ''}`} />
            </div>

            {showStyleDropdown && (
              <div className="control-dropdown-menu">
                {ARCHITECTURAL_STYLES.map((style) => (
                  <button
                    key={style}
                    type="button"
                    className={`menu-item ${selectedStyle === style ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedStyle(style);
                      setShowStyleDropdown(false);
                    }}
                  >
                    <span>{style}</span>
                    {selectedStyle === style && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Plot Area Slider */}
          <div className="inspector-control">
            <div className="slider-label-row">
              <label className="control-label">Site / Plot Area</label>
              <span className="slider-counter">{siteAreaSqm.toLocaleString()} m²</span>
            </div>
            <input
              type="range"
              min="200"
              max="3000"
              step="50"
              className="inspector-slider"
              value={siteAreaSqm}
              onChange={(e) => setSiteAreaSqm(Number(e.target.value))}
            />
            <div className="slider-presets">
              {[300, 500, 800, 1200].map((area) => (
                <button
                  key={area}
                  type="button"
                  className={`preset-btn ${siteAreaSqm === area ? 'active' : ''}`}
                  onClick={() => setSiteAreaSqm(area)}
                >
                  {area}m²
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SECTION 2: GENERATION SPECS */}
        <div className="inspector-section">
          <div className="section-label">Visualization Specs</div>

          {/* Target Engine Dropdown */}
          <div className="inspector-control" ref={engineDropdownRef}>
            <label className="control-label">Rendering Engine</label>
            <div
              className="control-dropdown-trigger"
              onClick={() => setShowEngineDropdown(!showEngineDropdown)}
            >
              <Sparkles size={13} className="trigger-icon rose" />
              <span className="trigger-text">
                {RENDERING_ENGINES.find((e) => e.id === targetEngine)?.label || 'Nano Banana 2'}
              </span>
              <ChevronDown size={13} className={`chevron ${showEngineDropdown ? 'open' : ''}`} />
            </div>

            {showEngineDropdown && (
              <div className="control-dropdown-menu">
                {RENDERING_ENGINES.map((engine) => (
                  <button
                    key={engine.id}
                    type="button"
                    className={`menu-item engine-item ${targetEngine === engine.id ? 'selected' : ''}`}
                    onClick={() => {
                      setTargetEngine(engine.id);
                      setShowEngineDropdown(false);
                    }}
                  >
                    <div className="engine-meta">
                      <span className="engine-name">{engine.label}</span>
                      <span className="engine-vendor">{engine.vendor}</span>
                    </div>
                    {targetEngine === engine.id && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Aspect Ratio Grid */}
          <div className="inspector-control">
            <label className="control-label">Aspect Ratio</label>
            <div className="aspect-ratio-pills">
              {ASPECT_RATIOS.map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  className={`ratio-pill ${aspectRatio === ratio ? 'active' : ''}`}
                  onClick={() => setAspectRatio(ratio)}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          {/* Auto-Render Switch */}
          <div className="inspector-control switch-control">
            <label className="switch-item">
              <input
                type="checkbox"
                checked={autoRender}
                onChange={(e) => setAutoRender(e.target.checked)}
              />
              <span className="switch-toggle" />
              <div className="switch-text-group">
                <span className="switch-primary">Auto-Render Output</span>
                <span className="switch-sub">Synthesize image render automatically</span>
              </div>
            </label>
          </div>
        </div>

        {/* SECTION 3: DIRECT AEC SYNTHESIS TOOLS */}
        <div className="inspector-section">
          <div className="section-label">AEC Deliverable Tools</div>
          <div className="aec-tools-list">
            <button
              type="button"
              className="aec-action-card blue"
              onClick={() => exportCadPlan()}
              disabled={isExportingCad}
              title="Export AutoCAD 2D Architectural DXF with setbacks"
            >
              <div className="card-icon-part blue">
                <Ruler size={15} />
              </div>
              <div className="card-text-part">
                <div className="card-action-title">
                  {isExportingCad ? 'Exporting...' : 'AutoCAD 2D Plan'}
                </div>
                <div className="card-action-desc">DXF Setbacks & Layers ({siteAreaSqm}m²)</div>
              </div>
              <Download size={13} className="card-tail-icon" />
            </button>

            <button
              type="button"
              className="aec-action-card purple"
              onClick={() => exportBimModel()}
              disabled={isExportingBim}
              title="Synthesize 3D BIM model and launch WebGL viewer"
            >
              <div className="card-icon-part purple">
                <Box size={15} />
              </div>
              <div className="card-text-part">
                <div className="card-action-title">
                  {isExportingBim ? 'Synthesizing...' : '3D BIM Model'}
                </div>
                <div className="card-action-desc">Speckle AEC WebGL Viewer</div>
              </div>
              <ExternalLink size={13} className="card-tail-icon" />
            </button>
          </div>
        </div>

        {/* SECTION 4: CURATED INSPIRATIONS */}
        <div className="inspector-section">
          <div className="section-label">Concept Inspirations</div>
          <div className="inspirations-stack">
            {CURATED_CONCEPTS.map((c, i) => (
              <div
                key={i}
                className="inspiration-item"
                onClick={() => setDraft(c.text)}
                title="Click to apply this concept into prompt"
              >
                <div className="insp-title">{c.title}</div>
                <div className="insp-desc">{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
};
