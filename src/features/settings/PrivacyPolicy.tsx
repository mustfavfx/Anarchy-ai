import React from 'react';
import { Shield, FileText, Lock, Database, ExternalLink, AlertTriangle, CreditCard } from 'lucide-react';
import './PrivacyPolicy.css';

export const PrivacyPolicy: React.FC = () => {
  return (
    <div className="privacy-policy-page">
      <div className="privacy-header">
        <Shield size={48} className="privacy-icon" />
        <h1>Privacy Policy & Terms of Use</h1>
        <p className="privacy-subtitle">Anarchy AI - AI-Powered Architectural Visualization</p>
        <p className="privacy-date">Effective Date: April 27, 2026</p>
      </div>

      <div className="privacy-content">
        <section className="privacy-section">
          <h2><Lock size={20} /> Privacy Policy</h2>
          
          <h3>1. Information We Collect</h3>
          <p><strong>Anarchy AI</strong> is designed with privacy in mind. We collect minimal data:</p>
          
          <div className="info-box local-data">
            <h4>📁 Local Data (Stored on Your Device)</h4>
            <ul>
              <li><strong>App Settings:</strong> Theme preferences, language, API key, notification settings</li>
              <li><strong>Project Data:</strong> Your architectural projects, workflows, and generated images</li>
              <li><strong>History:</strong> Generation history stored in localStorage and IndexedDB</li>
              <li><strong>Library:</strong> Your saved assets and images</li>
            </ul>
          </div>

          <div className="info-box api-usage">
            <h4>🌐 External Services Used</h4>
            <p>Anarchy AI connects to the following third-party services to deliver its features:</p>
            <ul>
              <li><strong>Supabase</strong> — Authentication, user accounts, credit balance, and usage analytics</li>
              <li><strong>Replicate API</strong> — AI image generation: your prompts and reference images are sent to Replicate's servers for processing</li>
              <li><strong>Image Hosting (0x0.st / catbox.moe)</strong> — Reference images may be temporarily uploaded to these services to be accessible by the AI model</li>
              <li><strong>GitHub</strong> — Automatic update checks fetch release metadata from GitHub</li>
            </ul>
            <p className="highlight">Note: Your API key is stored locally on your device. We never store your API key on our servers.</p>
          </div>

          <h3>2. How We Use Your Information</h3>
          <ul>
            <li><strong>Local Storage:</strong> To save your preferences and projects</li>
            <li><strong>Image Generation:</strong> To process your architectural visualization requests</li>
            <li><strong>App Functionality:</strong> To provide the core features of the application</li>
          </ul>

          <h3>3. Data Handling & Privacy</h3>
          <div className="info-box privacy-box">
            <h4>🏛️ Architectural Design Privacy</h4>
            <p>We understand the sensitive nature of architectural work. Here is exactly what leaves your device:</p>
            <ul>
              <li>Text prompts and model parameters are sent to <strong>Replicate API</strong> for AI processing</li>
              <li>Reference images you attach are temporarily uploaded to image hosting services to be processed by AI models</li>
              <li>Account credentials and credit balance are managed by <strong>Supabase</strong></li>
              <li>Anonymous usage events (model used, generation count) may be logged to Supabase for product improvement</li>
              <li>Project workflows, canvas data, and generated images are stored <strong>locally on your device only</strong></li>
            </ul>
          </div>

          <h3>4. Data Security</h3>
          <ul>
            <li>✅ Project workflows and generated images remain <strong>on your device</strong></li>
            <li>✅ Your Replicate API key is stored locally and never sent to our servers</li>
            <li>✅ All API communications use HTTPS encryption</li>
            <li>✅ You can export/delete all local data anytime via Settings &gt; Storage</li>
            <li>✅ You can delete your account and all associated data from Settings &gt; Account</li>
          </ul>

          <h3>5. Payment Processing</h3>
          <div className="info-box payment-box">
            <h4><CreditCard size={16} /> Secure Payments via Areeba Iraq</h4>
            <p>All payment transactions are securely processed through <strong>Areeba Iraq</strong>, a licensed and regulated payment service provider in Iraq.</p>
            <ul>
              <li>PCI-DSS compliant payment processing</li>
              <li>Encrypted transaction data</li>
              <li>No credit card information is stored on our servers</li>
              <li>Local Iraqi payment support including: ZainCash, AsiaHawala, and FastPay</li>
            </ul>
          </div>


          <h3>4. Your Rights</h3>
          <p>You have complete control over your data:</p>
          <div className="rights-grid">
            <div className="right-item">✅ <strong>Export:</strong> Export all data as JSON</div>
            <div className="right-item">✅ <strong>Delete:</strong> Clear all data from Settings</div>
            <div className="right-item">✅ <strong>Transfer:</strong> Move data to another device</div>
            <div className="right-item">✅ <strong>Offline Use:</strong> Use without internet</div>
          </div>
        </section>

        <section className="privacy-section">
          <h2><FileText size={20} /> Terms of Use</h2>

          <h3>1. Acceptance of Terms</h3>
          <p>By using Anarchy AI, you agree to these Terms of Use.</p>

          <h3>2. License</h3>
          <p><strong>Anarchy AI</strong> is provided as-is for architectural visualization purposes.</p>
          <div className="license-grid">
            <div className="license-yes">✅ <strong>Personal Use:</strong> Free for personal and professional architectural work</div>
            <div className="license-yes">✅ <strong>Commercial Use:</strong> Allowed for client projects</div>
            <div className="license-no">❌ <strong>Redistribution:</strong> Do not redistribute the application</div>
            <div className="license-no">❌ <strong>Reverse Engineering:</strong> Do not modify or reverse engineer</div>
          </div>

          <h3>3. User Responsibilities</h3>
          <p>You are responsible for:</p>
          <ul>
            <li>Maintaining your own AI service account and usage limits</li>
            <li>Ensuring your generated content complies with local laws</li>
            <li>Respecting intellectual property rights of others</li>
            <li>Keeping your API tokens secure</li>
          </ul>

          <h3>4. AI-Generated Content</h3>
          <ul>
            <li>Generated images are created using AI models via secure cloud processing</li>
            <li>You retain rights to images you generate</li>
            <li>AI models may have their own usage policies</li>
            <li>Do not use for illegal, harmful, or deceptive purposes</li>
          </ul>

          <h3>5. Limitations</h3>
          <p><strong>Anarchy AI</strong> is provided without warranties:</p>
          <ul>
            <li>AI generation availability depends on cloud service status</li>
            <li>Generated image quality varies</li>
            <li>We are not liable for any damages from app usage</li>
          </ul>

          <h3><AlertTriangle size={18} /> 6. Important Disclaimer</h3>
          <div className="info-box disclaimer-box">
            <h4>⚠️ Professional Responsibility</h4>
            <p><strong>Anarchy AI</strong> is an AI-powered <strong>support tool</strong> designed to assist architects in their creative workflow. It is NOT a substitute for professional architectural judgment, engineering calculations, or code compliance verification.</p>
            <ul>
              <li><strong>AI Assistance Only:</strong> All AI-generated outputs must be reviewed and validated by a licensed architect or qualified professional</li>
              <li><strong>No Liability:</strong> We assume no responsibility for structural integrity, code compliance, or safety of designs created using this tool</li>
              <li><strong>Professional Verification:</strong> All architectural plans, calculations, and technical specifications must be verified by licensed professionals before construction</li>
              <li><strong>Intellectual Property:</strong> Users retain full rights to their designs; AI outputs should be treated as conceptual assistance</li>
            </ul>
            <p className="highlight">By using Anarchy AI, you acknowledge that you are solely responsible for all architectural decisions and professional compliance requirements.</p>
          </div>
        </section>

        <section className="privacy-section">
          <h2><Database size={20} /> Summary</h2>
          <div className="summary-box">
            <p>🔒 <strong>Projects &amp; images stay on your device</strong></p>
            <p>🌐 <strong>Prompts &amp; reference images go to Replicate API for AI processing</strong></p>
            <p>🔑 <strong>Your API key is stored locally only</strong></p>
            <p>🎨 <strong>Use for any architectural project</strong></p>
            <p>🚫 <strong>Don't redistribute the app</strong></p>
            <p>⚡ <strong>You control your AI service usage</strong></p>
          </div>
          <p className="thank-you">Thank you for using Anarchy AI!</p>
        </section>

        <section className="privacy-section contact-section">
          <h2>📧 Contact</h2>
          <p>For questions or concerns:</p>
          <p className="developer-name"><strong>Developer: Architect Mustafa Hisham</strong></p>
          <div className="contact-links">
            <a href="https://www.instagram.com/mustafa_hisham.1/" target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} /> Instagram
            </a>
            <a href="https://www.behance.net/Mustafa_VFX" target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} /> Behance
            </a>
            <a href="https://t.me/Mustafa_VFX" target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} /> Telegram
            </a>
          </div>
        </section>

        <footer className="privacy-footer">
          <p>Last updated: April 27, 2026</p>
          <p>© 2026 Anarchy AI. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
};
