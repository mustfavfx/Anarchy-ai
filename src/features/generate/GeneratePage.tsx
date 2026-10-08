import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Send,
  Paperclip,
  X,
  Box,
  RefreshCw,
  RotateCcw,
  Compass,
  FileCode,
  ArrowRight,
  Sparkles,
  Sliders,
  MessageSquare,
  Edit2,
  Check,
} from 'lucide-react';
import {
  useAgentChat,
  RENDERING_ENGINES,
} from './hooks/useAgentChat';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { canvasBridge } from '../../services/agent/CanvasBridgeService';
import { useResolvedImage } from '../../hooks/useResolvedImage';
import { STARTER_CARDS } from './constants';
import { StudioInspector } from './components/StudioInspector';
import { AgentSessionsSidebar } from './components/AgentSessionsSidebar';
import { AgentMessageBubble } from './components/AgentMessageBubble';
import { ImageLightboxModal } from './components/ImageLightboxModal';
import './GeneratePage.css';

export const GeneratePage: React.FC = () => {
  const {
    agentOnline,
    isCheckingHealth,
    refreshAgentHealth,

    selectedModel,
    setSelectedModel,
    selectedModelInfo,

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
    deleteMessage,

    sessions,
    activeSessionId,
    activeSession,
    createNewSession,
    switchSession,
    renameSession,
    deleteSession,
    clearAllSessions,

    isExportingCad,
    exportCadPlan,
    isExportingBim,
    exportBimModel,
    execute3DModeling,
  } = useAgentChat();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [previewImage, setPreviewImage] = useState<{ url: string; title?: string } | null>(null);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [sessionTitleDraft, setSessionTitleDraft] = useState('');

  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);
  const [showTypologyDropdown, setShowTypologyDropdown] = useState(false);
  const [showEngineDropdown, setShowEngineDropdown] = useState(false);

  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const styleDropdownRef = useRef<HTMLDivElement>(null);
  const typologyDropdownRef = useRef<HTMLDivElement>(null);
  const engineDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeCanvasNode = useAIConfigStore((s) => s.selectedNode);
  const canvasImages = useAIConfigStore((s) => s.canvasImages);
  const addNotification = useNotificationStore((s) => s.addNotification);

  // If activeCanvasNode has no image or id, fallback to the first canvas node with an image
  const currentCanvasNode = (activeCanvasNode?.image || activeCanvasNode?.originalImage || activeCanvasNode?.id)
    ? activeCanvasNode
    : (canvasImages.length > 0 ? {
        id: canvasImages[0].id,
        type: (canvasImages[0].type as any) || 'source',
        image: canvasImages[0].image,
        originalImage: canvasImages[0].originalImage,
        prompt: canvasImages[0].prompt,
        state: 'ready',
        dimensions: canvasImages[0].dimensions,
      } : null);

  const resolvedCanvasImage = useResolvedImage(currentCanvasNode?.image || currentCanvasNode?.originalImage);

  const handleImportActiveCanvasNode = async () => {
    const node = canvasBridge.getActiveNode();
    if (!node?.id) return;
    if (node.prompt) {
      setDraft(node.prompt);
    }
    const blob = await canvasBridge.getActiveNodeImageBlob();
    if (blob) {
      const file = new File([blob], `canvas_node_${node.id.slice(0, 6)}.png`, { type: blob.type || 'image/png' });
      (file as any).__previewUrl = URL.createObjectURL(blob);
      setAttachedImageFile(file);
    }
    addNotification({
      type: 'success',
      title: 'Canvas Node Imported',
      message: `Loaded prompt & visual assets from node #${node.id.slice(0, 8)}.`,
      duration: 3000,
    });
  };

  const handleOptimizeActiveCanvasNode = async () => {
    const node = canvasBridge.getActiveNode();
    if (!node?.id) return;
    const blob = await canvasBridge.getActiveNodeImageBlob();
    const promptText = (node.prompt || draft || '').trim() || 'Analyze architectural composition and synthesize an optimized visual prompt';
    
    let fileToPass: File | null = null;
    if (blob) {
      fileToPass = new File([blob], `canvas_node_${node.id.slice(0, 6)}.png`, { type: blob.type || 'image/png' });
      (fileToPass as any).__previewUrl = URL.createObjectURL(blob);
    }
    
    sendMessage(promptText, fileToPass);
  };

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!modelDropdownRef.current?.contains(target)) setShowModelDropdown(false);
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

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [draft]);

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

  const handleStartTitleEdit = () => {
    setSessionTitleDraft(activeSession?.title || 'Architectural Session');
    setIsEditingTitle(true);
  };

  const handleSaveTitleEdit = () => {
    if (activeSessionId && sessionTitleDraft.trim()) {
      renameSession(activeSessionId, sessionTitleDraft.trim());
    }
    setIsEditingTitle(false);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="arch-studio-page">
      <div className="arch-studio-shell">
        {/* Minimalist Topbar Header */}
        <header className="arch-studio-topbar">
          <div className="topbar-identity">
            {/* Toggle Sessions Sidebar Button */}
            <button
              type="button"
              className={`topbar-toggle-btn ${isSidebarOpen ? 'active' : ''}`}
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title="Toggle Sessions Sidebar"
            >
              <MessageSquare size={14} />
              <span>Sessions</span>
              <span className="topbar-session-count">{sessions.length}</span>
            </button>

            <div className="topbar-emblem">
              <Compass size={16} />
            </div>

            {/* Editable Session Title */}
            <div className="topbar-title-wrap">
              {isEditingTitle ? (
                <div className="topbar-title-edit-form">
                  <input
                    type="text"
                    autoFocus
                    className="topbar-title-input"
                    value={sessionTitleDraft}
                    onChange={(e) => setSessionTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitleEdit();
                      if (e.key === 'Escape') setIsEditingTitle(false);
                    }}
                  />
                  <button type="button" className="topbar-title-save-btn" onClick={handleSaveTitleEdit}>
                    <Check size={12} />
                  </button>
                </div>
              ) : (
                <div className="topbar-title-display" onClick={handleStartTitleEdit} title="Click to rename session">
                  <span className="topbar-product">{activeSession?.title || 'ArchVision AI Studio'}</span>
                  <Edit2 size={11} className="title-edit-hint-icon" />
                </div>
              )}

              <div className={`status-indicator-pill ${agentOnline ? 'online' : 'offline'}`}>
                <span className="indicator-dot" />
                <span>{agentOnline ? 'Engine Online (8000)' : 'Standalone'}</span>
              </div>
            </div>
          </div>

          {/* Active Configuration Summary Pill */}
          <div className="topbar-config-pill">
            <span className="config-item model-pill-highlight">
              <Bot size={11} style={{ marginRight: '4px', verticalAlign: 'middle', color: '#c084fc' }} />
              {selectedModelInfo?.label || 'Gemini 3.6 Flash'}
            </span>
            <span className="config-sep">•</span>
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
              title="Clear current session messages and start fresh"
            >
              <RotateCcw size={12} />
              <span>Clear</span>
            </button>

            <button
              type="button"
              className="topbar-btn icon-only"
              onClick={refreshAgentHealth}
              disabled={isCheckingHealth}
              title="Check local agent connection"
            >
              <RefreshCw size={13} className={isCheckingHealth ? 'spin' : ''} />
            </button>

            {/* Toggle Inspector Button */}
            <button
              type="button"
              className={`topbar-btn inspector-toggle-btn ${isInspectorOpen ? 'active' : ''}`}
              onClick={() => setIsInspectorOpen(!isInspectorOpen)}
              title="Toggle Studio Inspector"
            >
              <Sliders size={13} />
              <span>Inspector</span>
            </button>
          </div>
        </header>

        {/* Master Studio Workspace Layout */}
        <div className="arch-studio-workspace">
          {/* Left Sessions Sidebar */}
          <AgentSessionsSidebar
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelectSession={switchSession}
            onNewSession={() => createNewSession()}
            onRenameSession={renameSession}
            onDeleteSession={deleteSession}
            onClearAllSessions={clearAllSessions}
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          />

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
                    Intelligent Architectural Studio: 3D spatial reasoning, building code compliance, autonomous 3ds Max modeling, and ultra-detailed render synthesis.
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
                  {messages.map((message) => (
                    <AgentMessageBubble
                      key={message.id}
                      message={message}
                      onDeleteMessage={deleteMessage}
                      onPreviewImage={(url, title) => setPreviewImage({ url, title })}
                      onExecute3DModeling={execute3DModeling}
                      selectedModelLabel={selectedModelInfo?.label}
                    />
                  ))}

                  {/* Thinking Spinner */}
                  {isSending && (
                    <div className="pro-message-cluster assistant-cluster">
                      <div className="pro-message-envelope">
                        <div className="pro-message-header">
                          <div className="pro-message-author">
                            <div className="pro-avatar-badge assistant-badge thinking-glow">
                              <Bot size={13} />
                            </div>
                            <span className="pro-author-name">{selectedModelInfo?.label || 'ArchVision Resident'}</span>
                          </div>
                        </div>
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
            {currentCanvasNode?.id && (
              <div className="canvas-sync-strip">
                <div className="sync-strip-left">
                  <div className="sync-pulse-indicator" />
                  <div className="sync-thumbnail-wrapper">
                    {resolvedCanvasImage ? (
                      <img
                        src={resolvedCanvasImage}
                        alt="Canvas Node Preview"
                        className="sync-thumbnail-img"
                      />
                    ) : (
                      <Compass size={14} className="sync-placeholder-icon" />
                    )}
                  </div>
                  <div className="sync-meta-info">
                    <div className="sync-meta-header">
                      <span className="sync-badge">CANVAS NODE #{currentCanvasNode.id.slice(0, 8)}</span>
                      <span className="sync-type">({currentCanvasNode.type || 'node'})</span>
                      {canvasImages.length > 1 && (
                        <span className="sync-count-badge">{canvasImages.length} images on canvas</span>
                      )}
                    </div>
                    <span className="sync-prompt-snippet">
                      {currentCanvasNode.prompt ? `"${currentCanvasNode.prompt}"` : 'No prompt set on canvas node'}
                    </span>
                  </div>
                </div>

                {canvasImages.length > 1 && (
                  <div className="sync-nodes-selector">
                    {canvasImages.slice(0, 6).map((imgNode) => (
                      <button
                        key={imgNode.id}
                        type="button"
                        className={`sync-node-chip ${imgNode.id === currentCanvasNode.id ? 'active' : ''}`}
                        onClick={() => canvasBridge.setActiveNodeById(imgNode.id)}
                        title={`Select node #${imgNode.id.slice(0, 6)}`}
                      >
                        #{imgNode.id.slice(0, 4)}
                      </button>
                    ))}
                  </div>
                )}

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

            {/* Clean Professional Prompt Dock at Bottom */}
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
                title="Attach architectural sketch, floorplan, or facade"
              >
                <Paperclip size={15} />
              </button>

              <textarea
                ref={textareaRef}
                rows={1}
                className="dock-textarea"
                placeholder="Describe your architectural design (e.g., Modern residential villa, 500m², balanced spatial flow, daylight render...)"
                value={draft}
                dir="auto"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !isSending) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />

              <button
                type="button"
                className={`dock-synthesize-btn ${isSending ? 'is-loading' : ''}`}
                onClick={() => sendMessage()}
                disabled={isSending || (!draft.trim() && !attachedFile)}
                title="Synthesize and consult ArchVision Agent (Enter)"
              >
                <Send size={13} />
                <span>{isSending ? 'Processing...' : 'Synthesize'}</span>
              </button>
            </div>
          </main>

          {/* Right Inspector & Configuration Panel (Collapsible) */}
          {isInspectorOpen && (
            <StudioInspector
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              selectedModelInfo={selectedModelInfo}
              showModelDropdown={showModelDropdown}
              setShowModelDropdown={setShowModelDropdown}
              modelDropdownRef={modelDropdownRef}
              selectedTypology={selectedTypology}
              setSelectedTypology={setSelectedTypology}
              showTypologyDropdown={showTypologyDropdown}
              setShowTypologyDropdown={setShowTypologyDropdown}
              typologyDropdownRef={typologyDropdownRef}
              selectedStyle={selectedStyle}
              setSelectedStyle={setSelectedStyle}
              showStyleDropdown={showStyleDropdown}
              setShowStyleDropdown={setShowStyleDropdown}
              styleDropdownRef={styleDropdownRef}
              siteAreaSqm={siteAreaSqm}
              setSiteAreaSqm={setSiteAreaSqm}
              targetEngine={targetEngine}
              setTargetEngine={setTargetEngine}
              showEngineDropdown={showEngineDropdown}
              setShowEngineDropdown={setShowEngineDropdown}
              engineDropdownRef={engineDropdownRef}
              aspectRatio={aspectRatio}
              setAspectRatio={setAspectRatio}
              autoRender={autoRender}
              setAutoRender={setAutoRender}
              exportCadPlan={exportCadPlan}
              isExportingCad={isExportingCad}
              exportBimModel={exportBimModel}
              isExportingBim={isExportingBim}
              setDraft={setDraft}
            />
          )}
        </div>
      </div>

      {/* Image Lightbox Modal */}
      <ImageLightboxModal
        imageUrl={previewImage?.url || null}
        title={previewImage?.title}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
};

export default GeneratePage;
