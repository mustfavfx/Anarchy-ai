import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeftRight, MoreHorizontal } from 'lucide-react';
import { useTranslation } from '../../../services/i18n';

export interface PhotoshopColorPanelProps {
  activeColor: string;
  onChangeColor: (color: string) => void;
  secondaryColor?: string;
  onToggleMaskColor?: () => void;
  activeMaskColor?: 'white' | 'black';
}

// Helpers for HSV <-> HEX conversions
function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255 || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255 || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255 || 0;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : Math.round((delta / max) * 100);
  const v = Math.round(max * 100);

  return { h, s, v };
}

function hsvToHex(h: number, s: number, v: number): string {
  const sat = s / 100;
  const val = v / 100;
  const c = val * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = val - c;

  let r = 0, g = 0, b = 0;
  if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
  else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
  else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
  else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
  else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

const PHOTOSHOP_DEFAULT_SWATCHES = [
  '#000000', '#ffffff', '#7f7f7f', '#c3c3c3',
  '#e11d48', '#f43f5e', '#fb7185', '#fda4af',
  '#ea580c', '#f97316', '#fb923c', '#fdba74',
  '#ca8a04', '#eab308', '#facc15', '#fef08a',
  '#16a34a', '#22c55e', '#4ade80', '#86efac',
  '#0d9488', '#14b8a6', '#2dd4bf', '#5eead4',
  '#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc',
  '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd',
  '#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd',
  '#c026d3', '#d946ef', '#e879f9', '#f0abfc',
  '#475569', '#64748b', '#94a3b8', '#cbd5e1',
  '#3e2723', '#5d4037', '#8d6e63', '#d7ccc8',
];

export const PhotoshopColorPanel: React.FC<PhotoshopColorPanelProps> = ({
  activeColor,
  onChangeColor,
  secondaryColor = '#000000',
  onToggleMaskColor,
  activeMaskColor: _activeMaskColor,
}) => {
  const { isAr } = useTranslation();
  const [activeTab, setActiveTab] = useState<'color' | 'swatches' | 'gradients' | 'patterns'>('color');

  const initialHsv = hexToHsv(activeColor || '#e11d48');
  const [hue, setHue] = useState<number>(initialHsv.h);
  const [sat, setSat] = useState<number>(initialHsv.s);
  const [val, setVal] = useState<number>(initialHsv.v);

  const spectrumRef = useRef<HTMLDivElement>(null);
  const hueSliderRef = useRef<HTMLDivElement>(null);
  const isDraggingSpectrum = useRef(false);
  const isDraggingHue = useRef(false);

  useEffect(() => {
    const { h, s, v } = hexToHsv(activeColor || '#e11d48');
    setHue(h);
    setSat(s);
    setVal(v);
  }, [activeColor]);

  const updateColorFromHsv = useCallback((h: number, s: number, v: number) => {
    const hex = hsvToHex(h, s, v);
    onChangeColor(hex);
  }, [onChangeColor]);

  // Handle 2D Saturation / Brightness Drag
  const handleSpectrumMove = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!spectrumRef.current) return;
    const rect = spectrumRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const newSat = Math.round((x / rect.width) * 100);
    const newVal = Math.round((1 - y / rect.height) * 100);

    setSat(newSat);
    setVal(newVal);
    updateColorFromHsv(hue, newSat, newVal);
  }, [hue, updateColorFromHsv]);

  // Handle Hue vertical slider drag
  const handleHueMove = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!hueSliderRef.current) return;
    const rect = hueSliderRef.current.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const newHue = Math.round((y / rect.height) * 360);

    setHue(newHue);
    updateColorFromHsv(newHue, sat, val);
  }, [sat, val, updateColorFromHsv]);

  const handleSpectrumMouseDown = (e: React.MouseEvent) => {
    isDraggingSpectrum.current = true;
    handleSpectrumMove(e);
  };

  const handleHueMouseDown = (e: React.MouseEvent) => {
    isDraggingHue.current = true;
    handleHueMove(e);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDraggingSpectrum.current) {
        handleSpectrumMove(e);
      } else if (isDraggingHue.current) {
        handleHueMove(e);
      }
    };

    const onMouseUp = () => {
      isDraggingSpectrum.current = false;
      isDraggingHue.current = false;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [handleSpectrumMove, handleHueMove]);

  const pureHueHex = hsvToHex(hue, 100, 100);

  return (
    <div className="ps-color-panel">
      {/* Photoshop Tabs Header */}
      <div className="ps-dock-panel-tabs">
        <div className="ps-dock-tabs-list">
          <button
            type="button"
            className={`ps-dock-tab ${activeTab === 'color' ? 'active' : ''}`}
            onClick={() => setActiveTab('color')}
          >
            {isAr ? 'اللون' : 'Color'}
          </button>
          <button
            type="button"
            className={`ps-dock-tab ${activeTab === 'swatches' ? 'active' : ''}`}
            onClick={() => setActiveTab('swatches')}
          >
            {isAr ? 'العينات' : 'Swatches'}
          </button>
          <button
            type="button"
            className={`ps-dock-tab ${activeTab === 'gradients' ? 'active' : ''}`}
            onClick={() => setActiveTab('gradients')}
          >
            {isAr ? 'التدرجات' : 'Gradients'}
          </button>
          <button
            type="button"
            className={`ps-dock-tab ${activeTab === 'patterns' ? 'active' : ''}`}
            onClick={() => setActiveTab('patterns')}
          >
            {isAr ? 'الأنماط' : 'Patterns'}
          </button>
        </div>
        <button type="button" className="ps-dock-tab-menu-btn" title="Panel Options">
          <MoreHorizontal size={13} />
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="ps-color-content">
        {activeTab === 'color' && (
          <div className="ps-color-picker-row">
            {/* Foreground / Background Chip Overlap */}
            <div className="ps-fg-bg-box" title={isAr ? 'تبديل ألوان الفرشاة / القناع (X)' : 'Swap Colors (X)'}>
              <div
                className="ps-chip-swatch foreground"
                style={{ backgroundColor: activeColor }}
                title={isAr ? `اللون الأمامي: ${activeColor}` : `Foreground Color: ${activeColor}`}
              />
              <div
                className="ps-chip-swatch background"
                style={{ backgroundColor: secondaryColor }}
                title={isAr ? `اللون الخلفي: ${secondaryColor}` : `Background Color: ${secondaryColor}`}
              />
              {onToggleMaskColor && (
                <button
                  type="button"
                  className="ps-chip-swap-arrow"
                  onClick={onToggleMaskColor}
                  title={isAr ? 'تبديل (X)' : 'Swap (X)'}
                >
                  <ArrowLeftRight size={9} />
                </button>
              )}
            </div>

            {/* 2D Spectrum (Saturation x Brightness) */}
            <div
              ref={spectrumRef}
              className="ps-spectrum-field"
              style={{ backgroundColor: pureHueHex }}
              onMouseDown={handleSpectrumMouseDown}
            >
              <div className="ps-spectrum-white" />
              <div className="ps-spectrum-black" />
              {/* Reticle / Indicator */}
              <div
                className="ps-spectrum-reticle"
                style={{
                  left: `${sat}%`,
                  top: `${100 - val}%`,
                  backgroundColor: activeColor,
                }}
              />
            </div>

            {/* Rainbow Hue Vertical Slider */}
            <div
              ref={hueSliderRef}
              className="ps-hue-slider"
              onMouseDown={handleHueMouseDown}
              title={isAr ? 'شريط تدرج الألوان (Hue)' : 'Hue Slider'}
            >
              {/* Slider thumb triangle */}
              <div
                className="ps-hue-thumb"
                style={{ top: `${(hue / 360) * 100}%` }}
              />
            </div>
          </div>
        )}

        {activeTab === 'swatches' && (
          <div className="ps-swatches-grid">
            {PHOTOSHOP_DEFAULT_SWATCHES.map((hex, idx) => (
              <button
                key={`${hex}-${idx}`}
                type="button"
                className={`ps-swatch-cell ${activeColor.toLowerCase() === hex.toLowerCase() ? 'selected' : ''}`}
                style={{ backgroundColor: hex }}
                onClick={() => onChangeColor(hex)}
                title={hex}
              />
            ))}
          </div>
        )}

        {activeTab === 'gradients' && (
          <div className="ps-empty-tab-note">
            <span>{isAr ? 'تدرجات فوتوشوب الافتراضية' : 'Default Photoshop Gradients'}</span>
          </div>
        )}

        {activeTab === 'patterns' && (
          <div className="ps-empty-tab-note">
            <span>{isAr ? 'أنماط وخامات فوتوشوب' : 'Photoshop Patterns & Textures'}</span>
          </div>
        )}
      </div>
    </div>
  );
};
