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
        
        <h3>1. Introduction</h3>
        <p>
          <strong>Anarchy AI</strong> is committed to protecting the privacy and confidentiality of its users. We understand the sensitive nature of architectural and creative work and strive to minimize data collection while providing secure and reliable AI-powered services.
        </p>
        <p>
          By using Anarchy AI, you acknowledge and agree to the practices described in this Privacy Policy.
        </p>

        <h3>2. Information We Collect</h3>
        <p>Anarchy AI follows a privacy-first approach and collects only the information necessary to provide core functionality.</p>
        
        <div className="info-box local-data">
          <h4>📁 Local Data Stored on Your Device</h4>
          <p>The following information is stored locally and remains under your control:</p>
          <ul>
            <li>Application settings and preferences</li>
            <li>Language and interface configuration</li>
            <li>Project workflows and canvas data</li>
            <li>Generation history</li>
            <li>Saved assets and image libraries</li>
            <li>User-created files and architectural references</li>
          </ul>
        </div>

        <div className="info-box api-usage">
          <h4>🔑 Account Information</h4>
          <p>When creating an account, certain information may be collected, including:</p>
          <ul>
            <li>Email address</li>
            <li>Authentication credentials</li>
            <li>Subscription or credit information</li>
            <li>Basic usage statistics required for service operation</li>
          </ul>
        </div>

        <div className="info-box api-usage" style={{ borderLeftColor: '#f43f5e' }}>
          <h4>🌐 AI Processing Data</h4>
          <p>To generate images and AI-assisted outputs, the following information may be transmitted to secure cloud infrastructure solely for providing requested services:</p>
          <ul>
            <li>Text prompts</li>
            <li>Model parameters</li>
            <li>Reference images uploaded by the user</li>
            <li>Generation settings required for processing</li>
          </ul>
        </div>

        <h3>3. External Services</h3>
        <p>Anarchy AI relies on trusted third-party providers to deliver certain features. These services may include:</p>
        <ul>
          <li>Authentication and account management providers</li>
          <li>Cloud-based AI inference services</li>
          <li>Temporary image hosting services used for model processing</li>
          <li>Infrastructure and analytics providers</li>
          <li>Update and release distribution services</li>
        </ul>
        <p>Third-party services operate under their own privacy policies and terms.</p>

        <h3>4. How We Use Information</h3>
        <p>Information may be used for:</p>
        <ul>
          <li>Delivering AI generation services</li>
          <li>Maintaining user accounts</li>
          <li>Providing subscriptions and credits</li>
          <li>Improving application stability and performance</li>
          <li>Diagnosing technical issues</li>
          <li>Preventing abuse and unauthorized access</li>
          <li>Enhancing future features and user experience</li>
        </ul>

        <h3>5. Architectural Project Confidentiality</h3>
        <div className="info-box privacy-box">
          <h4>🏛️ Confidentiality Core Principles</h4>
          <p>Anarchy AI recognizes that architectural projects often contain sensitive and proprietary information. Accordingly:</p>
          <ul>
            <li>Ownership of all projects, drawings, concepts, references, and generated content remains with the user.</li>
            <li>Anarchy AI does not claim ownership of user content.</li>
            <li>User content is processed exclusively for providing requested functionality.</li>
            <li>We do not intentionally access, review, sell, or disclose architectural materials except where required for service operation or by applicable law.</li>
            <li>Confidentiality remains a core principle of the platform.</li>
          </ul>
        </div>

        <h3>6. AI Training Policy</h3>
        <p>Anarchy AI does not intentionally use user projects, prompts, images, references, or generated outputs to train proprietary AI models without explicit user consent.</p>

        <h3>7. Data Security</h3>
        <p>Reasonable technical and organizational measures are implemented to protect user information. These include:</p>
        <ul>
          <li>✅ Encrypted communications using HTTPS</li>
          <li>✅ Industry-standard security measures</li>
          <li>✅ Access controls and authentication mechanisms</li>
          <li>✅ Protection against unauthorized access</li>
          <li>✅ Local storage of project files and generated assets whenever possible</li>
        </ul>
        <p>However, no method of electronic storage or transmission can guarantee absolute security.</p>

        <h3>8. Payments</h3>
        <p>Payment processing is handled through authorized payment providers. Financial information is processed securely by the respective providers. Anarchy AI does not store sensitive payment credentials on its own systems.</p>

        <h3>9. User Rights</h3>
        <p>Users maintain control over their information and may:</p>
        <div className="rights-grid">
          <div className="right-item">✅ Export their projects and files</div>
          <div className="right-item">✅ Transfer their work to another device</div>
          <div className="right-item">✅ Remove local data at any time</div>
          <div className="right-item">✅ Manage account information</div>
          <div className="right-item">✅ Use supported features according to service availability</div>
        </div>
      </div>

      <div className="privacy-section" style={{ marginTop: '24px' }}>
        <h2><FileText size={20} /> Terms of Use</h2>

        <h3>1. Acceptance of Terms</h3>
        <p>By accessing or using Anarchy AI, you agree to be bound by these Terms of Use. If you do not agree with these terms, you should discontinue use of the platform.</p>

        <h3>2. License</h3>
        <p>Anarchy AI is provided for architectural visualization and creative workflows.</p>
        <div className="license-grid">
          <div className="license-yes">✅ <strong>Permitted:</strong> Personal projects</div>
          <div className="license-yes">✅ <strong>Permitted:</strong> Professional architectural work</div>
          <div className="license-yes">✅ <strong>Permitted:</strong> Commercial client projects</div>
          <div className="license-yes">✅ <strong>Permitted:</strong> Educational purposes</div>
          <div className="license-no">❌ <strong>Prohibited:</strong> Unauthorized redistribution of the application</div>
          <div className="license-no">❌ <strong>Prohibited:</strong> Illegal or fraudulent activities</div>
          <div className="license-no">❌ <strong>Prohibited:</strong> Harmful, deceptive, or malicious content</div>
          <div className="license-no">❌ <strong>Prohibited:</strong> Violating intellectual property rights</div>
          <div className="license-no">❌ <strong>Prohibited:</strong> Attempting to interfere with platform security or operation</div>
        </div>

        <h3>3. User Responsibilities</h3>
        <p>Users are responsible for:</p>
        <ul>
          <li>Maintaining the confidentiality of their accounts</li>
          <li>Compliance with applicable laws and regulations</li>
          <li>Respecting third-party intellectual property rights</li>
          <li>Verifying the accuracy and suitability of generated outputs</li>
          <li>Reviewing all deliverables before professional or commercial use</li>
        </ul>

        <h3>4. AI-Generated Content</h3>
        <p>Anarchy AI utilizes artificial intelligence technologies that may produce inaccurate, incomplete, or unexpected results. Users acknowledge that:</p>
        <ul>
          <li>AI-generated outputs are intended as creative assistance tools.</li>
          <li>Results may vary in quality and accuracy.</li>
          <li>Generated outputs should be independently reviewed before implementation.</li>
          <li>AI systems are not substitutes for professional expertise.</li>
        </ul>

        <h3>5. Professional Disclaimer</h3>
        <div className="info-box disclaimer-box">
          <h4>⚠️ Professional Responsibility Disclaimer</h4>
          <p>Anarchy AI is intended solely as a support tool for architects, designers, and creative professionals. It is not a substitute for licensed architectural practice, structural engineering analysis, building code compliance, safety evaluations, technical calculations, or professional review or certification.</p>
          <p>All outputs generated by Anarchy AI must be independently verified by qualified professionals before construction or implementation. Users assume full responsibility for all architectural decisions, technical specifications, and regulatory compliance.</p>
        </div>

        <h3>6. Output Uniqueness</h3>
        <div className="info-box api-usage" style={{ borderLeftColor: '#f59e0b' }}>
          <h4>No Guarantee of Output Uniqueness</h4>
          <p>Due to the nature of artificial intelligence technologies, Anarchy AI does not guarantee that generated outputs will be unique or exclusive. Similar or identical results may be generated for other users or by other AI systems. Users are responsible for determining whether generated content meets their originality requirements.</p>
        </div>

        <h3>7. Experimental Features</h3>
        <p>Certain features may be marked as experimental, beta, or preview features. Such features are provided on an "as available" basis and may change, be discontinued, or contain errors without prior notice.</p>

        <h3>8. Acceptable Use</h3>
        <p>Users shall not use Anarchy AI to:</p>
        <ul>
          <li>Generate illegal content.</li>
          <li>Impersonate individuals.</li>
          <li>Produce misleading or fraudulent material.</li>
          <li>Violate intellectual property rights.</li>
          <li>Interfere with platform operations.</li>
          <li>Circumvent limitations or abuse the service.</li>
        </ul>

        <h3>9. Force Majeure</h3>
        <p>Anarchy AI shall not be liable for delays or failures caused by events beyond reasonable control, including: Internet outages, power failures, cyber attacks, government actions, natural disasters, or third-party service disruptions.</p>

        <h3>10. Suspension and Termination</h3>
        <p>Anarchy AI reserves the right to suspend or terminate access to the platform in cases of: abuse of services, illegal activity, violation of these Terms, or actions that threaten the integrity or security of the platform.</p>

        <h3>11. Data Backup Responsibility</h3>
        <p>Users are responsible for maintaining backups of important projects and files. While reasonable efforts are made to preserve data, Anarchy AI does not guarantee permanent availability or recovery of information.</p>

        <h3>12. Intellectual Property Rights</h3>
        <p>Users retain ownership of their designs and generated outputs. Anarchy AI retains ownership of software architecture, source code, branding, user interface elements, logos, and trademarks. Nothing in these Terms transfers ownership of the platform itself to users.</p>

        <h3>13. Service Availability</h3>
        <p>Although reasonable efforts are made to maintain reliable operation, Anarchy AI does not guarantee continuous availability, uninterrupted access, error-free performance, or permanent storage of cloud services. Service availability may depend on third-party infrastructure and external providers.</p>

        <h3>14. Limitation of Liability</h3>
        <p>To the maximum extent permitted by applicable law, Anarchy AI and its owners, developers, affiliates, and partners shall not be liable for direct, indirect, incidental, or consequential damages, financial losses, loss of business opportunities, loss of data, project delays, construction defects, or regulatory non-compliance. Users assume full responsibility for the use of the platform and all resulting decisions.</p>

        <h3>15. Indemnification</h3>
        <p>Users agree to indemnify and hold harmless Anarchy AI, its developers, owners, employees, and affiliates from any claims, liabilities, losses, damages, or expenses arising from misuse of the platform or violation of these Terms.</p>

        <h3>16. Governing Law</h3>
        <p>These Terms and all matters arising from the use of Anarchy AI shall be governed and interpreted in accordance with applicable laws and regulations.</p>

        <h3>17. Reservation of Rights</h3>
        <p>All rights not expressly granted under these Terms are reserved by Anarchy AI. Nothing contained in these Terms shall be interpreted as granting ownership, licenses, or rights beyond those expressly stated herein.</p>

        <h3>18. Entire Agreement</h3>
        <p>These Terms and the Privacy Policy constitute the entire agreement between users and Anarchy AI regarding the use of the platform and supersede any prior agreements, understandings, or communications relating thereto.</p>

        <h3>19. Changes to Terms</h3>
        <p>Anarchy AI reserves the right to modify these Terms of Use at any time. Updated versions become effective upon publication. Continued use of the platform constitutes acceptance of any revised Terms.</p>
      </div>

      <div className="privacy-section summary-box" style={{ marginTop: '24px' }}>
        <h2>🔒 Summary</h2>
        <p>🔒 Your projects remain yours.</p>
        <p>🏛️ Architectural concepts and generated assets belong to you.</p>
        <p>🌐 Data is processed only to provide requested services.</p>
        <p>🤖 AI outputs are intended for assistance, not professional replacement.</p>
        <p>⚡ Users remain responsible for reviewing and validating results.</p>
        <p>📁 Local project data remains under user control.</p>
        <p>🛡️ Security and confidentiality are core principles of Anarchy AI.</p>
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
