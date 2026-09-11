import React from 'react';
import {
  type LayoutRegion,
  type LayoutData,
  type TextOverlay,
  type StickyNote,
  type ImageAdjustments,
  type CropBounds,
  type LayoutEditorProps,
  type TreeNode,
  type ChatMessage,
  REGION_COLORS,
  DEFAULT_ADJUSTMENTS,
  DEFAULT_CROP_BOUNDS,
  buildReveHierarchyTree,
} from './layout/types';
import { AnalyzedSceneCard } from './layout/AnalyzedSceneCard';
import { LayoutGalleryView } from './layout/LayoutGalleryView';
import { LayoutHeader } from './layout/LayoutHeader';
import { LayoutStage } from './layout/LayoutStage';
import { LayoutBottomToolbar } from './layout/LayoutBottomToolbar';
import { LayoutApiKeyModal } from './layout/LayoutApiKeyModal';
import { ReframePanel } from './layout/panels/ReframePanel';
import { AdjustmentsPanel } from './layout/panels/AdjustmentsPanel';
import { TextPropertiesPanel } from './layout/panels/TextPropertiesPanel';
import { LayersHierarchyPanel } from './layout/panels/LayersHierarchyPanel';
import { useLayoutEditorState } from './layout/hooks/useLayoutEditorState';
import './LayoutEditor.css';

// Re-export all original public types and helpers for complete zero-breakage backward compatibility
export type {
  LayoutRegion,
  LayoutData,
  TextOverlay,
  StickyNote,
  ImageAdjustments,
  CropBounds,
  LayoutEditorProps,
  TreeNode,
  ChatMessage,
};
export {
  AnalyzedSceneCard,
  REGION_COLORS,
  DEFAULT_ADJUSTMENTS,
  DEFAULT_CROP_BOUNDS,
  buildReveHierarchyTree,
};

