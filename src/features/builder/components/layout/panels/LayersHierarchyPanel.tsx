import React from 'react';
import {
  Edit3, Layers, Search, X, AlertCircle, Loader2, Key, RefreshCw,
  Coins, ChevronDown, ChevronRight, Paperclip, AtSign, Tag, Sparkles, ArrowUp
} from 'lucide-react';
import { AnalyzedSceneCard } from '../AnalyzedSceneCard';
import { HierarchyTree } from './HierarchyTree';
import { getModelCost } from '../../../../../services/credit/creditService';
import { type LayoutData, type TreeNode, REGION_COLORS } from '../types';

export interface LayersHierarchyPanelProps {
  panelMode: 'edit' | 'chat';
  setPanelMode: (mode: 'edit' | 'chat') => void;
  combinedAnalyzedScenes: any[];
  currentTargetImage: string | null;
  setActiveStageImage: (url: string) => void;
  setLayout: (layout: LayoutData | null) => void;
  onLayoutExtracted?: (extractedLayout: any) => void;
  deleteSavedScene: (url: string) => void;
  layout: LayoutData | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  extractError: string | null;
  isExtracting: boolean;
  isRendering: boolean;
  handleExtractLayout: (force: boolean) => void;
  setShowKeyModal: (show: boolean) => void;
  isGroupExpanded: boolean;
  setIsGroupExpanded: (expanded: boolean) => void;
  cropThumbnails: Record<number, string>;
  hierarchyTree: TreeNode[];
  selectedRegionIdx: number | null;
  hoveredRegionIdx: number | null;
  activeEditingIdx: number | null;
  expandedNodes: Record<number, boolean>;
  regionPrompts: Record<number, string>;
  cardRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
  handleSelectRegion: (idx: number) => void;
  setHoveredRegionIdx: (idx: number | null) => void;
  setActiveEditingIdx: (idx: number | null) => void;
  toggleNodeExpand: (idx: number, e: React.MouseEvent) => void;
  updateRegionPrompt: (idx: number, prompt: string) => void;
  askAnarchyPrompt: string;
  setAskAnarchyPrompt: React.Dispatch<React.SetStateAction<string>>;
  handleSendAskAnarchy: () => void;
  handleApplyEdits: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  showMentionMenu: boolean;
  setShowMentionMenu: (show: boolean) => void;
}

