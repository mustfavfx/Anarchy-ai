import React, { useState } from 'react';
import { Shield, ArrowLeft } from 'lucide-react';
import './PrivacyPolicy.css';
import { PrivacyPolicyContent } from './PrivacyPolicyContent';
import { SupportModal } from '../dashboard/SupportModal';

export const PrivacyPolicy: React.FC = () => {
  const [showSupport, setShowSupport] = useState(false);

  return (
    <>
      <div className="privacy-policy-page">
        <button className="privacy-back-btn" onClick={() => globalThis.history.back()}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="privacy-header">
          <Shield size={48} className="privacy-icon" />
          <h1>Privacy Policy & Terms of Use</h1>
          <p className="privacy-subtitle">Anarchy AI - AI-Powered Architectural Visualization</p>
          <p className="privacy-date">Last Updated: April 27, 2026 | Version: 1.0</p>
        </div>

        <div className="privacy-content">
          <PrivacyPolicyContent onEmailClick={(e) => {
            e.preventDefault();
            setShowSupport(true);
          }} />


          <footer className="privacy-footer">
            <p>Last Updated: April 27, 2026</p>
            <p>Version: 1.0</p>
            <p>© 2026 Anarchy AI. All rights reserved.</p>
          </footer>
        </div>
      </div>
      {showSupport && (
        <SupportModal isOpen={showSupport} onClose={() => setShowSupport(false)} />
      )}
    </>
  );
};
