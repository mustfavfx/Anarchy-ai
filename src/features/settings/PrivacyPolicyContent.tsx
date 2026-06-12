import React from 'react';
import { FileText, Lock, Mail, ExternalLink } from 'lucide-react';
import { APP_INFO } from '../../config/appInfo';
import { invoke } from '@tauri-apps/api/core';

interface PrivacyPolicyContentProps {
  onEmailClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

export const PrivacyPolicyContent: React.FC<PrivacyPolicyContentProps> = ({ onEmailClick }) => {
  return (
    <>
      <div className="privacy-section">
        <h2><Lock size={20} /> Privacy Policy</h2>
        
        <h3>1.1 Overview</h3>
        <p>
          Anarchy AI is a privacy-first platform designed for architectural visualization and creative workflows. This policy explains how information is handled when using the platform.
        </p>

        <h3>1.2 Information We Collect</h3>
        
        <div className="info-box local-data">
          <h4>📁 Local Data (Stored on User Device)</h4>
          <p>The following data remains stored locally under user control:</p>
          <ul>
            <li>Application settings and preferences</li>
            <li>Project files, workflows, and canvas data</li>
            <li>Generated images and assets</li>
            <li>History of actions and generations</li>
            <li>Library items and saved resources</li>
          </ul>
        </div>

        <div className="info-box api-usage">
          <h4>🔑 Account Information</h4>
          <p>When applicable, we may collect:</p>
          <ul>
            <li>Email address</li>
            <li>Authentication credentials</li>
            <li>Account status and usage records</li>
            <li>Subscription or access entitlements</li>
          </ul>
        </div>

        <div className="info-box api-usage" style={{ borderLeftColor: '#f43f5e' }}>
          <h4>🌐 Processing Data</h4>
          <p>To deliver core functionality, certain inputs may be processed through secure systems:</p>
          <ul>
            <li>Text prompts</li>
            <li>Uploaded reference images</li>
            <li>Model parameters and generation settings</li>
          </ul>
          <p>This processing is strictly required to execute user-requested features.</p>
        </div>

        <h3>1.3 External Service Providers</h3>
        <p>Anarchy AI may rely on trusted third-party infrastructure providers for:</p>
        <ul>
          <li>Authentication and account management</li>
          <li>AI computation and processing</li>
          <li>Temporary media handling for processing workflows</li>
          <li>System monitoring and updates</li>
        </ul>
        <p>All providers operate under standard security and confidentiality practices.</p>

        <h3>1.4 Use of Information</h3>
        <p>Collected information is used exclusively for:</p>
        <ul>
          <li>Providing AI-powered generation and tools</li>
          <li>Operating platform features</li>
          <li>Maintaining system stability and performance</li>
          <li>Improving user experience and functionality</li>
          <li>Preventing abuse and ensuring platform integrity</li>
        </ul>

        <h3>1.5 Data Security</h3>
        <p>Anarchy AI applies industry-standard security measures including:</p>
        <ul>
          <li>Encrypted data transmission</li>
          <li>Controlled system access</li>
          <li>Secure cloud infrastructure</li>
          <li>Local-first storage for user projects whenever possible</li>
        </ul>
        <p>No system can guarantee absolute security.</p>

        <h3>1.6 AI Training Policy</h3>
        <p>User content, prompts, and generated outputs are not used to train AI models without explicit consent.</p>

        <h3>1.7 Ownership of Data</h3>
        <ul>
          <li>Users retain full ownership of all projects, designs, and generated outputs.</li>
          <li>Anarchy AI does not claim ownership over user content.</li>
          <li>Content is processed solely to deliver requested functionality.</li>
        </ul>

        <h3>1.8 Architectural Confidentiality</h3>
        <p>Anarchy AI acknowledges the sensitive nature of architectural work:</p>
        <ul>
          <li>Projects remain private to the user</li>
          <li>Content is not accessed for non-functional purposes</li>
          <li>Confidentiality is a core operational principle</li>
        </ul>

        <h3>1.9 Age Requirement</h3>
        <p>Anarchy AI is intended for users aged <strong>19 years and above</strong>.</p>

        <h3>1.10 Changes to Policy</h3>
        <p>This Privacy Policy may be updated at any time. Continued use of the platform constitutes acceptance of updates.</p>
      </div>

      <div className="privacy-section" style={{ marginTop: '24px' }}>
        <h2><FileText size={20} /> Terms of Use</h2>

        <h3>2.1 Acceptance</h3>
        <p>By using Anarchy AI, you agree to these Terms of Use. If you do not agree, you must discontinue use immediately.</p>

        <h3>2.2 Platform Nature</h3>
        <p>Anarchy AI is a software platform for architectural and creative workflows, including AI-assisted visualization, design exploration, and automation tools.</p>
        <p>It is not a substitute for licensed professional services.</p>

        <h3>2.3 Permitted Use</h3>
        <div className="license-grid">
          <div className="license-yes">✅ Architectural design and visualization</div>
          <div className="license-yes">✅ Commercial and client projects</div>
          <div className="license-yes">✅ Personal creative work</div>
          <div className="license-yes">✅ Educational and research purposes</div>
        </div>

        <h3>2.4 Prohibited Use</h3>
        <p>Users must not:</p>
        <div className="license-grid">
          <div className="license-no">❌ Use the platform for illegal or harmful purposes</div>
          <div className="license-no">❌ Attempt to extract, replicate, or reverse engineer system behavior or models</div>
          <div className="license-no">❌ Circumvent system limitations or security measures</div>
          <div className="license-no">❌ Use automated systems to abuse or overload the platform</div>
          <div className="license-no">❌ Violate intellectual property rights of others</div>
          <div className="license-no">❌ Use outputs for fraudulent or deceptive activities</div>
        </div>

        <h3>2.5 AI-Generated Content</h3>
        <ul>
          <li>Outputs are generated using artificial intelligence systems</li>
          <li>Results may be inaccurate or non-deterministic</li>
          <li>Users are responsible for reviewing outputs before use</li>
          <li>Outputs should not be treated as certified engineering or construction data</li>
        </ul>

        <h3>2.6 Professional Disclaimer</h3>
        <div className="info-box disclaimer-box">
          <h4>⚠️ Assistive Tool Only</h4>
          <p>Anarchy AI is an assistive tool only. It does NOT provide:</p>
          <ul>
            <li>Structural engineering validation</li>
            <li>Building code compliance</li>
            <li>Certified architectural approval</li>
            <li>Safety verification</li>
          </ul>
          <p>All outputs must be reviewed by qualified professionals before implementation.</p>
        </div>

        <h3>2.7 Economic Model</h3>
        <p>Certain features may operate under:</p>
        <ul>
          <li>Credit-based usage</li>
          <li>Subscription access</li>
          <li>Usage-based limitations</li>
        </ul>
        <p>System rules and pricing may evolve over time based on platform requirements.</p>

        <h3>2.8 Intellectual Property</h3>
        <ul>
          <li>Users retain ownership of all content they create</li>
          <li>The platform retains ownership of software, branding, and system architecture</li>
          <li>Users are responsible for ensuring their inputs do not infringe third-party rights</li>
        </ul>

        <h3>2.9 Anti-System Abuse</h3>
        <p>Users must not:</p>
        <ul>
          <li>Extract system behavior or underlying models</li>
          <li>Conduct large-scale automated interaction for analysis or replication</li>
          <li>Attempt to build competing systems using platform outputs</li>
        </ul>

        <h3>2.10 Service Availability</h3>
        <p>Anarchy AI does not guarantee uninterrupted service availability. Features may depend on external infrastructure and may be modified or discontinued.</p>

        <h3>2.11 Limitation of Liability</h3>
        <p>To the maximum extent permitted by law:</p>
        <ul>
          <li>The platform is provided “as is”</li>
          <li>No guarantees are made regarding accuracy, reliability, or suitability of outputs</li>
          <li>The platform is not liable for direct or indirect damages including financial loss, project failure, or business interruption</li>
          <li>Total liability, if any, is limited to the amount paid for services within the last 12 months (if applicable)</li>
        </ul>

        <h3>2.12 Indemnification</h3>
        <p>Users agree to indemnify and hold harmless Anarchy AI from any claims arising from misuse of the platform or violation of these Terms.</p>

        <h3>2.13 Suspension and Termination</h3>
        <p>Access may be suspended or terminated in cases of:</p>
        <ul>
          <li>Abuse of the platform</li>
          <li>Illegal activity</li>
          <li>Security violations</li>
          <li>Breach of these Terms</li>
        </ul>

        <h3>2.14 Governing Law</h3>
        <p>These Terms are governed by applicable laws and regulations of the jurisdiction in which the platform operates.</p>

        <h3>2.15 Entire Agreement</h3>
        <p>These Terms and the Privacy Policy represent the entire agreement between the user and Anarchy AI.</p>

        <h3>2.16 Reservation of Rights</h3>
        <p>All rights not expressly granted are reserved by Anarchy AI.</p>
      </div>

      <div className="privacy-section summary-box" style={{ marginTop: '24px' }}>
        <h2>🔒 Summary</h2>
        <p>🔒 Users fully own their projects and outputs</p>
        <p>🌐 Data is processed only to provide functionality</p>
        <p>🤖 AI outputs are assistive, not professional certification</p>
        <p>⚡ System abuse and model extraction are prohibited</p>
        <p>💳 Platform may evolve with credits and subscriptions</p>
        <p>⚖️ Liability is legally limited</p>
        <p>🛡️ Privacy-first architecture is enforced</p>
      </div>

      <div className="privacy-section contact-section" style={{ marginTop: '24px', textAlign: 'center' }}>
        <h3 style={{ justifyContent: 'center', borderBottom: 'none', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          📧 Contact
        </h3>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
          <a href={APP_INFO.links.instagram} onClick={(e) => { e.preventDefault(); invoke('open_url', { url: APP_INFO.links.instagram }).catch(() => {}); }} target="_blank" rel="noopener noreferrer" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            background: 'rgba(225, 29, 72, 0.15)',
            border: '1px solid rgba(225, 29, 72, 0.3)',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: 500,
            color: '#f472b6',
            textDecoration: 'none',
            transition: 'all 0.15s'
          }}>
            <ExternalLink size={14} /> Instagram
          </a>
          <a href={APP_INFO.links.website} onClick={(e) => { e.preventDefault(); invoke('open_url', { url: APP_INFO.links.website }).catch(() => {}); }} target="_blank" rel="noopener noreferrer" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            background: 'rgba(225, 29, 72, 0.15)',
            border: '1px solid rgba(225, 29, 72, 0.3)',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: 500,
            color: '#f472b6',
            textDecoration: 'none',
            transition: 'all 0.15s'
          }}>
            <ExternalLink size={14} /> Website
          </a>
          <a href={APP_INFO.links.telegram} onClick={(e) => { e.preventDefault(); invoke('open_url', { url: APP_INFO.links.telegram }).catch(() => {}); }} target="_blank" rel="noopener noreferrer" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            background: 'rgba(225, 29, 72, 0.15)',
            border: '1px solid rgba(225, 29, 72, 0.3)',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: 500,
            color: '#f472b6',
            textDecoration: 'none',
            transition: 'all 0.15s'
          }}>
            <ExternalLink size={14} /> Telegram
          </a>
          <a href={APP_INFO.links.support} onClick={onEmailClick} rel="noopener noreferrer" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            background: 'rgba(225, 29, 72, 0.15)',
            border: '1px solid rgba(225, 29, 72, 0.3)',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: 500,
            color: '#f472b6',
            textDecoration: 'none',
            transition: 'all 0.15s'
          }}>
            <Mail size={14} /> Email
          </a>
        </div>
      </div>
    </>
  );
};
