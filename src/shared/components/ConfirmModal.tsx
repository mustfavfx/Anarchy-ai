import React from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import './ConfirmModal.css';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  const modalRef = useFocusTrap<HTMLDivElement>({
    isActive: true,
    onEscape: onCancel,
  });

  return (
    <div className="confirm-overlay" onClick={onCancel} aria-hidden="false">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
        tabIndex={-1}
        className="confirm-modal"
        onClick={e => e.stopPropagation()}
      >
        <div className="confirm-header">
          <span className={`confirm-icon ${danger ? 'danger' : ''}`} aria-hidden="true">
            {danger ? '⚠' : 'ℹ'}
          </span>
          <h3 id="confirm-modal-title" className="confirm-title">{title}</h3>
        </div>
        <p id="confirm-modal-desc" className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button type="button" className="confirm-btn cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={`confirm-btn ok ${danger ? 'danger' : ''}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