export const LayersHierarchyPanel: React.FC<LayersHierarchyPanelProps> = ({
  panelMode,
  setPanelMode,
  combinedAnalyzedScenes,
  currentTargetImage,
  setActiveStageImage,
  setLayout,
  onLayoutExtracted,
  deleteSavedScene,
  layout,
  searchQuery,
  setSearchQuery,
  extractError,
  isExtracting,
  isRendering,
  handleExtractLayout,
  setShowKeyModal,
  isGroupExpanded,
  setIsGroupExpanded,
  cropThumbnails,
  hierarchyTree,
  selectedRegionIdx,
  hoveredRegionIdx,
  activeEditingIdx,
  expandedNodes,
  regionPrompts,
  cardRefs,
  handleSelectRegion,
  setHoveredRegionIdx,
  setActiveEditingIdx,
  toggleNodeExpand,
  updateRegionPrompt,
  askAnarchyPrompt,
  setAskAnarchyPrompt,
  handleSendAskAnarchy,
  handleApplyEdits,
  fileInputRef,
  showMentionMenu,
  setShowMentionMenu,
}) => {
  return (
    <div className="layout-layers-panel">
      {/* Website-Style Mode Switcher Header: Edit | Analyzed Scenes */}
      <div className="panel-mode-switcher-bar">
        <div className="mode-tab-group">
          <button
            type="button"
            className={`mode-tab-btn ${panelMode === 'edit' ? 'active' : ''}`}
            onClick={() => setPanelMode('edit')}
          >
            <Edit3 size={13} />
            <span>Edit</span>
          </button>
          <button
            type="button"
            className={`mode-tab-btn ${panelMode === 'chat' ? 'active' : ''}`}
            onClick={() => setPanelMode('chat')}
          >
            <Layers size={13} />
            <span>Analyzed Scenes ({combinedAnalyzedScenes.length})</span>
          </button>
        </div>
      </div>

      {panelMode === 'chat' ? (
        <div className="analyzed-scenes-panel-body">
          <div className="scenes-header-info">
            <div className="scenes-title-row">
              <Layers size={15} className="text-red" />
              <span className="scenes-title">Analyzed Scenes Library</span>
              <span className="scenes-count-badge">{combinedAnalyzedScenes.length} Saved</span>
            </div>
            <p className="scenes-desc">
              All images analyzed with Reve API are permanently saved here. Click any image card below to load its 3D objects and layers into the editor instantly without re-scanning or spending credits.
            </p>
          </div>

          <div className="scenes-cards-list">
            {combinedAnalyzedScenes.length === 0 ? (
              <div className="layout-editor-empty" style={{ padding: '30px 10px' }}>
                <Layers size={32} className="empty-icon text-red" />
                <p style={{ marginTop: '10px', fontSize: '12px', color: '#94a3b8' }}>
                  No analyzed scenes saved yet. Analyze any image to store its layout here permanently.
                </p>
              </div>
            ) : (
              combinedAnalyzedScenes.map((scene, idx) => {
                const isActive = scene.url === currentTargetImage;
                return (
                  <AnalyzedSceneCard
                    key={scene.id || idx}
                    scene={scene}
                    isActive={isActive}
                    onSelect={() => {
                      setActiveStageImage(scene.url);
                      if (scene.layout) {
                        setLayout(scene.layout);
                        onLayoutExtracted?.(scene.layout);
                      }
                      setPanelMode('edit');
                    }}
                    onDelete={() => deleteSavedScene(scene.url)}
                  />
                );
              })
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="panel-subtitle">
            <div className="subtitle-top">
              <span>Extracted Layers</span>
              <span className="hint-text">{layout?.regions?.length || 0} objects</span>
            </div>
            
            {layout?.regions && layout.regions.length > 5 && (
              <div className="layers-search-box">
                <Search size={12} className="search-icon" />
                <input
                  type="text"
                  placeholder="Filter objects (e.g. woman, pool)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="layers-search-input"
                />
                {searchQuery && (
                  <button type="button" className="clear-search-btn" onClick={() => setSearchQuery('')}>
                    <X size={11} />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="layers-scroll-list">
            {extractError && !isExtracting && (
              <div className="layers-empty-state error">
                <AlertCircle size={22} className="text-red" />
                <span className="empty-title">Layout Scan Error</span>
                <small className="empty-desc">{extractError}</small>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button type="button" onClick={() => handleExtractLayout(true)} disabled={isExtracting} className="retry-btn">
                    {isExtracting ? <Loader2 size={13} className="animate-spin" /> : null}
                    <span>{isExtracting ? 'Retrying...' : 'Retry Scan'}</span>
                  </button>
                  <button type="button" onClick={() => setShowKeyModal(true)} className="retry-btn" style={{ background: '#f43f5e', color: '#fff', borderColor: '#f43f5e' }}>
                    <Key size={13} />
                    <span>Set API Key</span>
                  </button>
                </div>
              </div>
            )}

            {(!layout?.regions || layout.regions.length === 0) && !isExtracting && !extractError && (
              <div className="layers-empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '36px 16px', textAlign: 'center', gap: '14px' }}>
                <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(225, 29, 72, 0.12)', border: '1px solid rgba(225, 29, 72, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e11d48' }}>
                  <Layers size={26} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span className="empty-title" style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
                    Scene Not Analyzed Yet
                  </span>
                  <small className="empty-desc" style={{ fontSize: '12px', color: '#94a3b8', maxWidth: '240px', lineHeight: 1.5 }}>
                    Click "Scan Scene" to extract 3D elements, objects and layers for this image.
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() => handleExtractLayout(true)}
                  disabled={isExtracting || !currentTargetImage}
                  style={{
                    marginTop: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '13px',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(225, 29, 72, 0.45)',
                    transition: 'transform 0.15s ease'
                  }}
                >
                  <RefreshCw size={14} className={isExtracting ? 'animate-spin' : ''} />
                  <span>{isExtracting ? 'Scanning...' : 'Scan Scene'}</span>
                  <span style={{ fontSize: '11px', opacity: 0.95, background: 'rgba(0,0,0,0.35)', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Coins size={10} /> {getModelCost('reve/extract-layout')} cr
                  </span>
                </button>
              </div>
            )}

            {layout?.regions && layout.regions.length > 0 && (
              <div className="reve-accordion-group">
                <div
                  className="reve-group-header"
                  onClick={() => setIsGroupExpanded(!isGroupExpanded)}
                >
                  <div className="reve-group-title">
                    {cropThumbnails[0] ? (
                      <img src={cropThumbnails[0]} alt="Group Thumb" className="reve-group-thumb" />
                    ) : (
                      <div className="reve-group-thumb-placeholder" />
                    )}
                    <span>Generated Image</span>
                  </div>
                  {isGroupExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>

                {isGroupExpanded && (
                  <div className="reve-group-items">
                    <HierarchyTree
                      nodes={hierarchyTree}
                      selectedRegionIdx={selectedRegionIdx}
                      hoveredRegionIdx={hoveredRegionIdx}
                      activeEditingIdx={activeEditingIdx}
                      expandedNodes={expandedNodes}
                      cropThumbnails={cropThumbnails}
                      regionPrompts={regionPrompts}
                      cardRefs={cardRefs}
                      onSelectRegion={handleSelectRegion}
                      setHoveredRegionIdx={setHoveredRegionIdx}
                      setActiveEditingIdx={setActiveEditingIdx}
                      toggleNodeExpand={toggleNodeExpand}
                      updateRegionPrompt={updateRegionPrompt}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Reve-Style Floating Ask Anarchy AI Prompt Box with Single Apply Button */}
      <div className="ask-anarchy-prompt-container">
        <div className="ask-anarchy-input-row">
          <input
            type="text"
            className="ask-anarchy-text-input"
            placeholder="Ask Anarchy AI..."
            value={askAnarchyPrompt}
            onChange={(e) => setAskAnarchyPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (askAnarchyPrompt.trim()) {
                  handleSendAskAnarchy();
                } else {
                  handleApplyEdits();
                }
              }
            }}
          />
        </div>
        <div className="ask-anarchy-tools-row">
          <div className="ask-tools-left">
            <button
              type="button"
              className="ask-tool-btn"
              title="Attach asset"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip size={14} />
            </button>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className={`ask-tool-btn ${showMentionMenu ? 'active' : ''}`}
                title="Mention object (@)"
                onClick={() => setShowMentionMenu(!showMentionMenu)}
              >
                <AtSign size={14} />
              </button>
              {showMentionMenu && (
                <div
                  className="mention-objects-popup dark-studio"
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: 0,
                    marginBottom: '6px',
                    width: '210px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    background: '#0f172a',
                    border: '1px solid rgba(244,63,94,0.4)',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.6)',
                    zIndex: 99999,
                    padding: '4px'
                  }}
                >
                  <div style={{ fontSize: '10px', color: '#94a3b8', padding: '4px 6px', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    Mention Detected Object
                  </div>
                  {(layout?.regions || []).map((reg, idx) => (
                    <button
                      key={idx}
                      type="button"
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '6px 8px',
                        background: 'none',
                        border: 'none',
                        color: '#f8fafc',
                        fontSize: '11.5px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(244,63,94,0.2)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                      onClick={() => {
                        setAskAnarchyPrompt(prev => `${prev} @${reg.label} `);
                        setShowMentionMenu(false);
                      }}
                    >
                      <Tag size={10} style={{ color: REGION_COLORS[idx % REGION_COLORS.length] }} />
                      <span>{reg.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="ask-tool-btn rainbow-icon"
              title="AI Style Preset"
              onClick={() => setAskAnarchyPrompt(prev => prev + ' [Style]')}
            >
              <Sparkles size={14} className="text-purple-grad" />
            </button>
          </div>
          <button
            type="button"
            className="ask-anarchy-apply-btn"
            onClick={() => {
              if (askAnarchyPrompt.trim()) {
                handleSendAskAnarchy();
              } else {
                handleApplyEdits();
              }
            }}
            disabled={isRendering || isExtracting}
            title="Apply changes via Anarchy AI (2.1 credits)"
          >
            {isRendering ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <>
                <span>Apply</span>
                <ArrowUp size={13} />
                <span className="ask-credit-badge">2.1 cr</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
