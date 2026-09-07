import React from 'react';

export interface MaskCompareViewProps {
  splitPosition: number;
  onStartDrag: (e: React.MouseEvent) => void;
}

export const MaskCompareView: React.FC<MaskCompareViewProps> = ({
  splitPosition,
  onStartDrag,
}) => {
  return (
    <>
      {/* Draggable Divider Line */}
      <div
        className="mask-split-divider"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${splitPosition}%`,
          width: '2px',
          background: '#ffffff',
          boxShadow: '0 0 8px rgba(0,0,0,0.8), 0 0 16px rgba(56, 189, 248, 0.8)',
          zIndex: 28,
          cursor: 'ew-resize',
          pointerEvents: 'all',
        }}
        onMouseDown={onStartDrag}
      >
        {/* Center Circular Handle */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#18181b',
            border: '2px solid #ffffff',
            boxShadow: '0 4px 14px rgba(0,0,0,0.9), 0 0 12px rgba(56, 189, 248, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: 900,
            userSelect: 'none',
            cursor: 'ew-resize',
          }}
        >
          ◂▸
        </div>
      </div>

      {/* Before Label Badge */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          background: 'rgba(0,0,0,0.7)',
          border: '1px solid rgba(255,255,255,0.2)',
          color: '#f4f4f5',
          fontSize: '10px',
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: '4px',
          zIndex: 26,
          pointerEvents: 'none',
          letterSpacing: '0.5px',
        }}
      >
        BEFORE
      </div>

      {/* After Label Badge */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: 'rgba(56,189,248,0.2)',
          border: '1px solid rgba(56,189,248,0.5)',
          color: '#38bdf8',
          fontSize: '10px',
          fontWeight: 700,
          padding: '3px 8px',
          borderRadius: '4px',
          zIndex: 26,
          pointerEvents: 'none',
          letterSpacing: '0.5px',
        }}
      >
        AFTER
      </div>
    </>
  );
};
