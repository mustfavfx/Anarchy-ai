import React from 'react';
import { Shield, X, ExternalLink, Lock, FileText, History } from 'lucide-react';
import { APP_INFO } from '../../config/appInfo';

interface ModalProps {
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<ModalProps> = ({ onClose }) => {
  return (
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
          <div className="privacy-section">
            <h3><Lock size={16} /> Privacy Policy</h3>
            <p><strong>{APP_INFO.name}</strong> is designed with privacy in mind. All your data stays on your device.</p>
            
            <h4>Local Data (Stored on Your Device Only)</h4>
            <ul>
              <li><strong>App Settings:</strong> Theme, language, notifications</li>
              <li><strong>Project Data:</strong> Your projects and workflows</li>
              <li><strong>History:</strong> Generation history</li>
              <li><strong>Library:</strong> Your saved assets</li>
            </ul>
            <p className="privacy-highlight">Important: All data is stored locally. We do not store your data on any external servers.</p>

            <h4>AI Processing</h4>
            <ul>
              <li><strong>AI Generation:</strong> Prompts and reference images sent to secure cloud services for processing</li>
              <li><strong>API Token:</strong> Stored securely in your operating system's credentials manager</li>
            </ul>

            <h4>Your Rights</h4>
            <div className="privacy-rights">
              <span>✅ Export all data</span>
              <span>✅ Delete all data</span>
              <span>✅ Transfer to another device</span>
              <span>✅ Use offline</span>
            </div>
          </div>

          <div className="privacy-section">
            <h3><FileText size={16} /> Terms of Use</h3>
            <p>By using {APP_INFO.name}, you agree to these terms.</p>
            
            <h4>License</h4>
            <div className="privacy-license">
              <p>✅ <strong>Personal Use:</strong> Free for personal and professional work</p>
              <p>✅ <strong>Commercial Use:</strong> Allowed for client projects</p>
              <p>❌ <strong>Redistribution:</strong> Do not redistribute the application</p>
              <p>❌ <strong>Reverse Engineering:</strong> Do not modify or reverse engineer</p>
            </div>

            <h4>User Responsibilities</h4>
            <ul>
              <li>Maintain your own AI service account</li>
              <li>Ensure content complies with local laws</li>
              <li>Respect intellectual property rights</li>
              <li>Keep API tokens secure</li>
            </ul>
          </div>

          <div className="privacy-section">
            <h3>📧 Contact</h3>
            <div className="privacy-contact-links">
              <a href={APP_INFO.links.instagram} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} /> Instagram
              </a>
              <a href={APP_INFO.links.website} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} /> Website
              </a>
              <a href={APP_INFO.links.telegram} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={14} /> Telegram
              </a>
            </div>
          </div>

          <div className="privacy-footer-text">
            <p>🔒 Your data stays on your device</p>
            <p>🎨 Use for any architectural project</p>
            <p>Last updated: April 27, 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export const DocumentationModal: React.FC<ModalProps> = ({ onClose }) => {
  return (
    <div className="privacy-modal-overlay" onClick={onClose}>
      <div className="privacy-modal" onClick={(e) => e.stopPropagation()}>
        <div className="privacy-modal-header">
          <div className="privacy-modal-title">
            <FileText size={24} />
            <h2>Documentation</h2>
          </div>
          <button className="privacy-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="privacy-modal-content">
          <div className="privacy-section">
            <h3>🚀 Getting Started</h3>
            <p>{APP_INFO.name} is an AI-powered architectural visualization tool designed for architects and designers.</p>
          </div>

          <div className="privacy-section">
            <h3>📋 Key Features</h3>
            <ul className="privacy-list">
              <li><strong>AI Image Generation:</strong> Generate architectural renders using Replicate AI models</li>
              <li><strong>Workflow Builder:</strong> Create node-based workflows for complex operations</li>
              <li><strong>Batch Processing:</strong> Process multiple images with different settings</li>
              <li><strong>Upscale Models:</strong> Enhance image resolution with various upscalers</li>
              <li><strong>Compare Mode:</strong> Side-by-side comparison of different generations</li>
            </ul>
          </div>

          <div className="privacy-section">
            <h3>🎨 Using the Builder</h3>
            <ul className="privacy-list">
              <li>Drag to pan the canvas</li>
              <li>Scroll to zoom in/out</li>
              <li>Double-click empty space to add nodes</li>
              <li>Connect nodes by dragging from output to input</li>
              <li>Select nodes to view and edit their settings</li>
            </ul>
          </div>

          <div className="privacy-section">
            <h3>⌨️ Keyboard Shortcuts</h3>
            <ul className="privacy-list">
              <li><strong>Ctrl+S:</strong> Save workflow</li>
              <li><strong>Ctrl+O:</strong> Open workflow</li>
              <li><strong>Delete:</strong> Remove selected node</li>
              <li><strong>Space:</strong> Fit view to all nodes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ChangelogModal: React.FC<ModalProps> = ({ onClose }) => {
  return (
    <div className="privacy-modal-overlay" onClick={onClose}>
      <div className="privacy-modal" onClick={(e) => e.stopPropagation()}>
        <div className="privacy-modal-header">
          <div className="privacy-modal-title">
            <History size={24} />
            <h2>Changelog</h2>
          </div>
          <button className="privacy-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="privacy-modal-content">
          <div className="privacy-section">
            <h3>Version 0.1.121</h3>
            <ul className="privacy-list">
              <li>Added Replicate API integration for image generation</li>
              <li>Support for multiple AI models (nano-banana, flux, etc.)</li>
              <li>Implemented workflow builder with ReactFlow</li>
              <li>Added batch processing capabilities</li>
              <li>New upscale models support (Real-ESRGAN, Clarity)</li>
              <li>Improved canvas performance and smoothness</li>
              <li>Added swap view functionality for preview panel</li>
              <li>New settings page with version checker</li>
            </ul>
          </div>

          <div className="privacy-section">
            <h3>Version 0.1.0</h3>
            <ul className="privacy-list">
              <li>Initial release of {APP_INFO.name}</li>
              <li>Basic image generation features</li>
              <li>Simple workflow builder</li>
              <li>Project management system</li>
            </ul>
          </div>

          <div className="privacy-footer-text">
            <p>🔄 Stay updated for new features</p>
            <p>Last updated: April 27, 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
};
