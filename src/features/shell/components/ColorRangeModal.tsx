import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, SunMedium, Pipette, Check, Plus, Minus } from 'lucide-react';
import { ColorRangeEngine, type LumaRangeType } from '../../../services/mask/ColorRangeEngine';
import './ColorRangeModal.css';

export interface ColorRangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  baseImageSrc: string | null;
  brushColor: string;
  maskOpacity: number;
  onMaskApplied: () => void;
}

export const ColorRangeModal: React.FC<ColorRangeModalProps> = ({
  isOpen,
  onClose,
  canvasRef,
  baseImageSrc,
  brushColor,
  maskOpacity,
  onMaskApplied,
}) => {
  const [activeTab, setActiveTab] = useState<'luma' | 'color'>('luma');

  // Luma State
  const [lumaType, setLumaType] = useState<LumaRangeType>('highlights');
  const [lowThreshold, setLowThreshold] = useState<number>(192);
  const [highThreshold, setHighThreshold] = useState<number>(255);

  // Color Range State
  const [sampledColorHex, setSampledColorHex] = useState<string>('#3b82f6');
  const [tolerance, setTolerance] = useState<number>(35);

  // Common Controls
  const [feather, setFeather] = useState<number>(2);
  const [invert, setInvert] = useState<boolean>(false);

  // Cached base image ImageData
  const imgDataRef = useRef<ImageData | null>(null);

  // Load and cache base image ImageData
  useEffect(() => {
    if (!isOpen || !baseImageSrc) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = baseImageSrc;
    img.onload = () => {
      const offscreen = document.createElement('canvas');
      offscreen.width = img.naturalWidth || img.width;
      offscreen.height = img.naturalHeight || img.height;
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        try {
          imgDataRef.current = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
        } catch {
          // CORS fallback if any
        }
      }
    };
  }, [isOpen, baseImageSrc]);

  // Sync default thresholds when preset changes
  const handleLumaPresetSelect = (preset: LumaRangeType) => {
    setLumaType(preset);
    if (preset === 'highlights') {
      setLowThreshold(192);
      setHighThreshold(255);
    } else if (preset === 'midtones') {
      setLowThreshold(64);
      setHighThreshold(192);
    } else {
      // shadows
      setLowThreshold(0);
      setHighThreshold(64);
    }
  };

  const handleApply = useCallback(
    (mode: 'add' | 'subtract' | 'replace') => {
      const targetCanvas = canvasRef.current;
      const imgData = imgDataRef.current;
      if (!targetCanvas || !imgData) return;

      let mask: Uint8Array;
      if (activeTab === 'luma') {
        mask = ColorRangeEngine.generateLumaMask(imgData, {
          type: lumaType,
          lowThreshold,
          highThreshold,
          feather,
          invert,
        });
      } else {
        const targetR = parseInt(sampledColorHex.slice(1, 3), 16) || 255;
        const targetG = parseInt(sampledColorHex.slice(3, 5), 16) || 255;
        const targetB = parseInt(sampledColorHex.slice(5, 7), 16) || 255;

        mask = ColorRangeEngine.generateColorRangeMask(imgData, {
          targetR,
          targetG,
          targetB,
          tolerance,
          feather,
          invert,
        });
      }

      ColorRangeEngine.applyMaskToCanvas(targetCanvas, mask, brushColor, maskOpacity, mode);
      onMaskApplied();
      onClose();
    },
    [
      canvasRef,
      activeTab,
      lumaType,
      lowThreshold,
      highThreshold,
      feather,
      invert,
      sampledColorHex,
      tolerance,
      brushColor,
      maskOpacity,
      onMaskApplied,
      onClose,
    ]
  );

  if (!isOpen) return null;

  return (
    <div className="color-range-backdrop" onClick={onClose}>
      <div className="color-range-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="color-range-header">
          <div className="color-range-title">
            <SunMedium size={18} />
            <span>Smart Color Range & Luma Mask</span>
          </div>
          <button
            type="button"
            className="color-range-close-btn"
            onClick={onClose}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="color-range-tabs">
          <button
            type="button"
            className={`color-range-tab ${activeTab === 'luma' ? 'active' : ''}`}
            onClick={() => setActiveTab('luma')}
          >
            <SunMedium size={14} />
            <span>Luminance (Luma)</span>
          </button>
          <button
            type="button"
            className={`color-range-tab ${activeTab === 'color' ? 'active' : ''}`}
            onClick={() => setActiveTab('color')}
          >
            <Pipette size={14} />
            <span>Sampled Color</span>
          </button>
        </div>

        {/* Body */}
        <div className="color-range-body">
          {activeTab === 'luma' ? (
            <>
              {/* Preset Buttons */}
              <div className="color-range-presets">
                <button
                  type="button"
                  className={`color-range-preset-btn ${lumaType === 'highlights' ? 'active' : ''}`}
                  onClick={() => handleLumaPresetSelect('highlights')}
                >
                  Highlights (&gt;192)
                </button>
                <button
                  type="button"
                  className={`color-range-preset-btn ${lumaType === 'midtones' ? 'active' : ''}`}
                  onClick={() => handleLumaPresetSelect('midtones')}
                >
                  Midtones (64-192)
                </button>
                <button
                  type="button"
                  className={`color-range-preset-btn ${lumaType === 'shadows' ? 'active' : ''}`}
                  onClick={() => handleLumaPresetSelect('shadows')}
                >
                  Shadows (&lt;64)
                </button>
              </div>

              {/* Threshold Sliders */}
              <div className="color-range-field">
                <div className="color-range-field-header">
                  <span>Lower Cutoff Threshold</span>
                  <span className="color-range-field-val">{lowThreshold}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={lowThreshold}
                  onChange={(e) => setLowThreshold(Number(e.target.value))}
                  className="color-range-slider"
                />
              </div>

              <div className="color-range-field">
                <div className="color-range-field-header">
                  <span>Upper Cutoff Threshold</span>
                  <span className="color-range-field-val">{highThreshold}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={highThreshold}
                  onChange={(e) => setHighThreshold(Number(e.target.value))}
                  className="color-range-slider"
                />
              </div>
            </>
          ) : (
            <>
              {/* Sampled Color Picker */}
              <div className="color-range-picker-row">
                <div className="color-picker-input-wrapper">
                  <div
                    className="color-swatch-box"
                    style={{ backgroundColor: sampledColorHex }}
                  />
                  <input
                    type="color"
                    value={sampledColorHex}
                    onChange={(e) => setSampledColorHex(e.target.value)}
                    className="color-picker-native"
                    title="Choose Sampled Color"
                  />
                </div>
                <div>
                  <span className="color-hex-text">{sampledColorHex.toUpperCase()}</span>
                  <div className="color-sampler-hint">Click swatch to select target color tone</div>
                </div>
              </div>

              {/* Tolerance Slider */}
              <div className="color-range-field">
                <div className="color-range-field-header">
                  <span>Color Fuzziness / Tolerance</span>
                  <span className="color-range-field-val">{tolerance}%</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                  className="color-range-slider"
                />
              </div>
            </>
          )}

          {/* Common Feather Slider */}
          <div className="color-range-field">
            <div className="color-range-field-header">
              <span>Edge Feathering Radius</span>
              <span className="color-range-field-val">{feather}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="25"
              value={feather}
              onChange={(e) => setFeather(Number(e.target.value))}
              className="color-range-slider"
            />
          </div>

          {/* Invert Checkbox */}
          <label className="color-range-checkbox-row">
            <input
              type="checkbox"
              checked={invert}
              onChange={(e) => setInvert(e.target.checked)}
            />
            <span>Invert Selected Mask Area</span>
          </label>
        </div>

        {/* Footer Actions */}
        <div className="color-range-footer">
          <button
            type="button"
            className="color-range-btn color-range-btn-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="color-range-btn color-range-btn-mode"
            onClick={() => handleApply('subtract')}
            title="Subtract selection from existing mask"
          >
            <Minus size={13} /> Subtract (-)
          </button>
          <button
            type="button"
            className="color-range-btn color-range-btn-mode"
            onClick={() => handleApply('add')}
            title="Add selection to existing mask"
          >
            <Plus size={13} /> Add (+)
          </button>
          <button
            type="button"
            className="color-range-btn color-range-btn-primary"
            onClick={() => handleApply('replace')}
            title="Replace existing mask with this selection"
          >
            <Check size={14} /> Replace Mask
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColorRangeModal;
