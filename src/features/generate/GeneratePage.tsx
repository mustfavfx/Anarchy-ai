import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Bot,
  Send,
  Building2,
  Ruler,
  DraftingCompass,
  ChevronDown,
  Check,
  Paperclip,
  X,
  Download,
  Box,
  Layers,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Copy,
  Sliders,
  Maximize2,
  RotateCcw,
  Compass,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Upload,
  ArrowRight,
  Info,
  Eye,
  CheckCheck,
} from 'lucide-react';
import {
  useAgentChat,
  ARCHITECTURAL_STYLES,
  BUILDING_TYPOLOGIES,
  RENDERING_ENGINES,
  ASPECT_RATIOS,
  type ChatMessageData,
} from './hooks/useAgentChat';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { canvasBridge } from '../../services/agent/CanvasBridgeService';
import './GeneratePage.css';

// Starter Cards for Zero-State
const STARTER_CARDS = [
  {
    icon: <Building2 size={16} className="starter-icon rose" />,
    title: 'Luxury Modern Villa',
    desc: '500m² plot, beige travertine stone, double-glazed panoramic glass, central courtyard pool',
    prompt: 'Design a luxury modern villa on a 500m² site with beige travertine stone cladding, double-glazed panoramic windows, and an illuminated central courtyard pool.',
    style: 'Luxury Residential Villa',
    typology: 'Residential Villa',
    area: 500,
  },
  {
    icon: <DraftingCompass size={16} className="starter-icon blue" />,
    title: 'Biophilic Office Complex',
    desc: 'Commercial tower with vertical green terraces, solar louvers, and open timber atrium',
    prompt: 'Synthesize a commercial biophilic office building with stepped green garden terraces, responsive solar louvers, and a grand 4-story timber atrium.',
    style: 'Modern Contemporary',
    typology: 'Commercial Office',
    area: 1200,
  },
  {
    icon: <Ruler size={16} className="starter-icon green" />,
    title: 'Code Compliance & Setbacks',
    desc: 'Verify municipal setbacks, floor area ratio (FAR), and building zoning constraints',
    prompt: 'Perform a comprehensive architectural zoning and building code compliance check for a mixed-use project on an 800m² urban parcel.',
    style: 'Modern Contemporary',
    typology: 'Mixed-Use Complex',
    area: 800,
  },
  {
    icon: <Upload size={16} className="starter-icon purple" />,
    title: 'Upload Sketch / Plan',
    desc: 'Multimodal vision analysis of hand-drawn sketches or 2D floor plans for massing & render',
    isUpload: true,
  },
];

const CURATED_CONCEPTS = [
  {
    title: 'Minimalist Nordic Residence',
    desc: 'Cantilevered volumes, raw concrete, pine forest integration',
    text: 'Minimalist concrete villa with cantilevered glass volumes, black metal trims, and pine forest backdrop.',
  },
  {
    title: 'Modern Mashrabiya Estate',
    desc: 'Perforated geometric screens, central courtyard, passive cooling',
    text: 'Modern Middle Eastern villa featuring geometric perforated stone screens, interior courtyard oasis, and passive cooling.',
  },
  {
    title: 'Parametric Waterfront Hotel',
    desc: 'Wave-inspired curved balconies overlooking oceanfront marina',
    text: 'Organic fluid high-rise resort with wave-inspired curved balconies overlooking oceanfront marina.',
  },
];

type DossierTab = 'visual' | 'program' | 'compliance' | 'engineering';

/**
 * Architectural Dossier Component
 * Neatly organizes assistant deliverables into 4 clear interactive tabs:
 * 1. Visual & Render (Preview, prompt, copy)
 * 2. Space Program (Zoning breakdown & matrix)
 * 3. Code Compliance (Setbacks, FAR, regulatory checklist)
 * 4. CAD & BIM (AutoCAD .DXF download & 3D WebGL viewer)
 */
