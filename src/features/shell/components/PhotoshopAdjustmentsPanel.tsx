import React, { useState, useCallback, useEffect } from 'react';
import { 
  Sun, Sliders, Scale, SplitSquareVertical, Camera, Layers, Grid3X3, 
  Mail, Contrast, TrendingUp, BarChart2, ShieldAlert,
  ArrowLeft, RotateCcw, Check, X as CloseIcon
} from 'lucide-react';
import { useTranslation } from '../../../services/i18n';
import type { AdjustmentParams } from '../mask/utils/adjustmentEngine';
import type { InpaintLayer } from './LayersPanel';

export interface PhotoshopAdjustmentsPanelProps {
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
    curvePreset: 'medium',
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
  const { isAr } = useTranslation();
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
      key: 'vibrance',
      name: isAr ? 'اللون والحيوية' : 'Color and vibrance',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 22 20 2 20" />
          <circle cx="12" cy="13" r="3" fill="#3b82f6" stroke="#3b82f6" />
        </svg>
      ),
    },
    {
      key: 'brightness',
      name: isAr ? 'السطوع / التباين' : 'Brightness/Contrast',
      icon: <Sun size={20} />,
    },
    {
      key: 'levels',
      name: isAr ? 'المستويات' : 'Levels',
      icon: <BarChart2 size={20} />,
    },
    {
      key: 'curves',
      name: isAr ? 'المنحنيات' : 'Curves',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="2 2" />
          <path d="M4 19 C 10 19, 14 5, 20 5" stroke="#ffffff" strokeWidth="2" />
        </svg>
      ),
    },
    {
      key: 'exposure',
      name: isAr ? 'التعريض' : 'Exposure',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="21" x2="21" y2="3" />
          <path d="M7 6 h2 M8 5 v2" stroke="#ffffff" strokeWidth="2" />
          <path d="M15 17 h3" stroke="#ffffff" strokeWidth="2" />
        </svg>
      ),
    },
    {
      key: 'hue-sat',
      name: isAr ? 'تدرج / تشبع' : 'Hue/Saturation',
      icon: <Sliders size={20} />,
    },
    {
      key: 'color-balance',
      name: isAr ? 'توازن الألوان' : 'Color Balance',
      icon: <Scale size={20} />,
    },
    {
      key: 'black-white',
      name: isAr ? 'أبيض وأسود' : 'Black & White',
      icon: <SplitSquareVertical size={20} />,
    },
    {
      key: 'photo-filter',
      name: isAr ? 'فلتر صور' : 'Photo Filter',
      icon: <Camera size={20} />,
    },
    {
      key: 'channel-mixer',
      name: isAr ? 'مازج القنوات' : 'Channel Mixer',
      icon: <Layers size={20} />,
    },
    {
      key: 'color-lookup',
      name: isAr ? 'بحث الألوان (LUT)' : 'Color Lookup',
      icon: <Grid3X3 size={20} />,
    },
    {
      key: 'invert',
      name: isAr ? 'عكس الألوان' : 'Invert (Ctrl+I)',
      icon: <Mail size={20} />,
    },
    {
      key: 'posterize',
      name: isAr ? 'تدرج ملصق' : 'Posterize',
      icon: <TrendingUp size={20} />,
    },
    {
      key: 'threshold',
      name: isAr ? 'العتبة (أبيض وأسود)' : 'Threshold',
      icon: <ShieldAlert size={20} />,
    },
    {
      key: 'gradient-map',
      name: isAr ? 'خريطة التدرج' : 'Gradient Map',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="5" width="18" height="14" rx="2" fill="url(#psGradMap)" stroke="currentColor" strokeWidth="1.5" />
          <defs>
            <linearGradient id="psGradMap" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
        </svg>
      ),
    },
    {
      key: 'selective-color',
      name: isAr ? 'لون انتقائي' : 'Selective Color',
      icon: <Contrast size={20} />,
    },
  ];

  return (
    <div className="ps-adjustments-panel">
      <div className="ps-adjustments-content">
        {!activeTool ? (
          /* 4x4 Adjustments Grid */
          <div className="ps-adjustments-grid">
            {ADJUSTMENTS.map((adj) => (
              <button
                key={adj.key}
                type="button"
                className="ps-adjustment-tile"
                onClick={() => handleOpenTool(adj.key, adj.name)}
                title={`${adj.name}${adj.key === 'invert' ? ' (Ctrl+I)' : ''}`}
              >
                <div className="ps-adj-tile-icon">
                  {adj.icon}
                </div>
                <span className="ps-adj-tile-label">{adj.name}</span>
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
                title={isAr ? 'رجوع للأدوات' : 'Back to tools'}
              >
                <ArrowLeft size={13} />
                <span>{isAr ? 'الأدوات' : 'Tools'}</span>
              </button>
              <span className="ps-adj-controls-title">{activeTool.name}</span>
              <button
                type="button"
                onClick={handleReset}
                className="ps-adj-reset-btn"
                title={isAr ? 'إعادة ضبط' : 'Reset'}
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
                    label={isAr ? 'السطوع (Brightness)' : 'Brightness'}
                    value={params.brightness ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('brightness', val)}
                  />
                  <SliderRow
                    label={isAr ? 'التباين (Contrast)' : 'Contrast'}
                    value={params.contrast ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('contrast', val)}
                  />
                </>
              )}

              {/* 2. Color and Vibrance */}
              {activeTool.key === 'vibrance' && (
                <>
                  <SliderRow
                    label={isAr ? 'الحيوية (Vibrance)' : 'Vibrance'}
                    value={params.vibrance ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('vibrance', val)}
                  />
                  <SliderRow
                    label={isAr ? 'التشبع (Saturation)' : 'Saturation'}
                    value={params.saturation ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('saturation', val)}
                  />
                </>
              )}

              {/* 3. Exposure */}
              {activeTool.key === 'exposure' && (
                <>
                  <SliderRow
                    label={isAr ? 'التعريض (Exposure)' : 'Exposure'}
                    value={params.exposure ?? 0}
                    min={-2}
                    max={2}
                    step={0.1}
                    onChange={(val) => updateParam('exposure', val)}
                  />
                  <SliderRow
                    label={isAr ? 'الإزاحة (Offset)' : 'Offset'}
                    value={params.offset ?? 0}
                    min={-0.5}
                    max={0.5}
                    step={0.02}
                    onChange={(val) => updateParam('offset', val)}
                  />
                  <SliderRow
                    label={isAr ? 'جاما (Gamma)' : 'Gamma'}
                    value={params.gamma ?? 1.0}
                    min={0.2}
                    max={3.0}
                    step={0.05}
                    onChange={(val) => updateParam('gamma', val)}
                  />
                </>
              )}

              {/* 4. Hue / Saturation */}
              {activeTool.key === 'hue-sat' && (
                <>
                  <SliderRow
                    label={isAr ? 'درجة اللون (Hue)' : 'Hue'}
                    value={params.hue ?? 0}
                    min={-180}
                    max={180}
                    unit="°"
                    onChange={(val) => updateParam('hue', val)}
                  />
                  <SliderRow
                    label={isAr ? 'التشبع (Saturation)' : 'Saturation'}
                    value={params.saturation ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('saturation', val)}
                  />
                  <SliderRow
                    label={isAr ? 'الإضاءة (Lightness)' : 'Lightness'}
                    value={params.lightness ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('lightness', val)}
                  />
                </>
              )}

              {/* 5. Color Balance */}
              {activeTool.key === 'color-balance' && (
                <>
                  <SliderRow
                    label={isAr ? 'سماوي / أحمر (Cyan - Red)' : 'Cyan - Red'}
                    value={params.redBalance ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('redBalance', val)}
                  />
                  <SliderRow
                    label={isAr ? 'أرجواني / أخضر (Magenta - Green)' : 'Magenta - Green'}
                    value={params.greenBalance ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('greenBalance', val)}
                  />
                  <SliderRow
                    label={isAr ? 'أصفر / أزرق (Yellow - Blue)' : 'Yellow - Blue'}
                    value={params.blueBalance ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('blueBalance', val)}
                  />
                </>
              )}

              {/* 6. Black & White */}
              {activeTool.key === 'black-white' && (
                <>
                  <div className="ps-adj-preset-pills">
                    {[
                      { id: 'default', label: isAr ? 'افتراضي' : 'Default', r: 40, g: 60, b: 20 },
                      { id: 'high-contrast', label: isAr ? 'تباين عالي' : 'High Contrast', r: 80, g: 40, b: 0 },
                      { id: 'infrared', label: isAr ? 'أشعة تحت الحمراء' : 'Infrared', r: 100, g: 10, b: 0 },
                      { id: 'warm', label: isAr ? 'دافئ' : 'Warm', r: 60, g: 40, b: 10 },
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
                    label={isAr ? 'مرشح الأحمر (Red Filter)' : 'Red Filter'}
                    value={params.bwRed ?? 40}
                    min={0}
                    max={200}
                    unit="%"
                    onChange={(val) => updateParam('bwRed', val)}
                  />
                  <SliderRow
                    label={isAr ? 'مرشح الأخضر (Green Filter)' : 'Green Filter'}
                    value={params.bwGreen ?? 60}
                    min={0}
                    max={200}
                    unit="%"
                    onChange={(val) => updateParam('bwGreen', val)}
                  />
                  <SliderRow
                    label={isAr ? 'مرشح الأزرق (Blue Filter)' : 'Blue Filter'}
                    value={params.bwBlue ?? 20}
                    min={0}
                    max={200}
                    unit="%"
                    onChange={(val) => updateParam('bwBlue', val)}
                  />
                </>
              )}

              {/* 7. Levels */}
              {activeTool.key === 'levels' && (
                <>
                  <SliderRow
                    label={isAr ? 'نقطة الظلال (Shadows)' : 'Shadows'}
                    value={params.blackPoint ?? 0}
                    min={0}
                    max={254}
                    onChange={(val) => updateParam('blackPoint', val)}
                  />
                  <SliderRow
                    label={isAr ? 'النغمات المتوسطة (Midtones)' : 'Midtones'}
                    value={params.midtones ?? 1.0}
                    min={0.2}
                    max={3.0}
                    step={0.05}
                    onChange={(val) => updateParam('midtones', val)}
                  />
                  <SliderRow
                    label={isAr ? 'نقطة الإضاءة (Highlights)' : 'Highlights'}
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
                      {isAr ? 'فتح نافذة النطاق اللوني المتقدم (Color Range)' : 'Open Advanced Color Range'}
                    </button>
                  )}
                </>
              )}

              {/* 8. Curves */}
              {activeTool.key === 'curves' && (
                <>
                  <SliderRow
                    label={isAr ? 'قوة منحنى التباين (S-Curve)' : 'Curve Contrast'}
                    value={params.curveAmount ?? 50}
                    min={0}
                    max={100}
                    unit="%"
                    onChange={(val) => updateParam('curveAmount', val)}
                  />
                </>
              )}

              {/* 9. Photo Filter */}
              {activeTool.key === 'photo-filter' && (
                <>
                  <div className="ps-adj-preset-pills">
                    {[
                      { id: 'warm', label: isAr ? 'دافئ (Warm 85)' : 'Warm (85)' },
                      { id: 'cool', label: isAr ? 'بارد (Cool 80)' : 'Cool (80)' },
                      { id: 'sepia', label: isAr ? 'بني داكن (Sepia)' : 'Sepia' },
                      { id: 'emerald', label: isAr ? 'زمردي (Emerald)' : 'Emerald' },
                      { id: 'violet', label: isAr ? 'بنفسجي (Violet)' : 'Violet' },
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
                    label={isAr ? 'كثافة الفلتر (Density)' : 'Density'}
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
                    label={isAr ? 'قناة الأحمر (Red)' : 'Red Channel'}
                    value={params.channelRed ?? 100}
                    min={-100}
                    max={200}
                    unit="%"
                    onChange={(val) => updateParam('channelRed', val)}
                  />
                  <SliderRow
                    label={isAr ? 'قناة الأخضر (Green)' : 'Green Channel'}
                    value={params.channelGreen ?? 0}
                    min={-100}
                    max={200}
                    unit="%"
                    onChange={(val) => updateParam('channelGreen', val)}
                  />
                  <SliderRow
                    label={isAr ? 'قناة الأزرق (Blue)' : 'Blue Channel'}
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
                    <span>{isAr ? 'أحادي اللون (Monochrome)' : 'Monochrome'}</span>
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
                    label={isAr ? 'كثافة التأثير (LUT Intensity)' : 'Intensity'}
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
                    {isAr ? 'عكس ألوان الطبقة أو القناع فوراً (Ctrl+I).' : 'Instantly inverts layer or mask colors.'}
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
                    {isAr ? 'عكس الآن (Invert Now)' : 'Invert Now'}
                  </button>
                </div>
              )}

              {/* 13. Posterize */}
              {activeTool.key === 'posterize' && (
                <>
                  <SliderRow
                    label={isAr ? 'مستويات التدرج (Tonal Levels)' : 'Levels'}
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
                    label={isAr ? 'مستوى العتبة (Threshold Level)' : 'Threshold Level'}
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
                      {isAr ? 'فتح أداة التحديد اللوني (Color Range)' : 'Open Color Range Selector'}
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
                    <span>{isAr ? 'عكس اتجاه التدرج (Reverse)' : 'Reverse Gradient'}</span>
                  </label>
                </>
              )}

              {/* 16. Selective Color */}
              {activeTool.key === 'selective-color' && (
                <>
                  <SliderRow
                    label={isAr ? 'السماوي (Cyan)' : 'Cyan'}
                    value={params.selectiveCyan ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('selectiveCyan', val)}
                  />
                  <SliderRow
                    label={isAr ? 'الأرجواني (Magenta)' : 'Magenta'}
                    value={params.selectiveMagenta ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('selectiveMagenta', val)}
                  />
                  <SliderRow
                    label={isAr ? 'الأصفر (Yellow)' : 'Yellow'}
                    value={params.selectiveYellow ?? 0}
                    min={-100}
                    max={100}
                    onChange={(val) => updateParam('selectiveYellow', val)}
                  />
                  <SliderRow
                    label={isAr ? 'الأسود (Black)' : 'Black'}
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
                <span>{isAr ? 'تطبيق التعديل' : 'Apply'}</span>
              </button>
              <button
                type="button"
                className="ps-adj-cancel-btn"
                onClick={handleCancel}
              >
                <CloseIcon size={13} />
                <span>{isAr ? 'إلغاء' : 'Cancel'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
