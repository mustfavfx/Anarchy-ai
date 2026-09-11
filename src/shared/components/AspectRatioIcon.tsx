import React from 'react';

export interface AspectRatioIconProps {
  ratio?: string;
  size?: number;
  className?: string;
  active?: boolean;
  color?: string;
}

export function getAspectRatioHint(ratio: string): string | null {
  if (!ratio) return null;
  const clean = ratio.trim().toLowerCase();
  switch (clean) {
    case '1:1': return 'Square';
    case '16:9': return 'Landscape';
    case '9:16': return 'Story / Reel';
    case '4:5': return 'Social';
    case '5:4': return 'Display';
    case '3:2': return 'Photo';
    case '2:3': return 'Poster';
    case '4:3': return 'Standard';
    case '3:4': return 'Vertical';
    case '21:9': return 'Ultrawide';
    case '9:21': return 'Tall';
    case '4:1': return 'Banner';
    case '3:1': return 'X Banner';
    case '2:1': return 'Header';
    case '17:9': return 'Cinema';
    case '2.35:1': return 'Anamorphic';
    case 'auto': return 'Auto';
    case 'match_input_image': return 'Match Input';
    default: return null;
  }
}

export const AspectRatioIcon: React.FC<AspectRatioIconProps> = ({
  ratio = '1:1',
  size = 18,
  className = '',
  active = false,
  color,
}) => {
  const clean = (ratio || '1:1').trim().toLowerCase();
  const maxBox = 16;
  const canvasSize = 20;

  // Handle special cases: auto / adaptive
  if (clean === 'auto' || clean === 'adaptive') {
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${canvasSize} ${canvasSize}`}
        className={`aspect-ratio-icon ${className} ${active ? 'active' : ''}`}
        style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', margin: 0 }}
        aria-hidden="true"
      >
        <rect
          x="3"
          y="3"
          width="14"
          height="14"
          rx="2"
          fill={active ? 'rgba(225, 29, 72, 0.22)' : 'currentColor'}
          fillOpacity={active ? 0.22 : 0.08}
          stroke={color || 'currentColor'}
          strokeWidth="1.2"
          strokeDasharray="2.5 1.5"
        />
        <text
          x="10"
          y="13"
          textAnchor="middle"
          fontSize="8"
          fontWeight="bold"
          fill={color || 'currentColor'}
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          A
        </text>
      </svg>
    );
  }

  // Handle special cases: match input image / freeform
  if (clean === 'match_input_image' || clean === 'match input' || clean === 'freeform') {
    return (
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${canvasSize} ${canvasSize}`}
        className={`aspect-ratio-icon ${className} ${active ? 'active' : ''}`}
        style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', margin: 0 }}
        aria-hidden="true"
      >
        <rect
          x="2.5"
          y="2.5"
          width="15"
          height="15"
          rx="2"
          fill={active ? 'rgba(225, 29, 72, 0.22)' : 'currentColor'}
          fillOpacity={active ? 0.22 : 0.08}
          stroke={color || 'currentColor'}
          strokeWidth="1.2"
          strokeDasharray="2 1.5"
        />
        <rect
          x="6.5"
          y="6.5"
          width="7"
          height="7"
          rx="1"
          fill="none"
          stroke={color || 'currentColor'}
          strokeWidth="1"
        />
      </svg>
    );
  }

  // Calculate geometric ratio
  let wRatio = 1;
  let hRatio = 1;

  if (clean.includes(':')) {
    const parts = clean.split(':').map(p => parseFloat(p.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] > 0 && parts[1] > 0) {
      wRatio = parts[0];
      hRatio = parts[1];
    }
  } else if (clean.includes('/')) {
    const parts = clean.split('/').map(p => parseFloat(p.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] > 0 && parts[1] > 0) {
      wRatio = parts[0];
      hRatio = parts[1];
    }
  }

  const r = wRatio / hRatio;
  let w = maxBox;
  let h = maxBox;

  if (Math.abs(r - 1) < 0.05) {
    // 1:1 perfect square
    w = 13.5;
    h = 13.5;
  } else if (r > 1) {
    // Landscape rectangle (e.g. 16:9, 4:3, 21:9, 4:1)
    w = maxBox;
    h = Math.max(3.5, Math.min(maxBox, Math.round((maxBox / r) * 10) / 10));
  } else {
    // Portrait rectangle (e.g. 9:16, 3:4, 2:3, 4:5)
    h = maxBox;
    w = Math.max(3.5, Math.min(maxBox, Math.round((maxBox * r) * 10) / 10));
  }

  const x = Math.round(((canvasSize - w) / 2) * 10) / 10;
  const y = Math.round(((canvasSize - h) / 2) * 10) / 10;
  const rx = Math.max(1, Math.min(1.8, Math.min(w, h) / 2.5));

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${canvasSize} ${canvasSize}`}
      className={`aspect-ratio-icon ${className} ${active ? 'active' : ''}`}
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', margin: 0 }}
      aria-hidden="true"
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={rx}
        fill={active ? 'rgba(225, 29, 72, 0.22)' : 'currentColor'}
        fillOpacity={active ? 0.22 : 0.08}
        stroke={color || 'currentColor'}
        strokeWidth="1.25"
      />
    </svg>
  );
};
