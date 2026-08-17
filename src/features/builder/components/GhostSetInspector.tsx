import React, { useState } from 'react';
import { 
  Sparkles, Check, X, Split, Layers, ShieldCheck, Zap
} from 'lucide-react';
import './GhostSetInspector.css';

export interface GhostCandidate {
  id: string;
  holdId?: string;
  imageUrl: string;
  engineName: string;
  seed: number;
  scaleMultiplier?: number;
  label: string;
  creditCost: number;
  maskCapability?: 'binary_mask' | 'semantic_text' | 'hybrid';
}

interface GhostSetInspectorProps {
  originalImageUrl: string;
  candidates: GhostCandidate[];
  onConfirmWinner: (winner: GhostCandidate) => void;
  onCancel: () => void;
  isArabic?: boolean;
}

export const GhostSetInspector: React.FC<GhostSetInspectorProps> = ({
  originalImageUrl,
  candidates,
  onConfirmWinner,
  onCancel,
  isArabic = false,
}) => {
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(candidates[0]?.id || '');
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [compareMode, setCompareMode] = useState<'slider' | 'side-by-side'>('slider');

  const selectedCandidate = candidates.find(c => c.id === selectedCandidateId) || candidates[0];

  return (
    <div className="ghost-inspector-overlay" style={{ direction: isArabic ? 'rtl' : 'ltr' }}>
      <div className="ghost-inspector-modal">
        {/* Header */}
        <div className="ghost-inspector-header">
          <div className="header-title">
            <Sparkles size={18} className="text-rose-400" />
            <div>
              <h3>{isArabic ? 'مجموعة المرشحين (Ghost Set Candidate Selection)' : 'Ghost Set Candidate Selection'}</h3>
              <p>{isArabic ? 'اختر النتيجة الأفضل لتثبيتها وحساب الكريدت عليها فقط' : 'Compare generated variants. Credits are charged only on confirmed selection.'}</p>
            </div>
          </div>

          <div className="header-controls">
            <button 
              type="button" 
              className={`mode-btn ${compareMode === 'slider' ? 'active' : ''}`}
              onClick={() => setCompareMode('slider')}
              title="Split Slider Comparison"
            >
              <Split size={15} />
              <span>{isArabic ? 'مقارنة سحب' : 'Split Slider'}</span>
            </button>
            <button 
              type="button" 
              className={`mode-btn ${compareMode === 'side-by-side' ? 'active' : ''}`}
              onClick={() => setCompareMode('side-by-side')}
              title="Side by Side"
            >
              <Layers size={15} />
              <span>{isArabic ? 'جنباً إلى جنب' : 'Side-by-Side'}</span>
            </button>
            <button type="button" className="close-btn" onClick={onCancel} title="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content Comparison View */}
        <div className="ghost-inspector-content">
          {compareMode === 'slider' ? (
            <div className="slider-compare-stage">
              <img src={originalImageUrl} alt="Original" className="compare-bg-img" />
              {selectedCandidate && (
                <div className="compare-fg-wrap" style={{ width: `${sliderPosition}%` }}>
                  <img src={selectedCandidate.imageUrl} alt="Candidate" className="compare-fg-img" />
                </div>
              )}
              {/* Interactive Slider Bar */}
              <input 
                type="range" 
                min={0} 
                max={100} 
                value={sliderPosition}
                onChange={e => setSliderPosition(Number(e.target.value))}
                className="compare-slider-input"
              />
              <div className="slider-divider-line" style={{ left: `${sliderPosition}%` }}>
                <div className="slider-handle">
                  <Split size={14} />
                </div>
              </div>

              <span className="slider-badge left">{isArabic ? 'الأصل' : 'Original'}</span>
              <span className="slider-badge right">{selectedCandidate?.label || 'Candidate'}</span>
            </div>
          ) : (
            <div className="side-by-side-stage">
              <div className="side-card">
                <span className="card-badge">{isArabic ? 'الأصل' : 'Original'}</span>
                <img src={originalImageUrl} alt="Original" />
              </div>
              <div className="side-card active">
                <span className="card-badge highlight">{selectedCandidate?.label} ({selectedCandidate?.engineName})</span>
                <img src={selectedCandidate?.imageUrl} alt="Candidate" />
              </div>
            </div>
          )}
        </div>

        {/* Candidates Selector Cards */}
        <div className="ghost-candidates-bar">
          <div className="candidates-list">
            {candidates.map((cand, idx) => (
              <button
                key={cand.id}
                type="button"
                className={`candidate-card ${cand.id === selectedCandidateId ? 'selected' : ''}`}
                onClick={() => setSelectedCandidateId(cand.id)}
              >
                <img src={cand.imageUrl} alt={cand.label} />
                <div className="cand-info">
                  <span className="cand-title">{cand.label || `Variant ${idx + 1}`}</span>
                  <span className="cand-engine">{cand.engineName}</span>
                </div>
                <span className="cand-seed">Seed: {cand.seed}</span>
              </button>
            ))}
          </div>

          <div className="ghost-confirm-footer">
            <div className="credit-guarantee">
              <ShieldCheck size={16} className="text-emerald-400" />
              <span>{isArabic ? 'ضمان الكريدت: يُخصم الكريدت فقط عند التثبيت' : 'Credit Protection: Deduction occurs only on confirmed winner.'}</span>
              <span className="cost-tag"><Zap size={12} /> {selectedCandidate?.creditCost || 1} Credit</span>
            </div>

            <div className="footer-actions">
              <button type="button" className="ghost-cancel-btn" onClick={onCancel}>
                {isArabic ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                type="button" 
                className="ghost-confirm-btn"
                onClick={() => selectedCandidate && onConfirmWinner(selectedCandidate)}
              >
                <Check size={16} />
                <span>{isArabic ? 'تثبيت النتيجة في المشجر' : 'Confirm & Lock Winner'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
