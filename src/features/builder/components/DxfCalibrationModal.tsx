/**
 * Lets the user click two points on the source image and type the real-world
 * distance between them (e.g. "this door = 90 cm"). Produces a `DxfCalibration`
 * ({ mmPerPixel }) that makes the exported DXF true-to-scale instead of just
 * stretched to fit an A1 sheet.
 *
 * mmPerPixel here is measured at the image's NATURAL resolution — the export
 * pipeline internally downsamples for processing, and converts this value
 * accordingly.
 */
import React, { useRef, useState, useCallback } from 'react';
import type { DxfCalibration } from '../../../services/export';

interface CalibPoint {
  x: number;   // natural-resolution pixel coords
  y: number;
  xPct: number; // position as % of rendered image box, for marker placement
  yPct: number;
}

type Unit = 'mm' | 'cm' | 'm';
const UNIT_TO_MM: Record<Unit, number> = { mm: 1, cm: 10, m: 1000 };

interface DxfCalibrationModalProps {
  imageUrl: string; // must already be a directly-renderable src (data: URI or http URL)
  onConfirm: (calibration: DxfCalibration | undefined) => void;
  onCancel: () => void;
}

export const DxfCalibrationModal: React.FC<DxfCalibrationModalProps> = ({
  imageUrl,
  onConfirm,
  onCancel,
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [points, setPoints] = useState<CalibPoint[]>([]);
  const [value, setValue] = useState<string>('');
  const [unit, setUnit] = useState<Unit>('cm');

  const handleImageClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    const img = imgRef.current;
    if (!img || !imgLoaded) return;
    const rect = img.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    if (relX < 0 || relX > 1 || relY < 0 || relY > 1) return;

    const point: CalibPoint = {
      x: relX * img.naturalWidth,
      y: relY * img.naturalHeight,
      xPct: relX * 100,
      yPct: relY * 100,
    };

    setPoints(prev => (prev.length >= 2 ? [point] : [...prev, point]));
  }, [imgLoaded]);

  const pixelDistance = points.length === 2
    ? Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
    : 0;

  const numericValue = Number.parseFloat(value);
  const isValid = points.length === 2 && Number.isFinite(numericValue) && numericValue > 0 && pixelDistance > 0;

  const mmPerPixelPreview = isValid
    ? (numericValue * UNIT_TO_MM[unit]) / pixelDistance
    : null;

  const handleReset = () => setPoints([]);

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm({ mmPerPixel: (numericValue * UNIT_TO_MM[unit]) / pixelDistance });
  };

  const handleSkip = () => onConfirm(undefined);

  return (
    <dialog
      className="dxf-calib-overlay"
      open
      aria-label="Calibrate DXF export scale"
      aria-modal="true"
    >
      <div className="dxf-calib-modal">
        <h3>Set Real-World Scale</h3>
        <p className="dxf-calib-subtitle">
          Click two points on the image marking a distance you know in real life
          (a door, a wall segment, a grid line) — this makes the exported DXF
          true-to-scale instead of an approximate trace.
        </p>

        <div className="dxf-calib-image-wrap">
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Calibration source"
            onLoad={() => setImgLoaded(true)}
            onClick={handleImageClick}
            className="dxf-calib-image"
            draggable={false}
          />
          {points.length === 2 && (
            <svg className="dxf-calib-line-svg" preserveAspectRatio="none">
              <line
                x1={`${points[0].xPct}%`} y1={`${points[0].yPct}%`}
                x2={`${points[1].xPct}%`} y2={`${points[1].yPct}%`}
                className="dxf-calib-line"
              />
            </svg>
          )}
          {points.map((p, i) => (
            <div
              key={i}
              className="dxf-calib-point"
              style={{ left: `${p.xPct}%`, top: `${p.yPct}%` }}
            >
              {i + 1}
            </div>
          ))}
          {!imgLoaded && <div className="dxf-calib-loading">Loading image…</div>}
        </div>

        <div className="dxf-calib-controls">
          <span className="dxf-calib-step">
            {points.length === 0 && 'Click the first point'}
            {points.length === 1 && 'Click the second point'}
            {points.length === 2 && 'Points set — enter the real distance'}
          </span>

          <div className="dxf-calib-input-row">
            <input
              type="number"
              min="0"
              step="any"
              placeholder="Real-world distance"
              value={value}
              onChange={e => setValue(e.target.value)}
              disabled={points.length < 2}
              className="dxf-calib-input"
            />
            <select
              value={unit}
              onChange={e => setUnit(e.target.value as Unit)}
              disabled={points.length < 2}
              className="dxf-calib-unit"
            >
              <option value="mm">mm</option>
              <option value="cm">cm</option>
              <option value="m">m</option>
            </select>
            <button type="button" onClick={handleReset} disabled={points.length === 0} className="dxf-calib-reset">
              Reset points
            </button>
          </div>

          {mmPerPixelPreview !== null && (
            <p className="dxf-calib-preview">
              Scale: {pixelDistance.toFixed(1)}px = {value}{unit} → 1px = {mmPerPixelPreview.toFixed(4)}mm
            </p>
          )}
        </div>

        <div className="dxf-calib-actions">
          <button type="button" onClick={onCancel} className="dxf-calib-cancel">
            Cancel
          </button>
          <button type="button" onClick={handleSkip} className="dxf-calib-skip">
            Skip — approximate scale
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isValid}
            className="dxf-calib-confirm"
          >
            Export with this scale
          </button>
        </div>
      </div>
    </dialog>
  );
};
