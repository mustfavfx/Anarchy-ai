import React, { useState, useEffect } from 'react';
import {
  Download,
  Box,
  CheckCircle2,
  X,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Film
} from 'lucide-react';
import './VideoConverterModal.css';

export interface VideoConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstalled?: () => void;
}

export const VideoConverterModal: React.FC<VideoConverterModalProps> = ({
  isOpen,
  onClose,
  onInstalled,
}) => {
  const [progress, setProgress] = useState(9); // Initial 9% matching screenshot
  const [downloadedMB, setDownloadedMB] = useState(9.9);
  const totalMB = 109.5;
  const [isPaused, setIsPaused] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (isPaused || isCompleted) return;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setIsCompleted(true);
          setDownloadedMB(totalMB);
          if (onInstalled) onInstalled();
          return 100;
        }
        const next = Math.min(100, prev + 1.2);
        setDownloadedMB(parseFloat(((next / 100) * totalMB).toFixed(1)));
        return next;
      });
    }, 200);

    return () => clearInterval(timer);
  }, [isOpen, isPaused, isCompleted, totalMB, onInstalled]);

  const handleReset = () => {
    setProgress(9);
    setDownloadedMB(9.9);
    setIsPaused(false);
    setIsCompleted(false);
  };

  if (!isOpen) return null;

  return (
    <div className="vcm-backdrop" onClick={onClose}>
      <div className="vcm-card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="vcm-close-btn"
          onClick={onClose}
          title="Close"
        >
          <X size={18} />
        </button>

        {/* Left: Holographic 3D Media Chip Graphic */}
        <div className="vcm-graphic-panel">
          <div className="vcm-hologram-wrap">
            <svg
              className="vcm-hologram-svg"
              viewBox="0 0 380 440"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                {/* Glowing gradients */}
                <linearGradient id="vcmNeonCyan" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#0891b2" stopOpacity="0.3" />
                </linearGradient>
                <linearGradient id="vcmGlassPlate" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.35" />
                  <stop offset="50%" stopColor="#0891b2" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#0e7490" stopOpacity="0.25" />
                </linearGradient>
                <linearGradient id="vcmBaseStation" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="100%" stopColor="#090d16" />
                </linearGradient>
                <filter id="vcmGlowFilter" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Background HUD Matrix Grid */}
              <g opacity="0.18">
                <line x1="40" y1="90" x2="40" y2="160" stroke="#06b6d4" strokeWidth="1.5" />
                <line x1="48" y1="100" x2="48" y2="160" stroke="#06b6d4" strokeWidth="1.5" />
                <line x1="56" y1="110" x2="56" y2="160" stroke="#06b6d4" strokeWidth="1.5" />
                <line x1="64" y1="80" x2="64" y2="160" stroke="#06b6d4" strokeWidth="1.5" />
              </g>

              {/* HUD Text labels */}
              <text x="240" y="80" fill="#06b6d4" fontSize="8" fontFamily="monospace" opacity="0.6">
                MEDIA_STREAM
              </text>
              <text x="240" y="94" fill="#67e8f9" fontSize="7" fontFamily="monospace" opacity="0.5">
                DOWNLOAD: {Math.round(progress)}% Complete
              </text>
              <text x="240" y="106" fill="#06b6d4" fontSize="7" fontFamily="monospace" opacity="0.4">
                BUFFERING: 1080p
              </text>

              {/* Holographic Orbit Ring */}
              <ellipse
                cx="180"
                cy="235"
                rx="140"
                ry="38"
                stroke="url(#vcmNeonCyan)"
                strokeWidth="1.5"
                strokeDasharray="8 6"
                className="vcm-orbit-ring"
              />
              <circle cx="50" cy="235" r="3" fill="#22d3ee" filter="url(#vcmGlowFilter)" />

              {/* Secondary Floating Glass Plate Behind */}
              <g transform="translate(145, 120)">
                <rect
                  x="0"
                  y="0"
                  width="110"
                  height="125"
                  rx="14"
                  fill="url(#vcmGlassPlate)"
                  stroke="#22d3ee"
                  strokeWidth="1.2"
                  opacity="0.4"
                  transform="skewY(-10)"
                />
              </g>

              {/* Primary Floating Media Glass Processor Plate */}
              <g transform="translate(100, 110)">
                <rect
                  x="0"
                  y="0"
                  width="135"
                  height="145"
                  rx="16"
                  fill="url(#vcmGlassPlate)"
                  stroke="#22d3ee"
                  strokeWidth="2"
                  filter="url(#vcmGlowFilter)"
                  transform="skewY(-8)"
                />
                {/* Circuit Traces inside glass */}
                <path
                  d="M 20 30 L 40 30 L 50 40 L 90 40"
                  stroke="#67e8f9"
                  strokeWidth="1.2"
                  opacity="0.6"
                  transform="skewY(-8)"
                />
                <path
                  d="M 20 110 L 45 110 L 55 100 L 100 100"
                  stroke="#67e8f9"
                  strokeWidth="1.2"
                  opacity="0.6"
                  transform="skewY(-8)"
                />
                {/* Play Symbol in center of chip */}
                <circle
                  cx="68"
                  cy="68"
                  r="28"
                  fill="rgba(6, 182, 212, 0.2)"
                  stroke="#22d3ee"
                  strokeWidth="2"
                  filter="url(#vcmGlowFilter)"
                  transform="skewY(-8)"
                />
                <path
                  d="M 62 56 L 80 68 L 62 80 Z"
                  fill="#ffffff"
                  filter="url(#vcmGlowFilter)"
                  transform="skewY(-8)"
                />
              </g>

              {/* Animated Download Energy Arrow Beaming Downward */}
              <g transform="translate(180, 275)" className="vcm-down-arrow-group">
                <path
                  d="M 0 -25 L 0 10 M -12 -2 L 0 10 L 12 -2"
                  stroke="#22d3ee"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#vcmGlowFilter)"
                />
              </g>

              {/* Hardware Base Station Unit */}
              <g transform="translate(60, 315)">
                {/* Upper Deck */}
                <rect
                  x="0"
                  y="0"
                  width="240"
                  height="45"
                  rx="12"
                  fill="url(#vcmBaseStation)"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="1.5"
                />
                {/* Glowing Light Ring on Top */}
                <ellipse
                  cx="120"
                  cy="20"
                  rx="45"
                  ry="12"
                  fill="rgba(6, 182, 212, 0.3)"
                  stroke="#06b6d4"
                  strokeWidth="2.5"
                  filter="url(#vcmGlowFilter)"
                />
                <ellipse cx="120" cy="20" rx="20" ry="5" fill="#22d3ee" />

                {/* Front Panel & Ports */}
                <rect x="0" y="32" width="240" height="38" rx="8" fill="#0b0f19" stroke="rgba(255,255,255,0.08)" />
                {/* Heat Grill Slots */}
                <line x1="20" y1="46" x2="48" y2="46" stroke="#1e293b" strokeWidth="2.5" />
                <line x1="20" y1="52" x2="48" y2="52" stroke="#1e293b" strokeWidth="2.5" />
                {/* USB / Audio Ports */}
                <rect x="195" y="45" width="12" height="5" rx="1.5" fill="#1e293b" />
                <circle cx="180" cy="48" r="3" fill="#1e293b" />
                <circle cx="220" cy="48" r="2" fill="#22d3ee" filter="url(#vcmGlowFilter)" />
              </g>
            </svg>
          </div>
        </div>

        {/* Right: Download Info, Card & Progress Bar */}
        <div className="vcm-info-panel">
          {/* Top Download Icon Badge (Rounded Teal Box) */}
          <div className="vcm-top-badge">
            <Download size={26} className="vcm-badge-icon" />
          </div>

          <h2 className="vcm-title">Video converter plugin</h2>
          <p className="vcm-subtitle">
            {isCompleted
              ? 'Video converter plugin installed and active'
              : isPaused
              ? 'Download paused'
              : 'Downloading video converter...'}
          </p>

          {/* Package Card */}
          <div className="vcm-package-card">
            <div className="vcm-package-icon-box">
              <Box size={24} className="vcm-box-icon" />
            </div>
            <div className="vcm-package-details">
              <span className="vcm-package-name">Video converter package</span>
              <span className="vcm-package-meta">Anarchy AI • Windows x64</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="vcm-progress-container">
            <div className="vcm-progress-track">
              <div
                className="vcm-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="vcm-progress-labels">
              <span className="vcm-progress-mb">
                {downloadedMB} MB / {totalMB} MB
              </span>
              <span className="vcm-progress-pct">{Math.round(progress)}%</span>
            </div>
          </div>

          {/* Actions */}
          <div className="vcm-actions">
            {!isCompleted ? (
              <>
                <button
                  type="button"
                  className="vcm-action-btn secondary"
                  onClick={() => setIsPaused((prev) => !prev)}
                >
                  {isPaused ? <Play size={14} /> : <Pause size={14} />}
                  <span>{isPaused ? 'Resume' : 'Pause'}</span>
                </button>
                <button
                  type="button"
                  className="vcm-action-btn reset"
                  onClick={handleReset}
                  title="Restart download"
                >
                  <RotateCcw size={14} />
                </button>
              </>
            ) : (
              <button
                type="button"
                className="vcm-action-btn primary"
                onClick={onClose}
              >
                <CheckCircle2 size={16} />
                <span>Ready to Render</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
