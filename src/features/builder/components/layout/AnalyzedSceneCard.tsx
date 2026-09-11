import React, { useState } from 'react';
import { Layers, Loader2, Trash2 } from 'lucide-react';
import { useResolvedImage } from '../../../../hooks';

export interface AnalyzedSceneCardProps {
  scene: any;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export const AnalyzedSceneCard: React.FC<AnalyzedSceneCardProps> = ({
  scene,
  isActive,
  onSelect,
  onDelete,
}) => {
  const resolvedUrl = useResolvedImage(scene.url);
  const displaySrc = resolvedUrl || (
    scene.url && typeof scene.url === 'string' && (scene.url.startsWith('http') || scene.url.startsWith('data:') || scene.url.startsWith('blob:'))
      ? scene.url
      : null
  );
  const [imgError, setImgError] = useState(false);

  const regionCount = scene.regionCount || scene.layout?.regions?.length || 0;
  const sceneTitle = scene.prompt && !scene.prompt.includes('Scene') && scene.prompt.length > 2
    ? scene.prompt
    : `Analyzed Scene (${regionCount} objects)`;

  return (
    <div
      className={`scene-card-item ${isActive ? 'active-scene' : ''}`}
      onClick={onSelect}
    >
      <div className="scene-thumb-wrapper">
        {displaySrc && !imgError ? (
          <img
            src={displaySrc}
            alt={sceneTitle}
            className="scene-thumb-img"
            onError={() => setImgError(true)}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', color: '#f43f5e' }}>
            {imgError ? <Layers size={18} /> : <Loader2 size={16} className="animate-spin" />}
          </div>
        )}
        <span className="scene-objects-badge">
          <Layers size={9} />
          {regionCount} Objects
        </span>
      </div>
      <div className="scene-details">
        <div className="scene-name" title={sceneTitle}>{sceneTitle}</div>
        <div className="scene-meta">
          <span className="scene-status-tag">Analyzed</span>
          {scene.timestamp && (
            <span className="scene-time">
              {new Date(scene.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        className="delete-scene-btn"
        title="Delete scene from library"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
};
