import React from 'react';
import { Loader2, Upload, Wand2 } from 'lucide-react';

interface NodeUploadPlaceholderProps {
  isSource: boolean;
  isPdfLoading: boolean;
}

export const NodeUploadPlaceholder: React.FC<NodeUploadPlaceholderProps> = ({
  isSource,
  isPdfLoading,
}) => {
  return (
    <div className="placeholder-content">
      {isSource ? (
        <>
          <div className="upload-icon-wrap">
            {isPdfLoading ? <Loader2 size={22} className="spin" /> : <Upload size={22} />}
          </div>
          <div className="upload-text-group">
            <span className="upload-primary">
              {isPdfLoading ? 'Converting PDF...' : 'Drop or click to upload'}
            </span>
            <span className="upload-secondary">Images or PDF files</span>
          </div>
        </>
      ) : (
        <div className="render-placeholder">
          <div className="rp-icon"><Wand2 size={20} /></div>
          <span className="rp-text">Result will appear here</span>
        </div>
      )}
    </div>
  );
};
