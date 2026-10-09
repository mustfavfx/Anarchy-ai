import React, { useRef, useCallback, useState, useEffect } from 'react';

interface MarkupVerticalSliderProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  label?: string;
}

export const MarkupVerticalSlider: React.FC<MarkupVerticalSliderProps> = ({
  value,
  min = 2,
  max = 72,
  onChange,
  label = 'Size',
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Calculate percentage: bottom is min, top is max (or top is max, bottom is min)
  // In Screenshot 1, knob is near bottom (lower value), top is higher value
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));

  const updateFromClientY = useCallback(
    (clientY: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      // rect.bottom is min (0% from bottom), rect.top is max (100% from bottom)
      const ratio = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
      const newVal = Math.round(min + ratio * (max - min));
      onChange(newVal);
    },
    [min, max, onChange]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    updateFromClientY(e.clientY);
  };

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      updateFromClientY(e.clientY);
    };

    const onMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, updateFromClientY]);

  return (
    <div
      className="markup-vertical-slider-pill"
      title={`${label}: ${value}px`}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={trackRef}
        className="markup-vertical-slider-track"
        onMouseDown={handleMouseDown}
      >
        {/* Track fill bar */}
        <div
          className="markup-vertical-slider-fill"
          style={{ height: `${pct * 100}%` }}
        />

        {/* Circular thumb knob */}
        <div
          className={`markup-vertical-slider-thumb ${isDragging ? 'active' : ''}`}
          style={{ bottom: `calc(${pct * 100}% - 14px)` }}
          onMouseDown={handleMouseDown}
        >
          {/* Inner dot or value hint */}
          <div className="thumb-inner-dot" />
        </div>
      </div>

      {/* Floating tooltip badge when dragging */}
      {isDragging && (
        <div className="markup-slider-tooltip">
          {value}px
        </div>
      )}
    </div>
  );
};
