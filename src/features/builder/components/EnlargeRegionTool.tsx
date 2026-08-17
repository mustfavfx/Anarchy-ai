import React, { useState, useRef, useEffect } from 'react';
import { Maximize2, X, Sparkles, Shield, Cpu, Activity } from 'lucide-react';
import { SemanticSurfaceClassifier, SurfaceAnalysisResult } from '../../../services/ai/semanticSurfaceClassifier';
import { PreserveGeometryEngine } from '../../../services/ai/preserveGeometryEngine';
import './EnlargeRegionTool.css';

export interface UnscaledRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  scaleMultiplier: number;
  preserveGeometry: boolean;
  surfaceType?: string;
  recommendedEngine?: string;
}

interface EnlargeRegionToolProps {
  imageUrl: string;
  onApplyEnlarge: (region: UnscaledRegion) => void;
  onCancel: () => void;
  isArabic?: boolean;
}

export const EnlargeRegionTool: React.FC<EnlargeRegionToolProps> = ({
  imageUrl,
  onApplyEnlarge,
  onCancel,
  isArabic = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [scaleMultiplier, setScaleMultiplier] = useState<number>(2.0);
  const [preserveGeometry, setPreserveGeometry] = useState<boolean>(true);
  const [analysis, setAnalysis] = useState<SurfaceAnalysisResult | null>(null);
  const [edgeDataUrl, setEdgeDataUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(true);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number }>({ width: 1024, height: 1024 });

  useEffect(() => {
    let isMounted = true;
    setIsAnalyzing(true);

    const runSemanticAnalysis = async () => {
      try {
        const res = await SemanticSurfaceClassifier.analyzeRegion(imageUrl);
        if (!isMounted) return;
        setAnalysis(res);
        setPreserveGeometry(res.preserveGeometryRecommended);
        setScaleMultiplier(res.suggestedScale);

        const edgeRes = await PreserveGeometryEngine.generateEdgeMap(imageUrl, 512, 512);
        if (!isMounted) return;
        setEdgeDataUrl(edgeRes.edgeDataUrl);
      } catch (err) {
        console.error('[EnlargeRegionTool] Classifier error:', err);
      } finally {
        if (isMounted) setIsAnalyzing(false);
      }
    };

    runSemanticAnalysis();

    return () => { isMounted = false; };
  }, [imageUrl]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  };

  const handleConfirm = () => {
    const region: UnscaledRegion = {
      x: 0,
      y: 0,
      width: naturalDimensions.width,
      height: naturalDimensions.height,
      scaleMultiplier,
      preserveGeometry,
      surfaceType: analysis?.surfaceType,
      recommendedEngine: analysis?.recommendedEngine,
    };
    onApplyEnlarge(region);
  };

  return (
    <div className="enlarge-tool-container" ref={containerRef} style={{ direction: isArabic ? 'rtl' : 'ltr' }}>
      {/* Floating Control Bar */}
      <div className="enlarge-tool-toolbar">
        <div className="enlarge-tool-title">
          <Maximize2 size={15} className="text-rose-400" />
          <span>{isArabic ? 'التكبير الذكي (Smart Architectural Enlarge)' : 'Smart Architectural Enlarge'}</span>
        </div>

        {/* Semantic Surface Badge */}
        {analysis && (
          <div className="semantic-surface-badge">
            <Cpu size={13} className="text-rose-400" />
            <span>{isArabic ? analysis.labelAr : analysis.label}</span>
          </div>
        )}

        {/* Preserve Geometry Toggle */}
        <button
          type="button"
          className={`preserve-geo-toggle ${preserveGeometry ? 'active' : ''}`}
          onClick={() => setPreserveGeometry(prev => !prev)}
          title="Locks architectural line segments and contours during upscale"
        >
          <Shield size={14} />
          <span>{isArabic ? 'حماية الخطوط الإنشائية (Preserve Geometry)' : 'Preserve Geometry'}</span>
        </button>

        <div className="enlarge-scale-selector">
          <span className="scale-label">{isArabic ? 'النسبة:' : 'Scale:'}</span>
          <button 
            type="button" 
            className={`scale-btn ${scaleMultiplier === 2.0 ? 'active' : ''}`}
            onClick={() => setScaleMultiplier(2.0)}
          >
            2x
          </button>
          <button 
            type="button" 
            className={`scale-btn ${scaleMultiplier === 4.0 ? 'active' : ''}`}
            onClick={() => setScaleMultiplier(4.0)}
          >
            4x
          </button>
        </div>

        <div className="enlarge-actions-group">
          <button type="button" className="enlarge-cancel-btn" onClick={onCancel} title="Cancel">
            <X size={15} />
          </button>
          <button type="button" className="enlarge-apply-btn" onClick={handleConfirm} disabled={isAnalyzing}>
            <Sparkles size={15} />
            <span>{isArabic ? 'توليد المجموعات (Ghost Set)' : `Enlarge (${scaleMultiplier}x)`}</span>
          </button>
        </div>
      </div>

      {/* Recommended Engine Bar */}
      {analysis && (
        <div className="recommended-engine-banner">
          <Activity size={13} className="text-rose-400" />
          <span>{isArabic ? 'المحرك المقترح تلقائياً للخامة المحددة:' : 'Auto-suggested surface engine:'}</span>
          <span className="engine-name-chip">{analysis.recommendedEngineName}</span>
        </div>
      )}

      {/* Surface Preview */}
      <div className="enlarge-tool-surface">
        <img 
          ref={imageRef}
          src={imageUrl} 
          alt="Enlarge Target"
          className="enlarge-target-image"
          onLoad={handleImageLoad}
        />

        {/* Preserve Geometry Structural Line Overlay */}
        {preserveGeometry && edgeDataUrl && (
          <img 
            src={edgeDataUrl} 
            alt="Geometry Line Segment Map" 
            className="enlarge-edge-overlay"
          />
        )}

        <div className="enlarge-bounding-overlay">
          <div className="enlarge-bounding-box">
            <span className="bounding-badge">{naturalDimensions.width} × {naturalDimensions.height} px</span>
          </div>
        </div>
      </div>
    </div>
  );
};