export const LayoutEditor: React.FC<LayoutEditorProps> = (props) => {
  const state = useLayoutEditorState(props);

  if (!state.currentTargetImage) {
    return (
      <LayoutGalleryView
        className={props.className}
        availableImages={state.availableImages}
        onSelectImage={(url) => {
          state.setActiveStageImage(url);
          state.setImageHistory(prev => (prev.includes(url) ? prev : [url, ...prev]));
        }}
      />
    );
  }

  return (
    <div className={`layout-editor-container anarchy-studio-theme ${props.className || ''}`}>
      {/* Top Header Bar */}
      <LayoutHeader
        layout={state.layout}
        activeToolbarTool={state.activeToolbarTool}
        setActiveToolbarTool={state.setActiveToolbarTool}
        targetImage={state.currentTargetImage}
        isExtracting={state.isExtracting}
        isRendering={state.isRendering}
        onExtractLayout={state.handleExtractLayout}
      />

      {/* Main Content Grid */}
      <div className="layout-editor-body">
        {/* Visual Interactive Canvas Stage */}
        <LayoutStage
          isEnlargedView={props.isEnlargedView}
          imageHistory={state.imageHistory}
          activeStageImage={state.activeStageImage}
          setActiveStageImage={state.setActiveStageImage}
          zoomLevel={state.zoomLevel}
          setZoomLevel={state.setZoomLevel}
          reframeScale={state.reframeScale}
          setReframeScale={state.setReframeScale}
          totalScaleFactor={state.totalScaleFactor}
          isExtracting={state.isExtracting}
          isRendering={state.isRendering}
          extractError={state.extractError}
          handleExtractLayout={state.handleExtractLayout}
          isReframeActive={state.isReframeActive}
          stageRef={state.stageRef}
          imageContainerRef={state.imageContainerRef}
          handleStageMouseDown={state.handleStageMouseDown}
          handleStageMouseMove={state.handleStageMouseMove}
          handleStageMouseUp={state.handleStageMouseUp}
          resolvedUrl={state.resolvedUrl}
          displayImage={state.displayImage}
          rawImage={state.rawImage}
          filterStyle={state.filterStyle}
          activeToolbarTool={state.activeToolbarTool}
          maskCanvasRef={state.maskCanvasRef}
          vanishingPoint={state.vanishingPoint}
          setVanishingPoint={state.setVanishingPoint}
          setIsDragging3DVanishingPoint={state.setIsDragging3DVanishingPoint}
          textOverlays={state.textOverlays}
          setTextOverlays={state.setTextOverlays}
          activeTextId={state.activeTextId}
          setActiveTextId={state.setActiveTextId}
          setDraggingTextId={state.setDraggingTextId}
          setTextDragStartPos={state.setTextDragStartPos}
          setInitialTextPos={state.setInitialTextPos}
          stickyNotes={state.stickyNotes}
          setStickyNotes={state.setStickyNotes}
          setDraggingNoteId={state.setDraggingNoteId}
          setNoteDragStartPos={state.setNoteDragStartPos}
          setInitialNotePos={state.setInitialNotePos}
          isDrawingBbox={state.isDrawingBbox}
          drawStart={state.drawStart}
          drawCurrent={state.drawCurrent}
          layout={state.layout}
          selectedRegionIdx={state.selectedRegionIdx}
          selectedRegion={state.selectedRegion}
          handleSelectRegion={state.handleSelectRegion}
          setSelectedRegionIdx={state.setSelectedRegionIdx}
          searchQuery={state.searchQuery}
          regionPrompts={state.regionPrompts}
          updateRegionPrompt={state.updateRegionPrompt}
          activeEditingIdx={state.activeEditingIdx}
          setActiveEditingIdx={state.setActiveEditingIdx}
          handleApplyEdits={state.handleApplyEdits}
          maskPrompt={state.maskPrompt}
          setMaskPrompt={state.setMaskPrompt}
          handleApplyMaskEdit={state.handleApplyMaskEdit}
          cropBounds={state.cropBounds}
          activeCropHandle={state.activeCropHandle}
          hoveredRegionIdx={state.hoveredRegionIdx}
          setHoveredRegionIdx={state.setHoveredRegionIdx}
          activeRegionHandle={state.activeRegionHandle}
          handleRegionHandleMouseDown={state.handleRegionHandleMouseDown}
          handleCropHandleMouseDown={state.handleCropHandleMouseDown}
          brushSize={state.brushSize}
          setBrushSize={state.setBrushSize}
          brushColor={state.brushColor}
          setBrushColor={state.setBrushColor}
          clearMaskCanvas={state.clearMaskCanvas}
          fileInputRef={state.fileInputRef}
        />

        {/* Floating Bottom Toolbar */}
        <LayoutBottomToolbar
          activeToolbarTool={state.activeToolbarTool}
          setActiveToolbarTool={state.setActiveToolbarTool}
          isReframeActive={state.isReframeActive}
          setIsReframeActive={state.setIsReframeActive}
          showAddImageMenu={state.showAddImageMenu}
          setShowAddImageMenu={state.setShowAddImageMenu}
          onFileUpload={state.handleFileUpload}
        />

        {/* Right Side Panel */}
        {state.isReframeActive ? (
          <ReframePanel
            reframeTab={state.reframeTab}
            setReframeTab={state.setReframeTab}
            setIsReframeActive={state.setIsReframeActive}
            referenceImageMode={state.referenceImageMode}
            setReferenceImageMode={state.setReferenceImageMode}
            showAspectDropdown={state.showAspectDropdown}
            setShowAspectDropdown={state.setShowAspectDropdown}
            selectedAspectRatio={state.selectedAspectRatio}
            applyAspectRatioToCrop={state.applyAspectRatioToCrop}
            reframeScale={state.reframeScale}
            setReframeScale={state.setReframeScale}
            relayoutSelections={state.relayoutSelections}
            toggleRelayoutSelection={state.toggleRelayoutSelection}
            handleApplyReframe={state.handleApplyReframe}
            isRendering={state.isRendering}
          />
        ) : state.activeToolbarTool === 'adjust' ? (
          <AdjustmentsPanel
            adjustments={state.adjustments}
            setAdjustments={state.setAdjustments}
            onClose={() => state.setActiveToolbarTool('select')}
            onShuffle={state.handleShuffleAdjustments}
            onReset={state.handleResetAdjustments}
          />
        ) : state.activeToolbarTool === 'text' ? (
          <TextPropertiesPanel
            onClose={() => state.setActiveToolbarTool('select')}
          />
        ) : (
          <LayersHierarchyPanel
            panelMode={state.panelMode}
            setPanelMode={state.setPanelMode}
            combinedAnalyzedScenes={state.combinedAnalyzedScenes}
            currentTargetImage={state.currentTargetImage}
            setActiveStageImage={state.setActiveStageImage}
            setLayout={state.setLayout}
            onLayoutExtracted={props.onLayoutExtracted}
            deleteSavedScene={state.deleteSavedScene}
            layout={state.layout}
            searchQuery={state.searchQuery}
            setSearchQuery={state.setSearchQuery}
            extractError={state.extractError}
            isExtracting={state.isExtracting}
            isRendering={state.isRendering}
            handleExtractLayout={state.handleExtractLayout}
            setShowKeyModal={state.setShowKeyModal}
            isGroupExpanded={state.isGroupExpanded}
            setIsGroupExpanded={state.setIsGroupExpanded}
            cropThumbnails={state.cropThumbnails}
            hierarchyTree={state.hierarchyTree}
            selectedRegionIdx={state.selectedRegionIdx}
            hoveredRegionIdx={state.hoveredRegionIdx}
            activeEditingIdx={state.activeEditingIdx}
            expandedNodes={state.expandedNodes}
            regionPrompts={state.regionPrompts}
            cardRefs={state.cardRefs}
            handleSelectRegion={state.handleSelectRegion}
            setHoveredRegionIdx={state.setHoveredRegionIdx}
            setActiveEditingIdx={state.setActiveEditingIdx}
            toggleNodeExpand={state.toggleNodeExpand}
            updateRegionPrompt={state.updateRegionPrompt}
            askAnarchyPrompt={state.askAnarchyPrompt}
            setAskAnarchyPrompt={state.setAskAnarchyPrompt}
            handleSendAskAnarchy={state.handleSendAskAnarchy}
            handleApplyEdits={state.handleApplyEdits}
            fileInputRef={state.fileInputRef}
            showMentionMenu={state.showMentionMenu}
            setShowMentionMenu={state.setShowMentionMenu}
          />
        )}
      </div>

      {/* Anarchy AI API Key Modal Dialog */}
      <LayoutApiKeyModal
        showKeyModal={state.showKeyModal}
        setShowKeyModal={state.setShowKeyModal}
        inputKey={state.inputKey}
        setInputKey={state.setInputKey}
        onSaveAndRetry={() => {
          if (state.inputKey.trim()) {
            localStorage.setItem('anarchy_api_key', state.inputKey.trim());
            state.setShowKeyModal(false);
            state.setExtractError(null);
            state.handleExtractLayout(true);
          }
        }}
      />
    </div>
  );
};

export default LayoutEditor;
