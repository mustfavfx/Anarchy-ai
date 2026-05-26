import React, { useState } from 'react';
import { FileText, X, Save } from 'lucide-react';
import './SaveDialog.css';

interface SaveDialogProps {
  onSave: (filename: string) => void;
  onDontSave: () => void;
  onCancel: () => void;
}

export const SaveDialog: React.FC<SaveDialogProps> = ({ 
  onSave, 
  onDontSave, 
  onCancel 
}) => {
  const [filename, setFilename] = useState('untitled');

  const handleSaveClick = () => {
    const name = filename.trim().replace(/\.ana$/i, '') || 'untitled';
    onSave(name);
  };

  return (
    <div className="save-dialog-overlay" onClick={onCancel}>
      <div className="save-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="save-dialog-header">
          <FileText size={24} className="save-icon" />
          <h3>Save Project?</h3>
          <button className="close-btn" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        
        <div className="save-dialog-content">
          <p>Do you want to save changes to this project?</p>
          
          <div className="filename-input-group">
            <label>Filename:</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input 
                type="text" 
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveClick()}
                placeholder="project"
                autoFocus
                style={{ flex: 1 }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '12px', whiteSpace: 'nowrap' }}>.ana</span>
            </div>
          </div>
          
          <div className="file-type-info">
            <span className="file-extension">.ana</span>
            <span className="file-desc">Anarchy AI Project File</span>
          </div>
        </div>

        <div className="save-dialog-actions">
          <button className="btn-secondary" onClick={onDontSave}>
            Don't Save
          </button>
          <button className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSaveClick}>
            <Save size={16} />
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
