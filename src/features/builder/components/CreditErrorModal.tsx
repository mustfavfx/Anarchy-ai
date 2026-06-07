import React from 'react';

interface CreditErrorModalProps {
  balance: number;
  needed: number;
  onClose: () => void;
}

export const CreditErrorModal: React.FC<CreditErrorModalProps> = ({
  balance,
  needed,
  onClose,
}) => {
  return (
    <dialog
      className="credit-error-overlay"
      open
      aria-label="Insufficient balance"
      aria-modal="true"
    >
      <div className="credit-error-modal">
        <h3>Insufficient balance</h3>
        <p>Available balance: {balance}</p>
        <p>Required balance: {needed}</p>
        <div className="credit-error-actions">
          <button type="button" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-add-credit"
            onClick={() => {
              onClose();
              globalThis.location.href = '/add-credit';
            }}
          >
            Add credit
          </button>
        </div>
      </div>
    </dialog>
  );
};
