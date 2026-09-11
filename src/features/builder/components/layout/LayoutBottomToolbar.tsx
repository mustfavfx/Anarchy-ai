import React, { useRef } from 'react';
import {
  MousePointer, SquareDashed, PenTool, Box, Type, FileText,
  Image as ImageIcon, Crop, Upload, Paperclip, Camera
} from 'lucide-react';

export interface LayoutBottomToolbarProps {
  activeToolbarTool: string;
  setActiveToolbarTool: (tool: any) => void;
  isReframeActive: boolean;
  setIsReframeActive: (active: boolean) => void;
  showAddImageMenu: boolean;
  setShowAddImageMenu: (show: boolean) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const LayoutBottomToolbar: React.FC<LayoutBottomToolbarProps> = ({
  activeToolbarTool,
  setActiveToolbarTool,
  isReframeActive,
  setIsReframeActive,
  showAddImageMenu,
  setShowAddImageMenu,
  onFileUpload,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {/* Tool 7: Add Image Popup Menu */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        onChange={onFileUpload}
      />
      {showAddImageMenu && (
        <div className="add-image-menu-popup">
          <button
            type="button"
            className="add-image-item"
            onClick={() => {
              fileInputRef.current?.click();
            }}
          >
            <Upload size={14} /> Upload files
          </button>
          <button type="button" className="add-image-item" onClick={() => setShowAddImageMenu(false)}>
            <Paperclip size={14} /> Previously attached
          </button>
          <button type="button" className="add-image-item" onClick={() => setShowAddImageMenu(false)}>
            <Camera size={14} /> Take photo
          </button>
        </div>
      )}

      {/* Reve Floating Bottom Toolbar Pill */}
      <div className="reve-floating-toolbar-pill">
        <button
          type="button"
          className={`pill-btn ${activeToolbarTool === 'select' && !isReframeActive ? 'active-red' : ''}`}
          onClick={() => { setActiveToolbarTool('select'); setIsReframeActive(false); setShowAddImageMenu(false); }}
          title="Select Tool"
        >
          <MousePointer size={15} />
        </button>
        <button
          type="button"
          className={`pill-btn ${activeToolbarTool === 'bbox' ? 'active-red' : ''}`}
          onClick={() => { setActiveToolbarTool('bbox'); setIsReframeActive(false); setShowAddImageMenu(false); }}
          title="Bounding Box Marquee (Click & Drag to create box)"
        >
          <SquareDashed size={15} />
        </button>
        <button
          type="button"
          className={`pill-btn ${activeToolbarTool === 'brush' ? 'active-red' : ''}`}
          onClick={() => { setActiveToolbarTool('brush'); setIsReframeActive(false); setShowAddImageMenu(false); }}
          title="Brush / Mask Tool (Paint mask)"
        >
          <PenTool size={15} />
        </button>
        <div className="pill-divider" />
        <button
          type="button"
          className={`pill-btn ${activeToolbarTool === '3d' ? 'active-red' : ''}`}
          onClick={() => { setActiveToolbarTool('3d'); setIsReframeActive(false); setShowAddImageMenu(false); }}
          title="3D Cube Tool (Perspective grid)"
        >
          <Box size={15} />
        </button>
        <button
          type="button"
          className={`pill-btn ${activeToolbarTool === 'text' ? 'active-red' : ''}`}
          onClick={() => { setActiveToolbarTool('text'); setIsReframeActive(false); setShowAddImageMenu(false); }}
          title="Text Tool (Click image to add text)"
        >
          <Type size={15} />
        </button>
        <button
          type="button"
          className={`pill-btn ${activeToolbarTool === 'note' ? 'active-red' : ''}`}
          onClick={() => { setActiveToolbarTool('note'); setIsReframeActive(false); setShowAddImageMenu(false); }}
          title="Note Tool (Click image to add pin note)"
        >
          <FileText size={15} />
        </button>
        <button
          type="button"
          className={`pill-btn ${showAddImageMenu ? 'active-red' : ''}`}
          onClick={() => setShowAddImageMenu(!showAddImageMenu)}
          title="Add Image Options"
        >
          <ImageIcon size={15} />
        </button>
        <div className="pill-divider" />
        <button
          type="button"
          className={`pill-btn ${isReframeActive ? 'active-red' : ''}`}
          onClick={() => { setIsReframeActive(!isReframeActive); setShowAddImageMenu(false); }}
          title={isReframeActive ? "Close reframe" : "Reframe image"}
        >
          <Crop size={15} />
        </button>
      </div>
    </>
  );
};
