import React from 'react';
import { Layers, Download, Sliders, RefreshCw, Coins } from 'lucide-react';
import { downloadImage } from '../../../../utils/imageExport';
import { getModelCost } from '../../../../services/credit/creditService';
import type { LayoutData } from './types';

export interface LayoutHeaderProps {
  layout: LayoutData | null;
  activeToolbarTool: string;
  setActiveToolbarTool: (tool: any) => void;
  targetImage: string | null;
  isExtracting: boolean;
  isRendering: boolean;
  onExtractLayout: (force: boolean) => void;
}

export const LayoutHeader: React.FC<LayoutHeaderProps> = ({
  layout,
  activeToolbarTool,
  setActiveToolbarTool,
  targetImage,
  isExtracting,
  isRendering,
  onExtractLayout,
}) => {
  return (
    <div className="layout-editor-header">
      <div className="header-title">
        <Layers size={16} className="title-icon text-red" />
        <span className="header-title-text">Interactive Layers & Objects</span>
        {layout?.regions && (
          <span className="badge-count" title={`${layout.regions.length} Objects`}>
            <span className="badge-full">{layout.regions.length} Objects</span>
            <span className="badge-short">{layout.regions.length}</span>
          </span>
        )}
      </div>
      
      <div className="header-right-actions">
        <button
          type="button"
          className="export-btn"
          onClick={() => {
            if (targetImage) {
              downloadImage(targetImage, 'anarchy-layer-scene');
            }
          }}
          title="Export current stage image"
        >
          <Download size={13} />
          <span className="btn-label">Export</span>
        </button>

        <button
          type="button"
          className={`adjust-toggle-btn ${activeToolbarTool === 'adjust' ? 'active' : ''}`}
          onClick={() => setActiveToolbarTool(activeToolbarTool === 'adjust' ? 'select' : 'adjust')}
          title="Adjust photo settings"
        >
          <Sliders size={13} />
          <span className="btn-label">Adjust</span>
        </button>

        <button
          type="button"
          className="refresh-btn scan-scene-btn"
          onClick={() => onExtractLayout(true)}
          disabled={isExtracting || isRendering || !targetImage}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: (!layout?.regions || layout.regions.length === 0)
              ? 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)'
              : 'rgba(30, 41, 59, 0.8)',
            color: '#ffffff',
            border: (!layout?.regions || layout.regions.length === 0)
              ? 'none'
              : '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '6px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: (isExtracting || isRendering || !targetImage) ? 'not-allowed' : 'pointer',
            boxShadow: (!layout?.regions || layout.regions.length === 0) ? '0 2px 8px rgba(225, 29, 72, 0.4)' : 'none',
            transition: 'all 0.15s ease'
          }}
          title={(!layout?.regions || layout.regions.length === 0) ? "Scan scene to extract 3D elements & layers" : "Re-extract layout regions from API"}
        >
          <RefreshCw size={13} className={isExtracting ? 'animate-spin' : ''} />
          <span className="btn-label">
            {isExtracting ? 'Scanning...' : (!layout?.regions || layout.regions.length === 0) ? 'Scan Scene' : 'Re-scan'}
          </span>
          <span style={{
            fontSize: '10px',
            background: 'rgba(0, 0, 0, 0.35)',
            padding: '1px 5px',
            borderRadius: '4px',
            color: '#fecdd3',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px'
          }}>
            <Coins size={10} /> {getModelCost('reve/extract-layout')} cr
          </span>
        </button>
      </div>
    </div>
  );
};
