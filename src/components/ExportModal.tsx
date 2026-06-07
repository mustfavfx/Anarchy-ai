import React, { useState, useEffect, useRef } from 'react';
import { X, Download, FolderOpen, Image as ImageIcon, Check, Loader2, FileImage } from 'lucide-react';
import { exportImage, getImageDimensions, convertImage, type ExportFormat, type ExportScale } from '../utils/imageExport';
import { save } from '@tauri-apps/plugin-dialog';
import './ExportModal.css';

export interface ExportModalProps {
  imageUrl: string;
  imageName?: string;
  onClose: () => void;
}

interface FormatOption {
  id: ExportFormat;
  label: string;
  desc: string;
  supportsQuality: boolean;
}

const FORMATS: FormatOption[] = [
  { id: 'png',  label: 'PNG',  desc: 'Lossless · Transparency', supportsQuality: false },
  { id: 'jpg',  label: 'JPG',  desc: 'Smaller file · No alpha',  supportsQuality: true  },
  { id: 'webp', label: 'WebP', desc: 'Best ratio · Modern',      supportsQuality: true  },
];

export const ExportModal: React.FC<ExportModalProps> = ({ imageUrl, imageName = 'anarchy-image', onClose }) => {
  const [format, setFormat]   = useState<ExportFormat>('png');
  const [quality, setQuality] = useState(92);
  const [scale, setScale]   = useState<ExportScale>(1);
  const [dims, setDims]       = useState<{ w: number; h: number } | null>(null);
  const [status, setStatus]   = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);

  const selectedFmt = FORMATS.find(f => f.id === format)!;

  useEffect(() => {
    getImageDimensions(imageUrl).then(setDims);
  }, [imageUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleExport = async (saveToDocuments: boolean) => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const isTauri = globalThis.window !== undefined && '__TAURI_INTERNALS__' in globalThis;

      if (!saveToDocuments && isTauri) {
        const extension = format;
        const defaultPath = `${imageName}.${extension}`;
        
        const selectedPath = await save({
          defaultPath,
          filters: [{
            name: `${format.toUpperCase()} Image`,
            extensions: [extension]
          }]
        });

        if (!selectedPath) {
          setStatus('idle');
          return;
        }

        const qualityVal = quality / 100;
        const dataUri = await convertImage(imageUrl, format, qualityVal, scale);
        
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('save_image_to_path', { path: selectedPath, dataUri });

        setStatus('done');
        setTimeout(() => setStatus('idle'), 2000);
        return;
      }

      await exportImage(imageUrl, {
        format,
        quality: quality / 100,
        baseName: imageName,
        saveToDocuments,
        scale,
      });
      setStatus('done');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Export failed');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <div
      className="export-overlay"
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="export-modal">

        {/* Header */}
        <div className="export-header">
          <div className="export-header-left">
            <FileImage size={16} />
            <span>Export Image</span>
          </div>
          <button className="export-close-btn" onClick={onClose} title="Close (Esc)">
            <X size={15} />
          </button>
        </div>

        {/* Preview strip */}
        <div className="export-preview-strip">
          <img src={imageUrl} alt="Preview" className="export-thumb" />
          <div className="export-meta">
            <span className="export-name">{imageName}</span>
            {dims && (
              <span className="export-dims">{dims.w} × {dims.h} px</span>
            )}
          </div>
        </div>

        {/* Format selector */}
        <div className="export-section">
          <label className="export-label">Format</label>
          <div className="export-format-grid">
            {FORMATS.map(f => (
              <button
                key={f.id}
                className={`export-fmt-btn ${format === f.id ? 'active' : ''}`}
                onClick={() => setFormat(f.id)}
              >
                <span className="fmt-name">{f.label}</span>
                <span className="fmt-desc">{f.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quality slider — only for JPG/WebP */}
        {selectedFmt.supportsQuality && (
          <div className="export-section">
            <div className="export-label-row">
              <label className="export-label">Quality</label>
              <span className="export-quality-val">{quality}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={1}
              value={quality}
              onChange={e => setQuality(Number(e.target.value))}
              className="export-quality-slider"
            />
            <div className="export-quality-hints">
              <span>Smaller file</span>
              <span>Higher quality</span>
            </div>
          </div>
        )}

        {/* Upscale selector - 2K/4K export */}
        <div className="export-section">
          <div className="export-label-row">
            <label className="export-label">Resolution</label>
            {dims && scale > 1 && (
              <span className="export-dims-upscaled">{dims.w * scale} × {dims.h * scale} px</span>
            )}
          </div>
          <div className="export-scale-grid">
            <button
              className={`export-scale-btn ${scale === 1 ? 'active' : ''}`}
              onClick={() => setScale(1)}
            >
              <span className="scale-name">1×</span>
              <span className="scale-desc">Original</span>
            </button>
            <button
              className={`export-scale-btn ${scale === 2 ? 'active' : ''}`}
              onClick={() => setScale(2)}
            >
              <span className="scale-name">2×</span>
              <span className="scale-desc">2K Quality</span>
            </button>
            <button
              className={`export-scale-btn ${scale === 4 ? 'active' : ''}`}
              onClick={() => setScale(4)}
            >
              <span className="scale-name">4×</span>
              <span className="scale-desc">4K Quality</span>
            </button>
          </div>
        </div>

        {/* Status feedback */}
        {status === 'error' && (
          <div className="export-error">{errorMsg}</div>
        )}

        {/* Action buttons */}
        <div className="export-actions">
          <button
            className={`export-btn primary ${status === 'loading' ? 'loading' : ''} ${status === 'done' ? 'done' : ''}`}
            onClick={() => handleExport(false)}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? (
              <><Loader2 size={14} className="spin" /> Saving…</>
            ) : status === 'done' ? (
              <><Check size={14} /> Saved!</>
            ) : (
              <><Download size={14} /> Save</>
            )}
          </button>
          <button
            className="export-btn secondary"
            onClick={() => handleExport(true)}
            disabled={status === 'loading'}
            title="Save directly to Documents/Anarchy AI"
          >
            <FolderOpen size={14} />
            <span>Save to Documents</span>
          </button>
        </div>

        <p className="export-footer-note">
          <ImageIcon size={11} />
          "Save" prompts for a custom file location on your system. "Save to Documents" saves directly to Documents/Anarchy AI.
        </p>

      </div>
    </div>
  );
};
