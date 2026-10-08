import React, { useState, useRef, useCallback } from 'react';
import { 
  Compass, ZoomIn, ZoomOut, RotateCcw, 
  Download, Eye, Grid, Layers, Box, Code2, 
  Maximize2, Check, FileDown
} from 'lucide-react';
import './InteractiveFloorPlanViewer.css';

export interface PlanRoom {
  id: string;
  name: string;
  nameAr: string;
  x: number;
  y: number;
  width: number;
  height: number;
  areaM2: number;
  type: 'living' | 'bedroom' | 'majlis' | 'courtyard' | 'kitchen' | 'circulation';
}

interface InteractiveFloorPlanViewerProps {
  buaM2?: number;
  floors?: number;
  dxfUrl?: string;
  dxfFilename?: string;
  onExecute3DModeling?: (software: '3dsmax' | 'blender') => void;
}

const DEFAULT_ROOMS: PlanRoom[] = [
  { id: 'r1', name: 'Formal Majlis', nameAr: 'المجلس الرسمي', x: 20, y: 20, width: 140, height: 110, areaM2: 42, type: 'majlis' },
  { id: 'r2', name: 'Dining Hall', nameAr: 'صالة الطعام', x: 170, y: 20, width: 110, height: 110, areaM2: 30, type: 'living' },
  { id: 'r3', name: 'Chef Kitchen', nameAr: 'المطبخ والخدمات', x: 290, y: 20, width: 110, height: 110, areaM2: 28, type: 'kitchen' },
  { id: 'r4', name: 'Central Courtyard', nameAr: 'الفناء الداخلي والنوافير', x: 170, y: 140, width: 110, height: 100, areaM2: 26, type: 'courtyard' },
  { id: 'r5', name: 'Family Living Area', nameAr: 'بهو المعيشة العائلية', x: 20, y: 140, width: 140, height: 140, areaM2: 52, type: 'living' },
  { id: 'r6', name: 'Master Bedroom Suite', nameAr: 'جناح النوم الرئيسي', x: 290, y: 140, width: 130, height: 140, areaM2: 48, type: 'bedroom' },
  { id: 'r7', name: 'Private Garden Terrace', nameAr: 'تراس الحديقة المظلل', x: 20, y: 290, width: 400, height: 50, areaM2: 60, type: 'circulation' },
];

