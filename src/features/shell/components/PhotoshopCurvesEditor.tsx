import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from '../../../services/i18n';
import {
  type CurvePoint,
  type CurveChannels,
  type AdjustmentParams,
  generateSplineLUT,
} from '../mask/utils/adjustmentEngine';
import type { InpaintLayer } from './LayersPanel';

export interface PhotoshopCurvesEditorProps {
  params: AdjustmentParams;
  onChangeParams: (next: AdjustmentParams) => void;
  baseImage?: string | null;
  activeLayer?: InpaintLayer;
}

const DEFAULT_CHANNELS: CurveChannels = {
  rgb: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  green: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
  blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
};

export const PhotoshopCurvesEditor: React.FC<PhotoshopCurvesEditorProps> = ({
  params,
  onChangeParams,
  baseImage,
  activeLayer,
}) => {
  const { isAr } = useTranslation();
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  // Active Curve Channels
  const curveChannels: CurveChannels = useMemo(() => {
    if (params.curveChannels) {
      return {
        rgb: params.curveChannels.rgb || DEFAULT_CHANNELS.rgb,
        red: params.curveChannels.red || DEFAULT_CHANNELS.red,
        green: params.curveChannels.green || DEFAULT_CHANNELS.green,
        blue: params.curveChannels.blue || DEFAULT_CHANNELS.blue,
      };
    }
    return DEFAULT_CHANNELS;
  }, [params.curveChannels]);

  // Points of the RGB curve
  const activePoints = useMemo(() => {
    return curveChannels.rgb || [{ x: 0, y: 0 }, { x: 255, y: 255 }];
  }, [curveChannels]);

  // Real-time Histogram State
  const [histogramData, setHistogramData] = useState<number[]>(() => {
    const d = new Array(256).fill(0);
    for (let i = 0; i < 256; i++) {
      const x = (i - 128) / 45;
      d[i] = Math.exp(-0.5 * x * x);
    }
    return d;
  });

  // Calculate image histogram from activeLayer image or baseImage
  useEffect(() => {
    const src = activeLayer?.image || baseImage;
    if (!src) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        const sampleW = 120;
        const sampleH = 120;
        c.width = sampleW;
        c.height = sampleH;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, sampleW, sampleH);
        const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
        const counts = new Array(256).fill(0);

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] === 0) continue;
          const val = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          counts[val]++;
        }

        let max = 0;
        for (let i = 0; i < 256; i++) {
          if (counts[i] > max) max = counts[i];
        }
        if (max > 0) {
          setHistogramData(counts.map(v => Math.min(1, (v / max) * 1.15)));
        }
      } catch {
        // keep fallback
      }
    };
    img.src = src;
  }, [activeLayer?.image, baseImage]);

  // Update points for the RGB channel
  const updateActivePoints = useCallback((newPoints: CurvePoint[]) => {
    const sorted = [...newPoints].sort((a, b) => a.x - b.x);
    const updatedChannels: CurveChannels = {
      ...curveChannels,
      rgb: sorted,
    };
    onChangeParams({
      ...params,
      curveChannels: updatedChannels,
      curvePreset: 'custom',
    });
  }, [curveChannels, params, onChangeParams]);

  // Active channel LUT & SVG curve path
  const activeLUT = useMemo(() => {
    return generateSplineLUT(activePoints);
  }, [activePoints]);

  const curvePathD = useMemo(() => {
    let d = `M 0 ${255 - activeLUT[0]}`;
    for (let x = 1; x < 256; x++) {
      d += ` L ${x} ${255 - activeLUT[x]}`;
    }
    return d;
  }, [activeLUT]);

  // Histogram SVG polygon path
  const histogramPathD = useMemo(() => {
    let d = 'M 0 255';
    for (let x = 0; x < 256; x++) {
      const h = histogramData[x] || 0;
      const y = 255 - Math.round(h * 200);
      d += ` L ${x} ${y}`;
    }
    d += ' L 255 255 Z';
    return d;
  }, [histogramData]);

  // Coordinate Conversion Helper
  const getCoordinatesFromEvent = (e: React.PointerEvent<SVGSVGElement>): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 256;
    const rawY = 255 - (((e.clientY - rect.top) / rect.height) * 255);
    return {
      x: Math.max(0, Math.min(255, Math.round(rawX))),
      y: Math.max(0, Math.min(255, Math.round(rawY))),
    };
  };

  // Pointer Down on SVG Canvas
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const coords = getCoordinatesFromEvent(e);

    // 1. Check if clicking an existing control point
    const hitRadius = 14;
    let hitIndex: number | null = null;
    for (let i = 0; i < activePoints.length; i++) {
      const pt = activePoints[i];
      const dist = Math.hypot(pt.x - coords.x, pt.y - coords.y);
      if (dist <= hitRadius) {
        hitIndex = i;
        break;
      }
    }

    if (hitIndex !== null) {
      setSelectedPointIndex(hitIndex);
      setDragIndex(hitIndex);
      setIsDragging(true);
      (e.target as Element).setPointerCapture?.(e.pointerId);
      return;
    }

    // 2. Click on empty space: Add a new point on the curve at coords.x
    const newPt: CurvePoint = {
      x: coords.x,
      y: activeLUT[coords.x] ?? coords.y,
    };
    const nextPts = [...activePoints, newPt].sort((a, b) => a.x - b.x);
    const newIdx = nextPts.findIndex(p => p.x === newPt.x);
    updateActivePoints(nextPts);
    setSelectedPointIndex(newIdx);
    setDragIndex(newIdx);
    setIsDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  // Pointer Move (Dragging point)
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging || dragIndex === null) return;
    const coords = getCoordinatesFromEvent(e);

    const isFirst = dragIndex === 0;
    const isLast = dragIndex === activePoints.length - 1;

    let targetX = coords.x;
    const targetY = coords.y;

    // Endpoints constraint: x stays at 0 or 255
    if (isFirst) targetX = 0;
    else if (isLast) targetX = 255;
    else {
      // Middle points cannot cross neighbors
      const minX = activePoints[dragIndex - 1].x + 1;
      const maxX = activePoints[dragIndex + 1].x - 1;
      targetX = Math.max(minX, Math.min(maxX, targetX));
    }

    const updated = activePoints.map((pt, idx) => {
      if (idx === dragIndex) {
        return { x: targetX, y: targetY };
      }
      return pt;
    });

    updateActivePoints(updated);
  };

  // Pointer Up: Release Drag
  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isDragging) {
      setIsDragging(false);
      setDragIndex(null);
      try {
        (e.target as Element).releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  // Double click on a control point: Delete it (if not endpoint)
  const handlePointDoubleClick = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (idx === 0 || idx === activePoints.length - 1) return;
    const filtered = activePoints.filter((_, i) => i !== idx);
    updateActivePoints(filtered);
    setSelectedPointIndex(null);
  };

  // Keyboard Shortcuts (Delete / Backspace removes selected point)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedPointIndex !== null && selectedPointIndex > 0 && selectedPointIndex < activePoints.length - 1) {
          e.preventDefault();
          const filtered = activePoints.filter((_, i) => i !== selectedPointIndex);
          updateActivePoints(filtered);
          setSelectedPointIndex(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPointIndex, activePoints, updateActivePoints]);

  // Selected point input/output values
  const selectedPoint = selectedPointIndex !== null ? activePoints[selectedPointIndex] : null;

  const handleUpdateInput = (val: number) => {
    if (selectedPointIndex === null || selectedPointIndex === 0 || selectedPointIndex === activePoints.length - 1) return;
    const minX = activePoints[selectedPointIndex - 1].x + 1;
    const maxX = activePoints[selectedPointIndex + 1].x - 1;
    const clampedX = Math.max(minX, Math.min(maxX, val));
    const nextPts = activePoints.map((p, i) => i === selectedPointIndex ? { ...p, x: clampedX } : p);
    updateActivePoints(nextPts);
  };

  const handleUpdateOutput = (val: number) => {
    if (selectedPointIndex === null) return;
    const clampedY = Math.max(0, Math.min(255, val));
    const nextPts = activePoints.map((p, i) => i === selectedPointIndex ? { ...p, y: clampedY } : p);
    updateActivePoints(nextPts);
  };

  return (
    <div className="ps-curves-editor">
      {/* ── Main Curves Graph Area ── */}
      <div className="ps-curves-main-layout">
        <div className="ps-curves-graph-container">
          {/* Vertical Gradient Bar (Left: Output 0 bottom to 255 top) */}
          <div
            className="ps-curves-v-gradient"
            title={isAr ? 'تدرج الإخراج (0 بالأسفل، 255 بالأعلى)' : 'Output gradient (0 bottom to 255 top)'}
          />

          {/* Main SVG Grid & Curve Area */}
          <div className="ps-curves-svg-wrap">
            <svg
              ref={svgRef}
              viewBox="0 0 256 256"
              className="ps-curves-svg"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <defs>
                <pattern id="ps-curves-grid-pattern" width="64" height="64" patternUnits="userSpaceOnUse">
                  <path d="M 64 0 L 64 64 M 0 64 L 64 64" fill="none" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1" />
                </pattern>
              </defs>

              {/* Grid 4x4 background */}
              <rect x="0" y="0" width="256" height="256" fill="#252528" />
              <rect x="0" y="0" width="256" height="256" fill="url(#ps-curves-grid-pattern)" />

              {/* Diagonal Identity Line (Subtle Guide) */}
              <line x1="0" y1="255" x2="255" y2="0" stroke="rgba(255, 255, 255, 0.16)" strokeDasharray="3 3" strokeWidth="1" />

              {/* Background Histogram Silhouette */}
              <path d={histogramPathD} fill="rgba(255, 255, 255, 0.14)" />

              {/* Active Smooth Spline Curve Line */}
              <path
                d={curvePathD}
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="ps-curves-active-line"
              />

              {/* Control Points (Square glyphs matching Photoshop) */}
              {activePoints.map((pt, idx) => {
                const isSelected = selectedPointIndex === idx;
                const svgY = 255 - pt.y;
                return (
                  <g
                    key={`pt-${idx}`}
                    onDoubleClick={(e) => handlePointDoubleClick(idx, e)}
                    className="ps-curves-point-glyph"
                  >
                    {/* Larger transparent hit area */}
                    <circle cx={pt.x} cy={svgY} r="10" fill="transparent" cursor="pointer" />

                    {/* Square marker */}
                    <rect
                      x={pt.x - 3.5}
                      y={svgY - 3.5}
                      width="7"
                      height="7"
                      rx="1"
                      fill={isSelected ? '#38bdf8' : '#1e2029'}
                      stroke={isSelected ? '#ffffff' : '#e2e8f0'}
                      strokeWidth={isSelected ? '1.8' : '1.2'}
                      cursor="pointer"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Horizontal Gradient Bar (Bottom: Input 0 left to 255 right) */}
            <div
              className="ps-curves-h-gradient"
              title={isAr ? 'تدرج الإدخال (0 باليسار، 255 باليمين)' : 'Input gradient (0 left to 255 right)'}
            />

            {/* Photoshop Gradient End Sliders */}
            <div className="ps-curves-gradient-markers">
              <div className="ps-marker-black" title="Black Point (0)" />
              <div className="ps-marker-white" title="White Point (255)" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Numeric Inputs: Input and Output ── */}
      <div className="ps-curves-io-row">
        <div className="ps-curves-io-item">
          <span className="ps-curves-io-label">{isAr ? 'الإدخال (Input):' : 'Input:'}</span>
          <input
            type="number"
            min={0}
            max={255}
            value={selectedPoint ? selectedPoint.x : ''}
            placeholder="--"
            disabled={!selectedPoint || selectedPointIndex === 0 || selectedPointIndex === activePoints.length - 1}
            onChange={(e) => handleUpdateInput(Number(e.target.value))}
            className="ps-curves-io-input"
          />
        </div>

        <div className="ps-curves-io-item">
          <span className="ps-curves-io-label">{isAr ? 'الإخراج (Output):' : 'Output:'}</span>
          <input
            type="number"
            min={0}
            max={255}
            value={selectedPoint ? selectedPoint.y : ''}
            placeholder="--"
            disabled={!selectedPoint}
            onChange={(e) => handleUpdateOutput(Number(e.target.value))}
            className="ps-curves-io-input"
          />
        </div>
      </div>
    </div>
  );
};
