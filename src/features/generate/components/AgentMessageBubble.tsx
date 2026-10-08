import React, { useState, useMemo } from 'react';
import {
  Bot,
  User,
  Copy,
  Check,
  Trash2,
  Terminal,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Clock,
  Sparkles,
  Cpu,
} from 'lucide-react';
import type { ChatMessage } from '../hooks/useAgentChat';
import { ArchitecturalDossier } from './ArchitecturalDossier';
import { DeepThinkingTrace } from './DeepThinkingTrace';
import { ArchitecturalMaterialPaletteCard } from './ArchitecturalMaterialPaletteCard';
import { DesignDNAComplianceCard } from './DesignDNAComplianceCard';
import { InteractiveFloorPlanViewer } from './InteractiveFloorPlanViewer';

interface AgentMessageBubbleProps {
  message: ChatMessage;
  onDeleteMessage?: (id: string) => void;
  onPreviewImage?: (url: string, title?: string) => void;
  onExecute3DModeling?: (software: '3dsmax' | 'blender') => void;
  selectedModelLabel?: string;
}

export const AgentMessageBubble: React.FC<AgentMessageBubbleProps> = ({
  message,
  onDeleteMessage,
  onPreviewImage,
  onExecute3DModeling,
  selectedModelLabel,
}) => {
  const [copied, setCopied] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const isUser = message.role === 'user';
  const data = message.data;

  // Separate technical execution lines (e.g., 3ds Max / CUA execution logs) from conversational message
  const { technicalLogs, cleanText } = useMemo(() => {
    if (isUser || !message.text) {
      return { technicalLogs: [], cleanText: message.text || '' };
    }

    const rawLines = message.text.split('\n');
    const logs: string[] = [];
    const regular: string[] = [];

    rawLines.forEach((line) => {
      const trimmed = line.trim();
      const isLogLine =
        trimmed.startsWith('create_box') ||
        trimmed.startsWith('setup_sun_lighting') ||
        trimmed.startsWith('Created architectural box') ||
        trimmed.startsWith('Positioned camera') ||
        trimmed.startsWith('Configured sun') ||
        trimmed.startsWith('Sent active 3ds Max viewport') ||
        trimmed.startsWith('[MaxScript]') ||
        trimmed.startsWith('[CUA]');

      if (isLogLine) {
        logs.push(trimmed);
      } else {
        regular.push(line);
      }
    });

    return {
      technicalLogs: logs,
      cleanText: regular.join('\n').trim(),
    };
  }, [message.text, isUser]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderFormattedText = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    return (
      <div className="formatted-chat-body" dir="auto">
        {lines.map((line, lIdx) => {
          if (!line.trim()) {
            return <div key={lIdx} className="chat-empty-line" />;
          }
          const parts = line.split(/(\*\*.*?\*\*)/g);
          return (
            <div key={lIdx} className="chat-text-line">
              {parts.map((part, pIdx) => {
                if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
                  return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
                }
                return part;
              })}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`pro-message-cluster ${isUser ? 'user-cluster' : 'assistant-cluster'}`}>
      <div className="pro-message-envelope">
        {/* Header Avatar & Identity */}
        <div className="pro-message-header">
          <div className="pro-message-author">
            <div className={`pro-avatar-badge ${isUser ? 'user-badge' : 'assistant-badge'}`}>
              {isUser ? <User size={13} /> : <Bot size={13} />}
            </div>
            <span className="pro-author-name">
              {isUser ? 'You (Architect)' : selectedModelLabel || 'ArchVision Resident'}
            </span>
            <span className="pro-message-time">
              <Clock size={10} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
              {formatTimestamp(message.timestamp)}
            </span>
          </div>

          {/* Action buttons (Copy, Delete) on hover */}
          <div className="pro-message-actions">
            <button
              type="button"
              className="pro-action-btn"
              onClick={handleCopy}
              title="Copy message"
            >
              {copied ? <Check size={12} className="check-green" /> : <Copy size={12} />}
            </button>
            {onDeleteMessage && (
              <button
                type="button"
                className="pro-action-btn delete-btn"
                onClick={() => onDeleteMessage(message.id)}
                title="Delete message"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Technical Execution Disclosure (if script actions were taken) */}
        {!isUser && technicalLogs.length > 0 && (
          <div className="technical-trace-card">
            <button
              type="button"
              className="technical-trace-header"
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            >
              <div className="trace-header-left">
                <Cpu size={13} className="trace-icon" />
                <span className="trace-title">3D Autonomous Script Actions</span>
                <span className="trace-status-pill">Active Execution</span>
              </div>
              <div className="trace-header-right">
                <span>{showTechnicalDetails ? 'Hide details' : 'Show details'}</span>
                {showTechnicalDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </div>
            </button>

            {showTechnicalDetails && (
              <div className="technical-trace-body">
                {technicalLogs.map((log, idx) => (
                  <div key={idx} className="trace-log-line">
                    <Terminal size={11} className="log-icon" />
                    <code>{log}</code>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Deep Architectural Chain-of-Thought & Reasoning Trace */}
        {!isUser && (
          <DeepThinkingTrace
            enhancedPrompt={data?.enhanced_prompt}
            scriptAction={data?.cua_script}
            siteAreaSqm={data?.bim_total_bua || 500}
            typology={data?.cua_software || 'Residential Villa'}
          />
        )}

        {/* Clean Conversational Message Body */}
        {cleanText && (
          <div className={`pro-message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
            {renderFormattedText(cleanText)}
          </div>
        )}

        {/* User Attached Image / Sketch Preview */}
        {isUser && data?.rendered_image_url && (
          <div className="pro-attached-image-card">
            <div
              className="attached-image-preview-wrapper"
              onClick={() => onPreviewImage && onPreviewImage(data.rendered_image_url!, 'Attached Sketch / Image')}
            >
              <img src={data.rendered_image_url} alt="Attached input" className="attached-img" />
              <div className="attached-image-hover-overlay">
                <Maximize2 size={16} />
                <span>Enlarge Image</span>
              </div>
            </div>
            <span className="attached-img-caption">Architectural Sketch / Reference Image</span>
          </div>
        )}

        {/* Interactive Architectural Floor Plan Viewer & DXF Exporter */}
        {!isUser && data && (data.interactive_floorplan || data.dxf_download_url) && (
          <InteractiveFloorPlanViewer
            buaM2={data.interactive_floorplan?.buaM2 || data.bim_total_bua || 286}
            floors={data.interactive_floorplan?.floors || 2}
            dxfUrl={data.dxf_download_url}
            dxfFilename={data.dxf_filename}
            onExecute3DModeling={onExecute3DModeling}
          />
        )}

        {/* Tectonic Architectural Material Palette Card */}
        {!isUser && data?.material_palette && (
          <ArchitecturalMaterialPaletteCard palette={data.material_palette} />
        )}

        {/* Local Building Code & Design DNA Compliance Card */}
        {!isUser && data?.compliance_audit && (
          <DesignDNAComplianceCard report={data.compliance_audit} />
        )}

        {/* Architectural Deliverables Dossier (Tabs) */}
        {!isUser && data && (
          <ArchitecturalDossier data={data} messageId={message.id} />
        )}
      </div>
    </div>
  );
};
