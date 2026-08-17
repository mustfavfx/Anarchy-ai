import React, { useState } from 'react';
import { ZoomIn, Loader2, X, Check } from 'lucide-react';
import { replicateService } from '../../../services/replicate/ReplicateService';
import { logger } from '../../../utils/logger';
import './SelectiveUpscaleModal.css';

interface SelectiveUpscaleModalProps {
  imageUrl: string;
  onApplyUpscaledRegion: (compositeResultUrl: string) => void;
  onClose: () => void;
}

export const SelectiveUpscaleModal: React.FC<SelectiveUpscaleModalProps> = ({
  imageUrl,
  onApplyUpscaledRegion,
  onClose
}) => {
  const [scaleFactor, setScaleFactor] = useState<2 | 4>(2);
  const [enhanceFace, setEnhanceFace] = useState<boolean>(true);
  const [isUpscaling, setIsUpscaling] = useState<boolean>(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunSelectiveUpscale = async () => {
    setIsUpscaling(true);
    setError(null);

    try {
      let inputUrl = imageUrl;
      if (inputUrl.startsWith('data:') || inputUrl.startsWith('blob:')) {
        inputUrl = await replicateService.uploadToReplicate(inputUrl);
      }

      const output = await replicateService.runPrediction(
        'nightmareai/real-esrgan',
        {
          image: inputUrl,
          scale: scaleFactor,
          face_enhance: enhanceFace,
        }
      );

      const upscaledUrl = Array.isArray(output) ? output[0] : (typeof output === 'string' ? output : null);
      if (!upscaledUrl) throw new Error('Upscaler returned no output image');

      setResultUrl(upscaledUrl);
    } catch (err: any) {
      logger.error('[SelectiveUpscaleModal] Error:', err);
      setError(err?.message || 'Failed to upscale region');
    } finally {
      setIsUpscaling(false);
    }
  };

  const handleApply = () => {
    if (resultUrl) {
      onApplyUpscaledRegion(resultUrl);
      onClose();
    }
  };

  return (
    <div className="upscale-modal-backdrop">
      <div className="upscale-modal-card">
        <div className="upscale-modal-header">
          <div className="upscale-modal-title">
            <ZoomIn className="upscale-icon" size={18} />
            <span>Selective Region Upscale (Magnific AI Style)</span>
          </div>
          <button className="upscale-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="upscale-modal-body">
          <div className="upscale-preview">
            <img src={resultUrl || imageUrl} alt="Selective Upscale Preview" />
          </div>

          <div className="upscale-controls">
            <label className="section-title">Upscale & Enhancement Controls</label>
            
            <div className="control-group">
              <label>Resolution Scale Factor</label>
              <div className="scale-buttons">
                <button
                  className={`scale-btn ${scaleFactor === 2 ? 'active' : ''}`}
                  onClick={() => setScaleFactor(2)}
                >
                  2x Ultra Detail
                </button>
                <button
                  className={`scale-btn ${scaleFactor === 4 ? 'active' : ''}`}
                  onClick={() => setScaleFactor(4)}
                >
                  4x High-Res Architectural
                </button>
              </div>
            </div>

            <div className="control-group checkbox-row">
              <input
                type="checkbox"
                id="face-check"
                checked={enhanceFace}
                onChange={(e) => setEnhanceFace(e.target.checked)}
              />
              <label htmlFor="face-check">Face & Architectural Detail Preservation (GFPGAN)</label>
            </div>

            {error && <div className="upscale-error">{error}</div>}

            <div className="modal-footer-actions">
              {resultUrl ? (
                <button className="apply-upscale-btn" onClick={handleApply}>
                  <Check size={16} /> Apply Upscaled Image to Node
                </button>
              ) : (
                <button
                  className="start-upscale-btn"
                  onClick={handleRunSelectiveUpscale}
                  disabled={isUpscaling}
                >
                  {isUpscaling ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Upscaling Detail...
                    </>
                  ) : (
                    <>
                      <ZoomIn size={16} /> Run Selective Upscale Now
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
