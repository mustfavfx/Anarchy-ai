import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Wand2, Hand, Pipette, Edit3, Spline,
  Sliders, AlertTriangle, ChevronDown
} from 'lucide-react';
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

type ChannelKey = 'rgb' | 'red' | 'green' | 'blue';

const CURVE_PRESETS: Record<string, { label: string; channels: CurveChannels }> = {
  default: {
    label: 'Default',
    channels: {
      rgb: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      green: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
    },
  },
  'medium-contrast': {
    label: 'Medium Contrast',
    channels: {
      rgb: [
        { x: 0, y: 0 },
        { x: 32, y: 22 },
        { x: 64, y: 56 },
        { x: 128, y: 128 },
        { x: 192, y: 200 },
        { x: 255, y: 255 },
      ],
      red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      green: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
    },
  },
  'strong-contrast': {
    label: 'Strong Contrast',
    channels: {
      rgb: [
        { x: 0, y: 0 },
        { x: 32, y: 16 },
        { x: 64, y: 50 },
        { x: 192, y: 205 },
        { x: 224, y: 240 },
        { x: 255, y: 255 },
      ],
      red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      green: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
    },
  },
  'linear-contrast': {
    label: 'Linear Contrast',
    channels: {
      rgb: [
        { x: 0, y: 0 },
        { x: 64, y: 48 },
        { x: 192, y: 208 },
        { x: 255, y: 255 },
      ],
      red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      green: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
    },
  },
  lighter: {
    label: 'Lighter',
    channels: {
      rgb: [
        { x: 0, y: 0 },
        { x: 128, y: 155 },
        { x: 255, y: 255 },
      ],
      red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      green: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
    },
  },
  darker: {
    label: 'Darker',
    channels: {
      rgb: [
        { x: 0, y: 0 },
        { x: 128, y: 100 },
        { x: 255, y: 255 },
      ],
      red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      green: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
    },
  },
  negative: {
    label: 'Negative (Invert)',
    channels: {
      rgb: [
        { x: 0, y: 255 },
        { x: 255, y: 0 },
      ],
      red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      green: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
    },
  },
  'cross-process': {
    label: 'Cross Process',
    channels: {
      rgb: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      red: [
        { x: 0, y: 0 },
        { x: 70, y: 55 },
        { x: 190, y: 210 },
        { x: 255, y: 255 },
      ],
      green: [
        { x: 0, y: 0 },
        { x: 60, y: 60 },
        { x: 200, y: 200 },
        { x: 255, y: 255 },
      ],
      blue: [
        { x: 0, y: 30 },
        { x: 100, y: 80 },
        { x: 160, y: 180 },
        { x: 255, y: 225 },
      ],
    },
  },
};

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

  const [activeChannel, setActiveChannel] = useState<ChannelKey>('rgb');
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [editMode, setEditMode] = useState<'point' | 'pencil'>('point');
  const [activeEyedropper, setActiveEyedropper] = useState<'black' | 'gray' | 'white' | null>(null);
  const [isHandActive, setIsHandActive] = useState(false);
  const [showClipping, setShowClipping] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<string>(params.curvePreset || 'default');

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

  // Points of the active channel
  const activePoints = useMemo(() => {
    return curveChannels[activeChannel] || [{ x: 0, y: 0 }, { x: 255, y: 255 }];
  }, [curveChannels, activeChannel]);

  // Real-time Histogram State
  const [histogramData, setHistogramData] = useState<number[]>(() => {
    // Natural fallback bell curve distribution
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
          let val = 0;
          if (activeChannel === 'red') val = data[i];
          else if (activeChannel === 'green') val = data[i + 1];
          else if (activeChannel === 'blue') val = data[i + 2];
          else val = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
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
  }, [activeLayer?.image, baseImage, activeChannel]);

  // Update channels in parent
  const updateChannels = useCallback((newChannels: CurveChannels, presetName = 'custom') => {
    setCurrentPreset(presetName);
    onChangeParams({
      ...params,
      curveChannels: newChannels,
      curvePreset: presetName,
    });
  }, [params, onChangeParams]);

  // Update points for the current channel
  const updateActivePoints = useCallback((newPoints: CurvePoint[]) => {
    // Sort points by x ascending
    const sorted = [...newPoints].sort((a, b) => a.x - b.x);
    const updatedChannels: CurveChannels = {
      ...curveChannels,
      [activeChannel]: sorted,
    };
    updateChannels(updatedChannels, 'custom');
  }, [curveChannels, activeChannel, updateChannels]);

  // Preset Selection Handler
  const handleSelectPreset = (key: string) => {
    const preset = CURVE_PRESETS[key];
    if (preset) {
      updateChannels(preset.channels, key);
      setSelectedPointIndex(null);
    }
  };

  // Photoshop Auto Curves Button
  const handleAutoCurves = () => {
    // Automatically find 0.5% and 99.5% clip points
    let shadowClip = 15;
    let highlightClip = 240;

    let total = 0;
    for (let i = 0; i < 256; i++) total += histogramData[i];
    if (total > 0) {
      let accum = 0;
      for (let i = 0; i < 256; i++) {
        accum += histogramData[i];
        if (accum >= total * 0.015 && shadowClip === 15) {
          shadowClip = Math.max(5, Math.min(60, i));
        }
        if (accum >= total * 0.985) {
          highlightClip = Math.max(190, Math.min(250, i));
          break;
        }
      }
    }

    const autoChannels: CurveChannels = {
      rgb: [
        { x: 0, y: 0 },
        { x: shadowClip, y: 8 },
        { x: highlightClip, y: 246 },
        { x: 255, y: 255 },
      ],
      red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      green: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
    };

    updateChannels(autoChannels, 'auto');
    setSelectedPointIndex(null);
  };

  // Smooth curve action (slightly relaxes middle points toward smooth spline)
  const handleSmoothCurve = () => {
    if (activePoints.length <= 2) return;
    const smoothed = activePoints.map((pt, idx) => {
      if (idx === 0 || idx === activePoints.length - 1) return pt;
      const prev = activePoints[idx - 1];
      const next = activePoints[idx + 1];
      const avgY = (prev.y + next.y) / 2;
      return {
        x: pt.x,
        y: Math.round(pt.y * 0.7 + avgY * 0.3),
      };
    });
    updateActivePoints(smoothed);
  };

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

  // Coordinate Conversion Helper: SVG coordinates from PointerEvent
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
    const hitRadius = 14; // pixels in 256 space
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
    if (editMode === 'point') {
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
    }
  };

  // Pointer Move (Dragging point or drawing in pencil mode)
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

  // Channel Stroke Color
  const channelStrokeColor = useMemo(() => {
    switch (activeChannel) {
      case 'red': return '#ef4444';
      case 'green': return '#22c55e';
      case 'blue': return '#38bdf8';
      default: return '#ffffff';
    }
  }, [activeChannel]);

  return (
    <div className="ps-curves-editor">
      {/* ── 1. Preset Dropdown Row ── */}
      <div className="ps-curves-top-row">
        <label className="ps-curves-preset-label">
          <span>{isAr ? 'القالب (Preset):' : 'Preset:'}</span>
          <div className="ps-curves-select-wrap">
            <select
              value={currentPreset}
              onChange={(e) => handleSelectPreset(e.target.value)}
              className="ps-curves-select"
            >
              {Object.entries(CURVE_PRESETS).map(([key, p]) => (
                <option key={key} value={key}>
                  {p.label}
                </option>
              ))}
              {currentPreset === 'custom' && (
                <option value="custom">{isAr ? 'مخصص (Custom)' : 'Custom'}</option>
              )}
              {currentPreset === 'auto' && (
                <option value="auto">{isAr ? 'تلقائي (Auto)' : 'Auto'}</option>
              )}
            </select>
            <ChevronDown size={12} className="ps-curves-select-caret" />
          </div>
        </label>
      </div>

      {/* ── 2. Channel Selector & Auto Button ── */}
      <div className="ps-curves-channel-row">
        <div className="ps-curves-channel-select-wrap">
          <select
            value={activeChannel}
            onChange={(e) => {
              setActiveChannel(e.target.value as ChannelKey);
              setSelectedPointIndex(null);
            }}
            className={`ps-curves-channel-select channel-${activeChannel}`}
          >
            <option value="rgb">RGB</option>
            <option value="red">{isAr ? 'الأحمر (Red)' : 'Red'}</option>
            <option value="green">{isAr ? 'الأخضر (Green)' : 'Green'}</option>
            <option value="blue">{isAr ? 'الأزرق (Blue)' : 'Blue'}</option>
          </select>
          <ChevronDown size={12} className="ps-curves-select-caret" />
        </div>

        <button
          type="button"
          onClick={handleAutoCurves}
          className="ps-curves-auto-btn"
          title={isAr ? 'موازنة تلقائية للمنحنى (Auto Curves)' : 'Auto Curves (Automatic contrast)'}
        >
          <Wand2 size={11} />
          <span>Auto</span>
        </button>
      </div>

      {/* ── 3. Main Curves Studio: Left Tool Strip + Central Graph ── */}
      <div className="ps-curves-main-layout">
        {/* Left Vertical Tool Rail */}
        <div className="ps-curves-tool-rail">
          <button
            type="button"
            className={`ps-curves-tool-btn ${isHandActive ? 'active' : ''}`}
            onClick={() => setIsHandActive(v => !v)}
            title={isAr ? 'أداة الضبط المباشر على الصورة' : 'On-image adjustment tool'}
          >
            <Hand size={13} />
          </button>

          <div className="ps-curves-rail-divider" />

          {/* Black Point Eyedropper */}
          <button
            type="button"
            className={`ps-curves-tool-btn eyedropper-black ${activeEyedropper === 'black' ? 'active' : ''}`}
            onClick={() => setActiveEyedropper(v => v === 'black' ? null : 'black')}
            title={isAr ? 'قطارة تحديد النقطة السوداء (Black Point)' : 'Sample black point in image'}
          >
            <Pipette size={13} style={{ color: '#6b7280' }} />
          </button>

          {/* Gray Point Eyedropper */}
          <button
            type="button"
            className={`ps-curves-tool-btn eyedropper-gray ${activeEyedropper === 'gray' ? 'active' : ''}`}
            onClick={() => setActiveEyedropper(v => v === 'gray' ? null : 'gray')}
            title={isAr ? 'قطارة تحديد النقطة الرمادية (Gray Point)' : 'Sample gray point in image'}
          >
            <Pipette size={13} style={{ color: '#9ca3af' }} />
          </button>

          {/* White Point Eyedropper */}
          <button
            type="button"
            className={`ps-curves-tool-btn eyedropper-white ${activeEyedropper === 'white' ? 'active' : ''}`}
            onClick={() => setActiveEyedropper(v => v === 'white' ? null : 'white')}
            title={isAr ? 'قطارة تحديد النقطة البيضاء (White Point)' : 'Sample white point in image'}
          >
            <Pipette size={13} style={{ color: '#f3f4f6' }} />
          </button>

          <div className="ps-curves-rail-divider" />

          {/* Curve Edit Mode (Smooth Spline) */}
          <button
            type="button"
            className={`ps-curves-tool-btn ${editMode === 'point' ? 'active' : ''}`}
            onClick={() => setEditMode('point')}
            title={isAr ? 'وضع رسم المنحنى الناعم بالنقاط' : 'Edit points on curve'}
          >
            <Spline size={13} />
          </button>

          {/* Pencil Mode */}
          <button
            type="button"
            className={`ps-curves-tool-btn ${editMode === 'pencil' ? 'active' : ''}`}
            onClick={() => setEditMode('pencil')}
            title={isAr ? 'وضع الرسم الحر بالقلم' : 'Draw curve with pencil'}
          >
            <Edit3 size={13} />
          </button>

          {/* Smooth Curve Button */}
          <button
            type="button"
            className="ps-curves-tool-btn"
            onClick={handleSmoothCurve}
            title={isAr ? 'تنعيم المنحنى (Smooth)' : 'Smooth the curve'}
          >
            <Sliders size={13} />
          </button>

          {/* Clipping Display Button */}
          <button
            type="button"
            className={`ps-curves-tool-btn ${showClipping ? 'active' : ''}`}
            onClick={() => setShowClipping(v => !v)}
            title={isAr ? 'عرض تحذير القص اللوني' : 'Show clipping display'}
          >
            <AlertTriangle size={13} />
          </button>
        </div>

        {/* Curves Graph Area */}
        <div className="ps-curves-graph-container">
          {/* Vertical Gradient Bar (Left) */}
          <div className="ps-curves-v-gradient" title={isAr ? 'تدرج الإخراج (0 بالأسفل، 255 بالأعلى)' : 'Output gradient (0 bottom to 255 top)'} />

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

              {/* Faint inactive channel curves if non-default */}
              {activeChannel !== 'rgb' && (
                <path
                  d={`M 0 ${255 - generateSplineLUT(curveChannels.rgb)[0]} ${Array.from({ length: 255 }, (_, i) => `L ${i + 1} ${255 - generateSplineLUT(curveChannels.rgb)[i + 1]}`).join(' ')}`}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.25)"
                  strokeWidth="1.2"
                  strokeDasharray="2 2"
                />
              )}

              {/* Active Smooth Spline Curve Line */}
              <path
                d={curvePathD}
                fill="none"
                stroke={channelStrokeColor}
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

            {/* Horizontal Gradient Bar (Bottom) */}
            <div className="ps-curves-h-gradient" title={isAr ? 'تدرج الإدخال (0 باليسار، 255 باليمين)' : 'Input gradient (0 left to 255 right)'} />

            {/* Photoshop Gradient End Sliders */}
            <div className="ps-curves-gradient-markers">
              <div className="ps-marker-black" title="Black Point (0)" />
              <div className="ps-marker-white" title="White Point (255)" />
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. Bottom Numeric Inputs: Input and Output ── */}
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