const ArchitecturalDossier: React.FC<{
  data: ChatMessageData;
  messageId: string;
}> = ({ data, messageId }) => {
  // Determine default tab based on available assets
  const initialTab: DossierTab = useMemo(() => {
    if (data.rendered_image_url || data.enhanced_prompt) return 'visual';
    if (data.space_program) return 'program';
    if (data.compliance_report) return 'compliance';
    if (data.dxf_download_url || data.bim_viewer_url) return 'engineering';
    return 'visual';
  }, [data]);

  const [activeTab, setActiveTab] = useState<DossierTab>(initialTab);
  const [copied, setCopied] = useState(false);
  const [appliedToNode, setAppliedToNode] = useState(false);
  const activeNode = useAIConfigStore((s) => s.selectedNode);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleApplyToNode = (enhancedPrompt: string) => {
    if (activeNode?.id) {
      canvasBridge.applyPromptToNode(activeNode.id, enhancedPrompt);
      setAppliedToNode(true);
      setTimeout(() => setAppliedToNode(false), 2500);
      addNotification({
        type: 'success',
        title: 'Canvas Node Updated',
        message: `Applied enhanced prompt to canvas node #${activeNode.id.slice(0, 8)}.`,
        duration: 3500,
      });
    } else {
      useAIConfigStore.getState().setWorkspacePrompt(enhancedPrompt);
      setAppliedToNode(true);
      setTimeout(() => setAppliedToNode(false), 2500);
      addNotification({
        type: 'success',
        title: 'Prompt Bar Updated',
        message: 'Applied enhanced prompt to canvas prompt bar.',
        duration: 3000,
      });
    }
  };

  const hasVisual = !!(data.rendered_image_url || data.enhanced_prompt);
  const hasProgram = !!data.space_program;
  const hasCompliance = !!data.compliance_report;
  const hasEngineering = !!(data.dxf_download_url || data.bim_viewer_url);

  // If no structured deliverables, do not render dossier
  if (!hasVisual && !hasProgram && !hasCompliance && !hasEngineering) {
    return null;
  }

  return (
    <div className="dossier-card">
      {/* Segmented Tab Header */}
      <div className="dossier-tabs-nav">
        {hasVisual && (
          <button
            type="button"
            className={`dossier-tab-btn ${activeTab === 'visual' ? 'active' : ''}`}
            onClick={() => setActiveTab('visual')}
          >
            <Sparkles size={12} className="tab-icon rose" />
            <span>Visual & Prompt</span>
            {data.rendered_image_url && <span className="tab-dot" />}
          </button>
        )}

        {hasProgram && (
          <button
            type="button"
            className={`dossier-tab-btn ${activeTab === 'program' ? 'active' : ''}`}
            onClick={() => setActiveTab('program')}
          >
            <Layers size={12} className="tab-icon blue" />
            <span>Space Matrix</span>
          </button>
        )}

        {hasCompliance && (
          <button
            type="button"
            className={`dossier-tab-btn ${activeTab === 'compliance' ? 'active' : ''}`}
            onClick={() => setActiveTab('compliance')}
          >
            <ShieldCheck size={12} className="tab-icon green" />
            <span>Code Audit</span>
            <span className={`compliance-mini-pill ${data.is_compliant !== false ? 'pass' : 'warn'}`}>
              {data.is_compliant !== false ? 'Pass' : 'Review'}
            </span>
          </button>
        )}

        {hasEngineering && (
          <button
            type="button"
            className={`dossier-tab-btn ${activeTab === 'engineering' ? 'active' : ''}`}
            onClick={() => setActiveTab('engineering')}
          >
            <Box size={12} className="tab-icon purple" />
            <span>CAD & BIM</span>
            <span className="file-count-badge">2</span>
          </button>
        )}
      </div>

      {/* Dossier Body Panes */}
      <div className="dossier-body">
        {/* TAB 1: VISUAL & PROMPT */}
        {activeTab === 'visual' && hasVisual && (
          <div className="dossier-pane visual-pane">
            {data.rendered_image_url && (
              <div className="render-showcase-box">
                <div className="render-image-container">
                  <img
                    src={data.rendered_image_url}
                    alt="Synthesized Architectural Render"
                    className="render-image"
                  />
                  <div className="render-overlay-bar">
                    <a
                      href={data.rendered_image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="overlay-action-btn"
                      title="Open full-resolution image in new tab"
                    >
                      <Maximize2 size={12} />
                      <span>Full Resolution</span>
                    </a>
                    <a
                      href={data.rendered_image_url}
                      download="Architectural_Render.png"
                      className="overlay-action-btn"
                      title="Download render"
                    >
                      <Download size={12} />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              </div>
            )}

            {data.enhanced_prompt && (
              <div className="prompt-spec-box">
                <div className="prompt-spec-header">
                  <div className="spec-title-wrap">
                    <Sparkles size={12} className="rose" />
                    <span>Synthesized ArchViz Prompt</span>
                  </div>
                  <div className="prompt-header-actions">
                    <button
                      type="button"
                      className="apply-canvas-btn"
                      onClick={() => handleApplyToNode(data.enhanced_prompt!)}
                      title={activeNode?.id ? `Apply to active canvas node #${activeNode.id}` : 'Apply to canvas prompt bar'}
                    >
                      {appliedToNode ? (
                        <>
                          <CheckCheck size={12} />
                          <span>Applied</span>
                        </>
                      ) : (
                        <>
                          <Compass size={12} />
                          <span>{activeNode?.id ? `Apply to Node #${activeNode.id.slice(0, 6)}` : 'Apply to Canvas'}</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="copy-prompt-btn"
                      onClick={() => handleCopy(data.enhanced_prompt!)}
                    >
                      {copied ? (
                        <>
                          <CheckCheck size={12} />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy Prompt</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div className="prompt-code-wrap">
                  <code>{data.enhanced_prompt}</code>
                </div>
                {data.negative_prompt && (
                  <div className="negative-prompt-tag">
                    <span className="neg-label">Negative:</span>
                    <span className="neg-val">{data.negative_prompt}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SPACE PROGRAM */}
        {activeTab === 'program' && hasProgram && (
          <div className="dossier-pane program-pane">
            <div className="pane-header-row">
              <div className="pane-title-group">
                <Layers size={13} className="blue" />
                <h4>Spatial Zoning & Space Program Matrix</h4>
              </div>
              <span className="pane-subtitle">Calculated for site efficiency</span>
            </div>
            <div className="program-text-box mono-font">
              {data.space_program}
            </div>
          </div>
        )}

        {/* TAB 3: CODE COMPLIANCE AUDIT */}
        {activeTab === 'compliance' && hasCompliance && (
          <div className="dossier-pane compliance-pane">
            <div className="compliance-banner-row">
              <div className="compliance-status-block">
                {data.is_compliant !== false ? (
                  <div className="status-badge pass">
                    <CheckCircle2 size={13} />
                    <span>Compliant with Municipal Zoning Code</span>
                  </div>
                ) : (
                  <div className="status-badge warn">
                    <AlertTriangle size={13} />
                    <span>Requires Zoning Variance Review</span>
                  </div>
                )}
              </div>
              <span className="audit-jurisdiction">Standard Municipal Setbacks</span>
            </div>
            <div className="compliance-text-box mono-font">
              {data.compliance_report}
            </div>
          </div>
        )}

        {/* TAB 4: CAD & BIM EXPORTS */}
        {activeTab === 'engineering' && hasEngineering && (
          <div className="dossier-pane engineering-pane">
            <div className="engineering-grid">
              {data.dxf_download_url && (
                <div className="export-action-tile cad-tile">
                  <div className="tile-icon-bubble blue">
                    <FileCode size={20} />
                  </div>
                  <div className="tile-details">
                    <h5>{data.dxf_filename || 'Architectural_Plan.dxf'}</h5>
                    <p>AutoCAD 2D Floor Plan with Boundary & Municipal Setbacks</p>
                  </div>
                  <a
                    href={data.dxf_download_url}
                    download={data.dxf_filename || 'plan.dxf'}
                    className="tile-download-btn blue"
                  >
                    <Download size={13} />
                    <span>Download .DXF</span>
                  </a>
                </div>
              )}

              {data.bim_viewer_url && (
                <div className="export-action-tile bim-tile">
                  <div className="tile-icon-bubble purple">
                    <Box size={20} />
                  </div>
                  <div className="tile-details">
                    <h5>Speckle 3D BIM Model</h5>
                    <p>
                      {data.bim_elements_count || 36} Parametric elements | BUA:{' '}
                      {data.bim_total_bua || 576} m²
                    </p>
                  </div>
                  <a
                    href={data.bim_viewer_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tile-download-btn purple"
                  >
                    <ExternalLink size={13} />
                    <span>Launch 3D Viewer</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const GeneratePage: React.FC = () => {
  const {
    agentOnline,
    agentInfo,
    isCheckingHealth,
    refreshAgentHealth,

    selectedStyle,
    setSelectedStyle,
    selectedTypology,
    setSelectedTypology,
    siteAreaSqm,
    setSiteAreaSqm,
    targetEngine,
    setTargetEngine,
    aspectRatio,
    setAspectRatio,
    autoRender,
    setAutoRender,

    attachedFile,
    imagePreviewUrl,
    setAttachedImageFile,

    draft,
    setDraft,
    isSending,
    messages,
    sendMessage,
    clearChat,

    isExportingCad,
    exportCadPlan,
    isExportingBim,
    exportBimModel,
  } = useAgentChat();

  const [showStyleDropdown, setShowStyleDropdown] = useState(false);
  const [showTypologyDropdown, setShowTypologyDropdown] = useState(false);
  const [showEngineDropdown, setShowEngineDropdown] = useState(false);

  const styleDropdownRef = useRef<HTMLDivElement>(null);
  const typologyDropdownRef = useRef<HTMLDivElement>(null);
  const engineDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeCanvasNode = useAIConfigStore((s) => s.selectedNode);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const handleImportActiveCanvasNode = async () => {
    if (!activeCanvasNode?.id) return;
    if (activeCanvasNode.prompt) {
      setDraft(activeCanvasNode.prompt);
    }
    const blob = await canvasBridge.getActiveNodeImageBlob();
    if (blob) {
      const file = new File([blob], `canvas_node_${activeCanvasNode.id.slice(0, 6)}.png`, { type: blob.type || 'image/png' });
      setAttachedImageFile(file);
    }
    addNotification({
      type: 'success',
      title: 'Canvas Node Imported',
      message: `Loaded prompt & visual assets from node #${activeCanvasNode.id.slice(0, 8)}.`,
      duration: 3000,
    });
  };

  const handleOptimizeActiveCanvasNode = async () => {
    if (!activeCanvasNode?.id) return;
    const blob = await canvasBridge.getActiveNodeImageBlob();
    const promptText = (activeCanvasNode.prompt || draft || '').trim() || 'Analyze architectural composition and synthesize an optimized visual prompt';
    
    let fileToPass: File | null = null;
    if (blob) {
      fileToPass = new File([blob], `canvas_node_${activeCanvasNode.id.slice(0, 6)}.png`, { type: blob.type || 'image/png' });
      (fileToPass as any).__previewUrl = activeCanvasNode.image || activeCanvasNode.originalImage;
    }
    
    sendMessage(promptText, fileToPass);
  };

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!styleDropdownRef.current?.contains(target)) setShowStyleDropdown(false);
      if (!typologyDropdownRef.current?.contains(target)) setShowTypologyDropdown(false);
      if (!engineDropdownRef.current?.contains(target)) setShowEngineDropdown(false);
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachedImageFile(e.target.files[0]);
    }
  };

  const handleStarterCardClick = (card: typeof STARTER_CARDS[0]) => {
    if (card.isUpload) {
      fileInputRef.current?.click();
      return;
    }
    if (card.style) setSelectedStyle(card.style);
    if (card.typology) setSelectedTypology(card.typology);
    if (card.area) setSiteAreaSqm(card.area);
    if (card.prompt) setDraft(card.prompt);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="arch-studio-page">
      <div className="arch-studio-shell">
        {/* Minimalist Topbar Header */}
        <header className="arch-studio-topbar">
          <div className="topbar-identity">
            <div className="topbar-emblem">
              <Compass size={16} />
            </div>
            <div className="topbar-title-wrap">
              <span className="topbar-product">ArchVision AI Studio</span>
              <div className={`status-indicator-pill ${agentOnline ? 'online' : 'offline'}`}>
                <span className="indicator-dot" />
                <span>{agentOnline ? 'Engine Online (8000)' : 'Standalone'}</span>
              </div>
            </div>
          </div>

          {/* Active Configuration Summary Pill */}
          <div className="topbar-config-pill">
            <span className="config-item">{selectedTypology}</span>
            <span className="config-sep">•</span>
            <span className="config-item">{siteAreaSqm} m²</span>
            <span className="config-sep">•</span>
            <span className="config-item">{aspectRatio}</span>
            <span className="config-sep">•</span>
            <span className="config-item">
              {RENDERING_ENGINES.find((e) => e.id === targetEngine)?.label || 'Nano Banana 2'}
            </span>
          </div>

          {/* Top Actions */}
          <div className="topbar-actions">
            <button
              type="button"
              className="topbar-btn cad-btn"
              onClick={() => exportCadPlan()}
              disabled={isExportingCad}
              title="Generate and export AutoCAD 2D Architectural DXF floor plan"
            >
              <FileCode size={13} />
              <span>{isExportingCad ? 'Exporting CAD...' : 'AutoCAD DXF'}</span>
            </button>

            <button
              type="button"
              className="topbar-btn bim-btn"
              onClick={() => exportBimModel()}
              disabled={isExportingBim}
              title="Synthesize 3D BIM model and open interactive WebGL viewer"
            >
              <Box size={13} />
              <span>{isExportingBim ? 'Building BIM...' : '3D BIM Model'}</span>
            </button>

            <button
              type="button"
              className="topbar-btn reset-btn"
              onClick={clearChat}
              title="Clear conversation and reset to zero-state canvas"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>

            <button
              type="button"
              className="topbar-btn icon-only"
              onClick={refreshAgentHealth}
              disabled={isCheckingHealth}
              title="Probe local agent backend health (E:\Agent)"
            >
              <RefreshCw size={13} className={isCheckingHealth ? 'spin' : ''} />
            </button>
          </div>
        </header>

        {/* Master Studio Workspace Layout */}
        <div className="arch-studio-workspace">
          {/* Main Interaction Canvas */}
          <main className="arch-canvas-panel">
            {/* Conversation / Project Stream */}
            <div className="arch-stream-scroll">
              {/* Zero-State Centered Studio Welcome */}
              {!hasMessages && (
                <div className="zero-state-container">
                  <div className="zero-emblem-wrap">
                    <Compass size={32} />
                  </div>
                  <h2 className="zero-heading">ArchVision Generative Studio</h2>
                  <p className="zero-subheading">
                    Autonomous architectural intelligence with Gemini multimodal vision,
                    spatial programming matrices, regulatory code audits, and CAD/BIM synthesis.
                  </p>

                  <div className="zero-cards-grid">
                    {STARTER_CARDS.map((card, idx) => (
                      <div
                        key={idx}
                        className="starter-card"
                        onClick={() => handleStarterCardClick(card)}
                      >
                        <div className="starter-top-row">
                          {card.icon}
                          <ArrowRight size={13} className="arrow-icon" />
                        </div>
                        <h4 className="starter-title">{card.title}</h4>
                        <p className="starter-desc">{card.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Message Stream */}
              {hasMessages && (
                <div className="messages-flow">
                  {messages.map((message) => {
                    const isUser = message.role === 'user';
                    const data = message.data;

                    return (
                      <div key={message.id} className={`message-cluster ${message.role}`}>
                        {!isUser && (
                          <div className="assistant-avatar">
                            <Bot size={13} />
                          </div>
                        )}

                        <div className="message-envelope">
                          {/* Text Bubble */}
                          <div className="message-bubble">
                            {message.text}
                          </div>

                          {/* Rendered image preview if user attached an image */}
                          {isUser && data?.rendered_image_url && (
                            <div className="user-attached-preview">
                              <img src={data.rendered_image_url} alt="Attached sketch" />
                            </div>
                          )}

                          {/* Architectural Deliverables Dossier (Tabs) */}
                          {!isUser && data && (
                            <ArchitecturalDossier data={data} messageId={message.id} />
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Thinking Spinner */}
                  {isSending && (
                    <div className="message-cluster assistant">
                      <div className="assistant-avatar">
                        <Bot size={13} />
                      </div>
                      <div className="message-envelope">
                        <div className="thinking-bubble">
                          <div className="thinking-spinner" />
                          <span>
                            Synthesizing spatial program, computing geometric offsets & auditing code...
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Live Canvas Node Sync Strip */}
            {activeCanvasNode?.id && (
              <div className="canvas-sync-strip">
                <div className="sync-strip-left">
                  <div className="sync-pulse-indicator" />
                  <div className="sync-thumbnail-wrapper">
                    {activeCanvasNode.image ? (
                      <img
                        src={activeCanvasNode.image}
                        alt="Canvas Node Preview"
                        className="sync-thumbnail-img"
                      />
                    ) : (
                      <Compass size={14} className="sync-placeholder-icon" />
                    )}
                  </div>
                  <div className="sync-meta-info">
                    <div className="sync-meta-header">
                      <span className="sync-badge">CANVAS NODE #{activeCanvasNode.id.slice(0, 8)}</span>
                      <span className="sync-type">({activeCanvasNode.type || 'node'})</span>
                    </div>
                    <span className="sync-prompt-snippet">
                      {activeCanvasNode.prompt ? `"${activeCanvasNode.prompt}"` : 'No prompt set on canvas node'}
                    </span>
                  </div>
                </div>

                <div className="sync-strip-actions">
                  <button
                    type="button"
                    className="sync-action-btn import-btn"
                    onClick={handleImportActiveCanvasNode}
                    title="Import prompt & image from selected canvas node into prompt dock"
                  >
                    <Sparkles size={11} />
                    <span>Import to Agent</span>
                  </button>
                  <button
                    type="button"
                    className="sync-action-btn optimize-btn"
                    onClick={handleOptimizeActiveCanvasNode}
                    disabled={isSending}
                    title="Directly optimize active canvas node with ArchVision Agent"
                  >
                    <Send size={11} />
                    <span>Agent Vision Optimize</span>
                  </button>
                </div>
              </div>
            )}

            {/* Attached Sketch Chip (Above Dock) */}
            {imagePreviewUrl && (
              <div className="attached-sketch-chip">
                <img src={imagePreviewUrl} alt="Attached preview" className="chip-img" />
                <div className="chip-info">
                  <span className="chip-filename">{attachedFile?.name}</span>
                  <span className="chip-note">Attached for Multimodal Vision massing & material analysis</span>
                </div>
                <button
                  type="button"
                  className="chip-close-btn"
                  onClick={() => setAttachedImageFile(null)}
                  title="Remove attached image"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Clean Prompt Dock at Bottom */}
            <div className="arch-prompt-dock">
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleFileChange}
              />

              <button
                type="button"
                className="dock-tool-btn attach-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Attach architectural sketch, floor plan, or facade image"
              >
                <Paperclip size={15} />
              </button>

              <input
                type="text"
                className="dock-input"
                placeholder="Describe your architectural design (e.g. Modern cliffside villa, travertine & glass, 500m²)..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isSending) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />

              <button
                type="button"
                className="dock-synthesize-btn"
                onClick={() => sendMessage()}
                disabled={isSending || (!draft.trim() && !attachedFile)}
                title="Execute architectural reasoning and synthesis"
              >
                <Send size={13} />
                <span>{isSending ? 'Synthesizing...' : 'Synthesize'}</span>
              </button>
            </div>
          </main>

          {/* Right Inspector & Configuration Panel */}
          <aside className="arch-inspector-panel">
            <div className="inspector-header">
              <div className="inspector-title-wrap">
                <Sliders size={13} className="inspector-icon" />
                <h3>Studio Inspector</h3>
              </div>
              <span className="inspector-badge">Active</span>
            </div>

            <div className="inspector-scroll-area">
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
        </div>
      </div>
    </div>
  );
};

export default GeneratePage;
