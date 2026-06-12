import React, { useState } from 'react';
import { Shield, X } from 'lucide-react';
import { PrivacyPolicyContent } from './PrivacyPolicyContent';
import { SupportModal } from '../dashboard/SupportModal';
import { ChangelogModal as DashboardChangelogModal } from '../dashboard/ChangelogModal';

interface ModalProps {
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<ModalProps> = ({ onClose }) => {
  const [showSupport, setShowSupport] = useState(false);

  return (
    <>
      <div className="privacy-modal-overlay" onClick={onClose}>
        <div className="privacy-modal" onClick={(e) => e.stopPropagation()}>
          <div className="privacy-modal-header">
            <div className="privacy-modal-title">
              <Shield size={24} />
              <h2>Privacy Policy & Terms of Use</h2>
            </div>
            <button className="privacy-modal-close" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
          <div className="privacy-modal-content">
            <PrivacyPolicyContent onEmailClick={(e) => {
              e.preventDefault();
              setShowSupport(true);
            }} />

            <div className="privacy-footer-text">
              <p>Last Updated: April 27, 2026</p>
              <p>Version: 1.0</p>
            </div>
          </div>
        </div>
      </div>
      {showSupport && (
        <SupportModal isOpen={showSupport} onClose={() => setShowSupport(false)} />
      )}
    </>
  );
};

export const ChangelogModal: React.FC<ModalProps> = ({ onClose }) => {
  return <DashboardChangelogModal isOpen={true} onClose={onClose} />;
};
