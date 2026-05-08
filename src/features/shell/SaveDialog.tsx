import React, { useState } from 'react';
import { FileText, X, Save } from 'lucide-react';
import './SaveDialog.css';

interface SaveDialogProps {
  onSave: () => void;
  onDontSave: () => void;
  onCancel: () => void;
}

export const SaveDialog: React.FC<SaveDialogProps> = ({ 
  onSave, 
  onDontSave, 
  onCancel 
}) => {
  const [filename, setFilename] = useState('untitled.ana');

  const handleSaveClick = () => {
    // Here we would trigger the actual file save
    // For now, just call the callback
    onSave();
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
            <input 
              type="text" 
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="project.ana"
              autoFocus
            />
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