export const InteractiveFloorPlanViewer: React.FC<InteractiveFloorPlanViewerProps> = ({
  buaM2 = 286,
  floors = 2,
  dxfUrl,
  dxfFilename = 'Anarchy_Architectural_Floorplan.dxf',
  onExecute3DModeling,
}) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showZoning, setShowZoning] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<PlanRoom | null>(null);
  const [downloadingDxf, setDownloadingDxf] = useState(false);

  const startPanRef = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    startPanRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - startPanRef.current.x,
      y: e.clientY - startPanRef.current.y,
    });
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleDownloadSyntheticDXF = () => {
    setDownloadingDxf(true);
    // Generate a compliant minimal DXF ASCII string directly
    const dxfContent = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n` +
      DEFAULT_ROOMS.map(r => 
        `0\nLWPOLYLINE\n8\nWALLS\n90\n4\n70\n1\n` +
        `10\n${r.x * 10}\n20\n${r.y * 10}\n` +
        `10\n${(r.x + r.width) * 10}\n20\n${r.y * 10}\n` +
        `10\n${(r.x + r.width) * 10}\n20\n${(r.y + r.height) * 10}\n` +
        `10\n${r.x * 10}\n20\n${(r.y + r.height) * 10}\n`
      ).join('') +
      `0\nENDSEC\n0\nEOF\n`;

    const blob = new Blob([dxfContent], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = dxfFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setTimeout(() => setDownloadingDxf(false), 1500);
  };

  const getRoomColor = (type: PlanRoom['type']) => {
    if (!showZoning) return 'rgba(255, 255, 255, 0.04)';
    switch (type) {
      case 'majlis': return 'rgba(217, 119, 6, 0.18)'; // Gold/Amber
      case 'living': return 'rgba(59, 130, 246, 0.18)'; // Blue
      case 'bedroom': return 'rgba(168, 85, 247, 0.18)'; // Purple
      case 'courtyard': return 'rgba(16, 185, 129, 0.22)'; // Green
      case 'kitchen': return 'rgba(239, 68, 68, 0.18)'; // Red/Coral
      case 'circulation': return 'rgba(255, 255, 255, 0.08)';
    }
  };

  const getRoomBorder = (type: PlanRoom['type']) => {
    if (!showZoning) return 'rgba(255, 255, 255, 0.4)';
    switch (type) {
      case 'majlis': return '#d97706';
      case 'living': return '#3b82f6';
      case 'bedroom': return '#a855f7';
      case 'courtyard': return '#10b981';
      case 'kitchen': return '#ef4444';
      case 'circulation': return 'rgba(255, 255, 255, 0.3)';
    }
  };

  return (
    <div className="interactive-plan-card">
      <div className="plan-card-header">
        <div className="plan-title-group">
          <Compass size={16} className="plan-icon" />
          <span className="plan-title">Interactive Architectural Floorplan</span>
          <span className="plan-bua-badge">{buaM2} m² BUA</span>
        </div>
        <div className="plan-toolbar">
          <button 
            type="button" 
            className={`plan-tool-btn ${showDimensions ? 'active' : ''}`}
            onClick={() => setShowDimensions(v => !v)}
            title="Toggle Dimensions"
          >
            Dim
          </button>
          <button 
            type="button" 
            className={`plan-tool-btn ${showGrid ? 'active' : ''}`}
            onClick={() => setShowGrid(v => !v)}
            title="Toggle Column Grid"
          >
            <Grid size={12} />
          </button>
          <button 
            type="button" 
            className={`plan-tool-btn ${showZoning ? 'active' : ''}`}
            onClick={() => setShowZoning(v => !v)}
            title="Toggle Color Zoning"
          >
            <Layers size={12} />
          </button>
          <div className="plan-zoom-btns">
            <button type="button" onClick={() => setZoom(z => Math.min(2.5, z * 1.25))} title="Zoom In"><ZoomIn size={12} /></button>
            <button type="button" onClick={() => setZoom(z => Math.max(0.6, z / 1.25))} title="Zoom Out"><ZoomOut size={12} /></button>
            <button type="button" onClick={handleReset} title="Reset"><RotateCcw size={12} /></button>
          </div>
        </div>
      </div>

      {/* SVG Canvas Viewport */}
      <div 
        className={`plan-viewport ${isPanning ? 'panning' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg 
          viewBox="0 0 450 360" 
          className="plan-svg"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        >
          {/* Structural Column Grid Lines */}
          {showGrid && (
            <g className="grid-layer" opacity="0.15">
              {[50, 100, 150, 200, 250, 300, 350, 400].map(x => (
                <line key={`gx-${x}`} x1={x} y1="0" x2={x} y2="360" stroke="#fff" strokeDasharray="3 3" />
              ))}
              {[50, 100, 150, 200, 250, 300].map(y => (
                <line key={`gy-${y}`} x1="0" y1={y} x2="450" y2={y} stroke="#fff" strokeDasharray="3 3" />
              ))}
            </g>
          )}

          {/* Rooms */}
          {DEFAULT_ROOMS.map(room => {
            const isSelected = selectedRoom?.id === room.id;
            return (
              <g 
                key={room.id}
                className="room-group"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedRoom(room);
                }}
              >
                {/* Room Fill Area */}
                <rect
                  x={room.x}
                  y={room.y}
                  width={room.width}
                  height={room.height}
                  fill={getRoomColor(room.type)}
                  stroke={isSelected ? '#f43f5e' : getRoomBorder(room.type)}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  rx="3"
                />

                {/* Double Wall Thickness Outline */}
                <rect
                  x={room.x + 3}
                  y={room.y + 3}
                  width={Math.max(1, room.width - 6)}
                  height={Math.max(1, room.height - 6)}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.25)"
                  strokeWidth="0.8"
                />

                {/* Room Label */}
                <text
                  x={room.x + room.width / 2}
                  y={room.y + room.height / 2 - 4}
                  textAnchor="middle"
                  fill="#f3f4f6"
                  fontSize="9.5"
                  fontWeight="600"
                >
                  {room.nameAr}
                </text>
                <text
                  x={room.x + room.width / 2}
                  y={room.y + room.height / 2 + 9}
                  textAnchor="middle"
                  fill="rgba(255, 255, 255, 0.65)"
                  fontSize="8"
                >
                  {room.areaM2} m² ({room.name})
                </text>

                {/* Metric Dimensions */}
                {showDimensions && (
                  <>
                    <text
                      x={room.x + room.width / 2}
                      y={room.y - 3}
                      textAnchor="middle"
                      fill="#9ca3af"
                      fontSize="7"
                    >
                      {(room.width / 15).toFixed(1)}m
                    </text>
                    <text
                      x={room.x - 3}
                      y={room.y + room.height / 2}
                      textAnchor="end"
                      fill="#9ca3af"
                      fontSize="7"
                    >
                      {(room.height / 15).toFixed(1)}m
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>

        {/* Selected Room Overlay Tag */}
        {selectedRoom && (
          <div className="plan-selected-toast">
            <span className="toast-name">{selectedRoom.nameAr} &bull; {selectedRoom.name}</span>
            <span className="toast-meta">Area: {selectedRoom.areaM2} m² | Dimensions: {(selectedRoom.width / 15).toFixed(1)}m × {(selectedRoom.height / 15).toFixed(1)}m</span>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="plan-card-footer">
        <button
          type="button"
          className="plan-action-btn primary"
          onClick={handleDownloadSyntheticDXF}
        >
          {downloadingDxf ? <Check size={13} /> : <FileDown size={13} />}
          <span>{downloadingDxf ? 'DXF Generated!' : 'Download DXF Vector CAD'}</span>
        </button>

        {onExecute3DModeling && (
          <>
            <button
              type="button"
              className="plan-action-btn secondary"
              onClick={() => onExecute3DModeling('3dsmax')}
              title="Parametrically model this villa in Autodesk 3ds Max"
            >
              <Box size={13} />
              <span>Model in 3ds Max</span>
            </button>

            <button
              type="button"
              className="plan-action-btn secondary"
              onClick={() => onExecute3DModeling('blender')}
              title="Generate Blender 4.x Python geometry script"
            >
              <Code2 size={13} />
              <span>Model in Blender 4.x</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
