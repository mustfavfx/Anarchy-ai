import React, { useState, useCallback, useEffect } from 'react';
import { 
  Sun, Sliders, BarChart2,
  ArrowLeft, RotateCcw, Check, X as CloseIcon
} from 'lucide-react';
import type { AdjustmentParams } from '../mask/utils/adjustmentEngine';
import type { InpaintLayer } from './LayersPanel';
import { PhotoshopCurvesEditor } from './PhotoshopCurvesEditor';

export interface PhotoshopAdjustmentsPanelProps {
  baseImage?: string | null;
  onInvertMask?: () => void;
  onOpenColorRange?: () => void;
  activeLayerId?: string;
  activeLayer?: InpaintLayer;
  onCreateAdjustmentLayer?: (key: string, name: string, initialParams: AdjustmentParams) => void;
  onStartAdjustment?: (key: string) => void;
  onPreviewAdjustment?: (params: AdjustmentParams) => void;
  onCommitAdjustment?: (params: AdjustmentParams) => void;
  onCancelAdjustment?: () => void;
  onApplyAdjustment?: (key: string, name: string) => void;
}

export function getInitialAdjustmentParams(key: string, name: string): AdjustmentParams {
  return {
    key,
    name,
    brightness: 0,
    contrast: 0,
    vibrance: 0,
    saturation: 0,
    hue: 0,
    lightness: 0,
    exposure: 0,
    offset: 0,
    gamma: 1.0,
    blackPoint: 0,
    whitePoint: 255,
    midtones: 1.0,
    curveAmount: 50,
    curvePreset: 'default',
    curveChannels: {
      rgb: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      green: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
      blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
    },
    redBalance: 0,
    greenBalance: 0,
    blueBalance: 0,
    filterPreset: 'warm',
    filterDensity: 30,
    channelRed: 100,
    channelGreen: 0,
    channelBlue: 0,
    channelMono: false,
    lutPreset: 'teal-orange',
    lutIntensity: 80,
    posterizeLevels: 4,
    thresholdLevel: 128,
    gradientPreset: 'navy-coral',
    gradientReverse: false,
    selectiveCyan: 0,
    selectiveMagenta: 0,
    selectiveYellow: 0,
    selectiveBlack: 0,
    bwRed: 40,
    bwGreen: 60,
    bwBlue: 20,
  };
}

const SliderRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
}> = ({ label, value, min, max, step = 1, unit = '', onChange }) => (
  <div className="ps-adj-slider-row">
    <div className="ps-adj-slider-header">
      <span className="ps-adj-slider-label">{label}</span>
      <span className="ps-adj-slider-value">
        {value > 0 && unit !== '°' ? `+${value}` : value}{unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="ps-adj-range-input"
    />
  </div>
);

export const PhotoshopAdjustmentsPanel: React.FC<PhotoshopAdjustmentsPanelProps> = ({
  baseImage,
  onInvertMask,
  onOpenColorRange,
  activeLayerId: _activeLayerId,
  activeLayer,
  onCreateAdjustmentLayer,
  onStartAdjustment,
  onPreviewAdjustment,
  onCommitAdjustment,
  onCancelAdjustment,
  onApplyAdjustment,
}) => {
  const [activeTool, setActiveTool] = useState<{ key: string; name: string } | null>(null);

  // Active Tool Parameter State
  const [params, setParams] = useState<AdjustmentParams>(() => getInitialAdjustmentParams('', ''));

  // Sync with active adjustment layer when selected in Layers list
  useEffect(() => {
    if (activeLayer && activeLayer.layerType === 'adjustment' && activeLayer.adjustmentKey) {
      const key = activeLayer.adjustmentKey;
      const initial = getInitialAdjustmentParams(key, activeLayer.name);
      setActiveTool({ key, name: activeLayer.name });
      setParams(activeLayer.adjustmentParams || initial);
    }
  }, [activeLayer?.id, activeLayer?.layerType, activeLayer?.adjustmentKey]);

  const handleOpenTool = (key: string, name: string) => {
    const initial = getInitialAdjustmentParams(key, name);
    setActiveTool({ key, name });
    setParams(initial);

    if (onCreateAdjustmentLayer) {
      onCreateAdjustmentLayer(key, name, initial);
    } else {
      onStartAdjustment?.(key);
      onPreviewAdjustment?.(initial);
    }
  };

  const updateParam = useCallback(<K extends keyof AdjustmentParams>(field: K, val: AdjustmentParams[K]) => {
    setParams((prev) => {
      const next = { ...prev, [field]: val };
      onPreviewAdjustment?.(next);
      return next;
    });
  }, [onPreviewAdjustment]);

  const handleApply = () => {
    if (activeTool) {
      if (onCommitAdjustment) {
        onCommitAdjustment(params);
      } else if (onApplyAdjustment) {
        onApplyAdjustment(activeTool.key, activeTool.name);
      }
    }
  };

  const handleCancel = () => {
    onCancelAdjustment?.();
    setActiveTool(null);
  };

  const handleReset = () => {
    if (!activeTool) return;
    const initial = getInitialAdjustmentParams(activeTool.key, activeTool.name);
    setParams(initial);
    onPreviewAdjustment?.(initial);
  };

  const ADJUSTMENTS = [
    {
      key: 'brightness',
      name: 'Brightness / Contrast',
      icon: <Sun size={17} />,
    },
    {
      key: 'levels',
      name: 'Levels',
      icon: <BarChart2 size={17} />,
    },
    {
      key: 'curves',
      name: 'Curves',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="2 2" />
          <path d="M4 19 C 10 19, 14 5, 20 5" stroke="#38bdf8" strokeWidth="2" />
        </svg>
      ),
    },
    {
      key: 'exposure',
      name: 'Exposure',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="21" x2="21" y2="3" />
          <path d="M7 6 h2 M8 5 v2" stroke="#38bdf8" strokeWidth="2" />
          <path d="M15 17 h3" stroke="#38bdf8" strokeWidth="2" />
        </svg>
      ),
    },
    {
      key: 'hue-sat',
      name: 'Hue / Saturation',
      icon: <Sliders size={17} />,
    },
  ];

  return (
    <div className="ps-adjustments-panel">
      <div className="ps-adjustments-content">
        {!activeTool ? (
          /* Spacious 5 Adjustments Grid */
          <div className="ps-adjustments-grid ps-5-tools-grid">
            {ADJUSTMENTS.map((adj, idx) => (
              <button
                key={adj.key}
                type="button"
                className={`ps-adjustment-tile ${idx === 4 ? 'ps-adj-tile-full' : ''}`}
                onClick={() => handleOpenTool(adj.key, adj.name)}
                title={adj.name}
              >
                <div className="ps-adj-tile-icon">
                  {adj.icon}
                </div>
                <div className="ps-adj-tile-info">
                  <span className="ps-adj-tile-label">{adj.name}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          /* Interactive Tool Controls Sub-panel */
          <div className="ps-adj-controls-panel">
            {/* Header with back arrow and title */}
            <div className="ps-adj-controls-header">
              <button
                type="button"
                onClick={handleCancel}
                className="ps-adj-back-btn"
                title="Back to tools"
              >
                <ArrowLeft size={13} />
                <span>Tools</span>
              </button>
              <span className="ps-adj-controls-title">{activeTool.name}</span>
              <button
                type="button"
                onClick={handleReset}
                className="ps-adj-reset-btn"
                title="Reset"
              >
                <RotateCcw size={12} />
              </button>
            </div>

            {/* Dynamic Controls Body */}
            <div className="ps-adj-controls-body">
              {/* 1. Brightness / Contrast */}
              {(activeTool.key === 'brightness' || activeTool.key === 'brightness-contrast') && (
                <>
                  <SliderRow
                    label="Brightness"
                    value={params.brightness ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('brightness', val)}
                  />
                  <SliderRow
                    label="Contrast"
                    value={params.contrast ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('contrast', val)}
                  />
                </>
              )}

              {/* 2. Levels */}
              {activeTool.key === 'levels' && (
                <>
                  <SliderRow
                    label="Shadows"
                    value={params.blackPoint ?? 0}
                    min={0}
                    max={254}
                    onChange={(val) => updateParam('blackPoint', val)}
                  />
                  <SliderRow
                    label="Midtones"
                    value={params.midtones ?? 1.0}
                    min={0.2}
                    max={3.0}
                    step={0.05}
                    onChange={(val) => updateParam('midtones', val)}
                  />
                  <SliderRow
                    label="Highlights"
                    value={params.whitePoint ?? 255}
                    min={1}
                    max={255}
                    onChange={(val) => updateParam('whitePoint', val)}
                  />
                  {onOpenColorRange && (
                    <button
                      type="button"
                      className="ps-adj-pill full"
                      onClick={onOpenColorRange}
                    >
                      Open Advanced Color Range
                    </button>
                  )}
                </>
              )}

              {/* 3. Curves */}
              {activeTool.key === 'curves' && (
                <PhotoshopCurvesEditor
                  params={params}
                  onChangeParams={(next) => {
                    setParams(next);
                    onPreviewAdjustment?.(next);
                  }}
                  baseImage={baseImage}
                  activeLayer={activeLayer}
                />
              )}

              {/* 4. Exposure */}
              {activeTool.key === 'exposure' && (
                <>
                  <SliderRow
                    label="Exposure"
                    value={params.exposure ?? 0}
                    min={-2}
                    max={2}
                    step={0.1}
                    onChange={(val) => updateParam('exposure', val)}
                  />
                  <SliderRow
                    label="Offset"
                    value={params.offset ?? 0}
                    min={-0.5}
                    max={0.5}
                    step={0.02}
                    onChange={(val) => updateParam('offset', val)}
                  />
                  <SliderRow
                    label="Gamma"
                    value={params.gamma ?? 1.0}
                    min={0.2}
                    max={3.0}
                    step={0.05}
                    onChange={(val) => updateParam('gamma', val)}
                  />
                </>
              )}

              {/* 5. Hue / Saturation */}
              {activeTool.key === 'hue-sat' && (
                <>
                  <SliderRow
                    label="Hue"
                    value={params.hue ?? 0}
                    min={-180}
                    max={180}
                    unit="°"
                    onChange={(val) => updateParam('hue', val)}
                  />
                  <SliderRow
                    label="Saturation"
                    value={params.saturation ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('saturation', val)}
                  />
                  <SliderRow
                    label="Lightness"
                    value={params.lightness ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('lightness', val)}
                  />
                </>
              )}

              {/* 6. Vibrance */}
              {activeTool.key === 'vibrance' && (
                <>
                  <SliderRow
                    label="Vibrance"
                    value={params.vibrance ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('vibrance', val)}
                  />
                  <SliderRow
                    label="Saturation"
                    value={params.saturation ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('saturation', val)}
                  />
                </>
              )}

              {/* 7. Color Balance */}
              {activeTool.key === 'color-balance' && (
                <>
                  <SliderRow
                    label="Cyan - Red"
                    value={params.redBalance ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('redBalance', val)}
                  />
                  <SliderRow
                    label="Magenta - Green"
                    value={params.greenBalance ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('greenBalance', val)}
                  />
                  <SliderRow
                    label="Yellow - Blue"
                    value={params.blueBalance ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('blueBalance', val)}
                  />
                </>
              )}

              {/* 8. Black & White */}
              {activeTool.key === 'black-white' && (
                <>
                  <div className="ps-adj-preset-pills">
                    {[
                      { id: 'default', label: 'Default', r: 40, g: 60, b: 20 },
                      { id: 'high-contrast', label: 'High Contrast', r: 80, g: 40, b: 0 },
                      { id: 'infrared', label: 'Infrared', r: 100, g: 10, b: 0 },
                      { id: 'warm', label: 'Warm', r: 60, g: 40, b: 10 },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="ps-adj-pill"
                        onClick={() => {
                          updateParam('bwRed', p.r);
                          updateParam('bwGreen', p.g);
                          updateParam('bwBlue', p.b);
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <SliderRow
                    label="Red Filter"
                    value={params.bwRed ?? 40}
                    min={0}
                    max={200}
                    unit="%"
                    onChange={(val) => updateParam('bwRed', val)}
                  />
                  <SliderRow
                    label="Green Filter"
                    value={params.bwGreen ?? 60}
                    min={0}
                    max={200}
                    unit="%"
                    onChange={(val) => updateParam('bwGreen', val)}
                  />
                  <SliderRow
                    label="Blue Filter"
                    value={params.bwBlue ?? 20}
                    min={0}
                    max={200}
                    unit="%"
                    onChange={(val) => updateParam('bwBlue', val)}
                  />
                </>
              )}

              {/* 9. Photo Filter */}
              {activeTool.key === 'photo-filter' && (
                <>
                  <div className="ps-adj-preset-pills">
                    {[
                      { id: 'warm', label: 'Warm (85)' },
                      { id: 'cool', label: 'Cool (80)' },
                      { id: 'sepia', label: 'Sepia' },
                      { id: 'emerald', label: 'Emerald' },
                      { id: 'violet', label: 'Violet' },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`ps-adj-pill ${params.filterPreset === p.id ? 'active' : ''}`}
                        onClick={() => updateParam('filterPreset', p.id)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <SliderRow
                    label="Density"
                    value={params.filterDensity ?? 30}
                    min={1}
                    max={100}
                    unit="%"
                    onChange={(val) => updateParam('filterDensity', val)}
                  />
                </>
              )}

              {/* 10. Channel Mixer */}
              {activeTool.key === 'channel-mixer' && (
                <>
                  <SliderRow
                    label="Red Channel"
                    value={params.channelRed ?? 100}
                    min={-100}
                    max={200}
                    unit="%"
                    onChange={(val) => updateParam('channelRed', val)}
                  />
                  <SliderRow
                    label="Green Channel"
                    value={params.channelGreen ?? 0}
                    min={-100}
                    max={200}
                    unit="%"
                    onChange={(val) => updateParam('channelGreen', val)}
                  />
                  <SliderRow
                    label="Blue Channel"
                    value={params.channelBlue ?? 0}
                    min={-100}
                    max={200}
                    unit="%"
                    onChange={(val) => updateParam('channelBlue', val)}
                  />
                  <label className="ps-adj-checkbox-row">
                    <input
                      type="checkbox"
                      checked={params.channelMono ?? false}
                      onChange={(e) => updateParam('channelMono', e.target.checked)}
                    />
                    <span>Monochrome</span>
                  </label>
                </>
              )}

              {/* 11. Color Lookup (LUT) */}
              {activeTool.key === 'color-lookup' && (
                <>
                  <div className="ps-adj-preset-pills">
                    {[
                      { id: 'teal-orange', label: 'Teal & Orange' },
                      { id: 'vintage', label: 'Vintage Chrome' },
                      { id: 'cyberpunk', label: 'Cyberpunk' },
                      { id: 'noir', label: 'Film Noir' },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`ps-adj-pill ${params.lutPreset === p.id ? 'active' : ''}`}
                        onClick={() => updateParam('lutPreset', p.id)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <SliderRow
                    label="Intensity"
                    value={params.lutIntensity ?? 80}
                    min={10}
                    max={100}
                    unit="%"
                    onChange={(val) => updateParam('lutIntensity', val)}
                  />
                </>
              )}

              {/* 12. Invert */}
              {activeTool.key === 'invert' && (
                <div style={{ textAlign: 'center', padding: '12px 6px' }}>
                  <p style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px' }}>
                    Instantly inverts layer or mask colors.
                  </p>
                  <button
                    type="button"
                    className="ps-adj-pill full active"
                    onClick={() => {
                      if (onInvertMask) onInvertMask();
                      else if (onCommitAdjustment) onCommitAdjustment(params);
                      setActiveTool(null);
                    }}
                  >
                    Invert Now
                  </button>
                </div>
              )}

              {/* 13. Posterize */}
              {activeTool.key === 'posterize' && (
                <>
                  <SliderRow
                    label="Levels"
                    value={params.posterizeLevels ?? 4}
                    min={2}
                    max={16}
                    onChange={(val) => updateParam('posterizeLevels', val)}
                  />
                </>
              )}

              {/* 14. Threshold */}
              {activeTool.key === 'threshold' && (
                <>
                  <SliderRow
                    label="Threshold Level"
                    value={params.thresholdLevel ?? 128}
                    min={1}
                    max={255}
                    onChange={(val) => updateParam('thresholdLevel', val)}
                  />
                  {onOpenColorRange && (
                    <button
                      type="button"
                      className="ps-adj-pill full"
                      onClick={onOpenColorRange}
                    >
                      Open Color Range Selector
                    </button>
                  )}
                </>
              )}

              {/* 15. Gradient Map */}
              {activeTool.key === 'gradient-map' && (
                <>
                  <div className="ps-adj-preset-pills">
                    {[
                      { id: 'navy-coral', label: 'Navy & Coral' },
                      { id: 'sunset', label: 'Sunset Glow' },
                      { id: 'emerald', label: 'Emerald' },
                      { id: 'neon', label: 'Neon Cyber' },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={`ps-adj-pill ${params.gradientPreset === p.id ? 'active' : ''}`}
                        onClick={() => updateParam('gradientPreset', p.id)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <label className="ps-adj-checkbox-row">
                    <input
                      type="checkbox"
                      checked={params.gradientReverse ?? false}
                      onChange={(e) => updateParam('gradientReverse', e.target.checked)}
                    />
                    <span>Reverse Gradient</span>
                  </label>
                </>
              )}

              {/* 16. Selective Color */}
              {activeTool.key === 'selective-color' && (
                <>
                  <SliderRow
                    label="Cyan"
                    value={params.selectiveCyan ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('selectiveCyan', val)}
                  />
                  <SliderRow
                    label="Magenta"
                    value={params.selectiveMagenta ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('selectiveMagenta', val)}
                  />
                  <SliderRow
                    label="Yellow"
                    value={params.selectiveYellow ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('selectiveYellow', val)}
                  />
                  <SliderRow
                    label="Black"
                    value={params.selectiveBlack ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('selectiveBlack', val)}
                  />
                </>
              )}
            </div>

            {/* Action Bar: Apply & Cancel */}
            <div className="ps-adj-action-bar">
              <button
                type="button"
                className="ps-adj-apply-btn"
                onClick={handleApply}
              >
                <Check size={13} />
                <span>Apply</span>
              </button>
              <button
                type="button"
                className="ps-adj-cancel-btn"
                onClick={handleCancel}
              >
                <CloseIcon size={13} />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
