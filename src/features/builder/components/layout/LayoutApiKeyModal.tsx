import React from 'react';
import { Key, X } from 'lucide-react';

export interface LayoutApiKeyModalProps {
  showKeyModal: boolean;
  setShowKeyModal: (show: boolean) => void;
  inputKey: string;
  setInputKey: (key: string) => void;
  onSaveAndRetry: () => void;
}

export const LayoutApiKeyModal: React.FC<LayoutApiKeyModalProps> = ({
  showKeyModal,
  setShowKeyModal,
  inputKey,
  setInputKey,
  onSaveAndRetry,
}) => {
  if (!showKeyModal) return null;

  return (
    <div
      className="anarchy-modal-backdrop"
      onClick={() => setShowKeyModal(false)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}
    >
      <div
        className="anarchy-key-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '420px', maxWidth: '90vw', background: '#0f172a', border: '1px solid rgba(244,63,94,0.3)', borderRadius: '12px', padding: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#fff', fontSize: '15px' }}>
            <Key size={18} style={{ color: '#f43f5e' }} />
            <span>Anarchy AI API Key</span>
          </div>
          <button
            type="button"
            onClick={() => setShowKeyModal(false)}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '14px', lineHeight: 1.5 }}>
          Enter your Reve / Anarchy AI API Key (`papi...`) to enable interactive scene object extraction, outpainting, and mask editing.
        </p>

        <input
          type="password"
          placeholder="papi.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx..."
          value={inputKey}
          onChange={(e) => setInputKey(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '13px', fontFamily: 'monospace', outline: 'none' }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowKeyModal(false)}
            style={{ padding: '6px 14px', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSaveAndRetry}
            style={{ padding: '6px 16px', borderRadius: '6px', background: '#f43f5e', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
          >
            Save & Retry Scan
          </button>
        </div>
      </div>
    </div>
  );
};
