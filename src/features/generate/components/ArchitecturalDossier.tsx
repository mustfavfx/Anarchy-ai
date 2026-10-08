import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Layers,
  ShieldCheck,
  Box,
  Maximize2,
  Download,
  CheckCheck,
  Compass,
  Copy,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  ExternalLink,
  Cpu,
  Terminal,
  Eye,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import type { ChatMessageData } from '../hooks/useAgentChat';
import { useAIConfigStore } from '../../../stores/aiConfigStore';
import { useNotificationStore } from '../../../stores/notificationStore';
import { canvasBridge } from '../../../services/agent/CanvasBridgeService';
import { EmbeddedModelViewer } from './EmbeddedModelViewer';

export type DossierTab = 'model3d' | 'cua' | 'visual' | 'program' | 'compliance' | 'engineering';

export const ArchitecturalDossier: React.FC<{
  data: ChatMessageData;
  messageId: string;
}> = ({ data }) => {
  // Determine default tab based on available assets
  const initialTab: DossierTab = useMemo(() => {
    if (data.bim_viewer_url) return 'model3d';
    if (data.cua_action_executed) return 'cua';
    if (data.rendered_image_url || data.enhanced_prompt) return 'visual';
    if (data.space_program) return 'program';
    if (data.compliance_report) return 'compliance';
    if (data.dxf_download_url) return 'engineering';
    return 'model3d';
  }, [data]);

  const [activeTab, setActiveTab] = useState<DossierTab>(initialTab);
  const [copied, setCopied] = useState(false);
  const [appliedToNode, setAppliedToNode] = useState(false);
  const activeNode = useAIConfigStore((s) => s.selectedNode);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleApplyToNode = (enhancedPrompt: string) => {
    if (activeNode?.id) {
      canvasBridge.applyPromptToNode(activeNode.id, enhancedPrompt);
      setAppliedToNode(true);
      setTimeout(() => setAppliedToNode(false), 2500);
      addNotification({
        type: 'success',
        title: 'Canvas Node Updated',
        message: `Applied enhanced prompt to canvas node #${activeNode.id.slice(0, 8)}.`,
        duration: 3500,
      });
    } else {
      useAIConfigStore.getState().setWorkspacePrompt(enhancedPrompt);
      setAppliedToNode(true);
      setTimeout(() => setAppliedToNode(false), 2500);
      addNotification({
        type: 'success',
        title: 'Prompt Bar Updated',
        message: 'Applied enhanced prompt to canvas prompt bar.',
        duration: 3000,
      });
    }
  };

  const hasVisual = !!(data.rendered_image_url || data.enhanced_prompt);
  const hasProgram = !!data.space_program;
  const hasCompliance = !!data.compliance_report;
  const hasEngineering = !!(data.dxf_download_url || data.bim_viewer_url);
  const hasCua = !!data.cua_action_executed;
  const has3dModel = !!(data.bim_viewer_url || data.cua_action_executed || data.space_program);

  // If no structured deliverables, do not render dossier
  if (!hasVisual && !hasProgram && !hasCompliance && !hasEngineering && !hasCua && !has3dModel) {
    return null;
  }

  return (
    <div className="dossier-card">
      {/* Segmented Tab Header */}
      <div className="dossier-tabs-nav">
        {has3dModel && (
          <button
            type="button"
            className={`dossier-tab-btn ${activeTab === 'model3d' ? 'active' : ''}`}
            onClick={() => setActiveTab('model3d')}
          >
            <Box size={12} className="tab-icon rose" />
            <span>3D WebGL Massing</span>
            <span className="tab-dot" />
          </button>
        )}

        {hasCua && (
          <button
            type="button"
            className={`dossier-tab-btn ${activeTab === 'cua' ? 'active' : ''}`}
            onClick={() => setActiveTab('cua')}
          >
            <Cpu size={12} className="tab-icon amber" />
            <span>3D Autonomous Execution</span>
            <span className="tab-dot amber" />
          </button>
        )}

        {hasVisual && (
          <button
            type="button"
            className={`dossier-tab-btn ${activeTab === 'visual' ? 'active' : ''}`}
            onClick={() => setActiveTab('visual')}
          >
            <Sparkles size={12} className="tab-icon rose" />
            <span>Visual & Prompt</span>
            {data.rendered_image_url && <span className="tab-dot" />}
          </button>
        )}

        {hasProgram && (
          <button
            type="button"
            className={`dossier-tab-btn ${activeTab === 'program' ? 'active' : ''}`}
            onClick={() => setActiveTab('program')}
          >
            <Layers size={12} className="tab-icon blue" />
            <span>Space Matrix</span>
          </button>
        )}

        {hasCompliance && (
          <button
            type="button"
            className={`dossier-tab-btn ${activeTab === 'compliance' ? 'active' : ''}`}
            onClick={() => setActiveTab('compliance')}
          >
            <ShieldCheck size={12} className="tab-icon green" />
            <span>Code Audit</span>
            <span className={`compliance-mini-pill ${data.is_compliant !== false ? 'pass' : 'warn'}`}>
              {data.is_compliant !== false ? 'Pass' : 'Review'}
            </span>
          </button>
        )}

        {hasEngineering && (
          <button
            type="button"
            className={`dossier-tab-btn ${activeTab === 'engineering' ? 'active' : ''}`}
            onClick={() => setActiveTab('engineering')}
          >
            <Box size={12} className="tab-icon purple" />
            <span>CAD & BIM</span>
            <span className="file-count-badge">2</span>
          </button>
        )}
      </div>

      {/* Dossier Body Panes */}
      <div className="dossier-body">
        {/* TAB: 3D WEBGL INTERACTIVE MODEL */}
        {activeTab === 'model3d' && has3dModel && (
          <div className="dossier-pane model3d-pane animate-fade-in">
            <EmbeddedModelViewer
              interactiveIframeUrl={data.bim_viewer_url}
              siteAreaSqm={data.bim_total_bua || 500}
              typology={data.cua_software || 'Residential Villa'}
              height={320}
            />
          </div>
        )}

        {/* TAB 0: CUA 3D AUTONOMOUS EXECUTION */}
        {activeTab === 'cua' && hasCua && (
          <div className="dossier-pane cua-pane animate-fade-in">
            <div className="cua-header-row">
              <div className="cua-title-wrap">
                <div className="cua-badge-status">
                  <span
                    className={`status-dot ${
                      data.cua_status === 'failed'
                        ? 'failed'
                        : data.cua_status === 'queued'
                        ? 'queued'
                        : 'active'
                    }`}
                  />
                  <span className="status-text">
                    {data.cua_status === 'failed'
                      ? 'Execution Notice (Failed)'
                      : data.cua_status === 'queued'
                      ? `Queued • Waiting for ${data.cua_software || '3ds Max'}`
                      : `Live Execution • ${data.cua_software || '3ds Max 2027'}`}
                  </span>
                </div>
                <h4 className="cua-action-headline">{data.cua_action_title || 'Autonomous 3D Spatial Modeling'}</h4>
              </div>
              <div className="cua-actions-toolbar">
                <button
                  type="button"
                  className="cua-btn-mini"
                  onClick={() => invoke('cua_focus_window', { titlePattern: data.cua_software || '3ds max' })}
                  title="Bring window to front"
                >
                  <Eye size={12} />
                  <span>Focus Window</span>
                </button>
                <button
                  type="button"
                  className="cua-btn-mini highlight"
                  onClick={() => invoke('cua_dispatch_autodesk_command', { software: data.cua_software || '3dsmax', action: 'viewport_sync', script: '' })}
                  title="Synchronize active viewport to Anarchy AI"
                >
                  <Sparkles size={12} />
                  <span>Sync Viewport</span>
                </button>
              </div>
            </div>

            {data.cua_script && (
              <div className="cua-code-block">
                <div className="cua-code-header">
                  <Terminal size={12} />
                  <span>MaxScript Dispatched to 3ds Max Engine (pymxs)</span>
                </div>
                <pre className="cua-code-pre">{data.cua_script}</pre>
              </div>
            )}

            {data.cua_output && (
              <div className="cua-output-line">
                <CheckCircle2 size={13} className="cua-check-icon" />
                <span>{data.cua_output}</span>
              </div>
            )}
          </div>
        )}

        {/* TAB 1: VISUAL & PROMPT */}
        {activeTab === 'visual' && hasVisual && (
          <div className="dossier-pane visual-pane">
            {data.rendered_image_url && (
              <div className="render-showcase-box">
                <div className="render-image-container">
                  <img
                    src={data.rendered_image_url}
                    alt="Synthesized Architectural Render"
                    className="render-image"
                  />
                  <div className="render-overlay-bar">
                    <a
                      href={data.rendered_image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="overlay-action-btn"
                      title="Open full-resolution image in new tab"
                    >
                      <Maximize2 size={12} />
                      <span>Full Resolution</span>
                    </a>
                    <a
                      href={data.rendered_image_url}
                      download="Architectural_Render.png"
                      className="overlay-action-btn"
                      title="Download render"
                    >
                      <Download size={12} />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              </div>
            )}

            {data.enhanced_prompt && (
              <div className="prompt-spec-box">
                <div className="prompt-spec-header">
                  <div className="spec-title-wrap">
                    <Sparkles size={12} className="rose" />
                    <span>Synthesized ArchViz Prompt</span>
                  </div>
                  <div className="prompt-header-actions">
                    <button
                      type="button"
                      className="apply-canvas-btn"
                      onClick={() => handleApplyToNode(data.enhanced_prompt!)}
                      title={activeNode?.id ? `Apply to active canvas node #${activeNode.id}` : 'Apply to canvas prompt bar'}
                    >
                      {appliedToNode ? (
                        <>
                          <CheckCheck size={12} />
                          <span>Applied</span>
                        </>
                      ) : (
                        <>
                          <Compass size={12} />
                          <span>{activeNode?.id ? `Apply to Node #${activeNode.id.slice(0, 6)}` : 'Apply to Canvas'}</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="copy-prompt-btn"
                      onClick={() => handleCopy(data.enhanced_prompt!)}
                    >
                      {copied ? (
                        <>
                          <CheckCheck size={12} />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy Prompt</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div className="prompt-code-wrap">
                  <code>{data.enhanced_prompt}</code>
                </div>
                {data.negative_prompt && (
                  <div className="negative-prompt-tag">
                    <span className="neg-label">Negative:</span>
                    <span className="neg-val">{data.negative_prompt}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SPACE PROGRAM */}
        {activeTab === 'program' && hasProgram && (
          <div className="dossier-pane program-pane">
            <div className="pane-header-row">
              <div className="pane-title-group">
                <Layers size={13} className="blue" />
                <h4>Spatial Zoning & Space Program Matrix</h4>
              </div>
              <span className="pane-subtitle">Calculated for site efficiency</span>
            </div>
            <div className="program-text-box mono-font">
              {data.space_program}
            </div>
          </div>
        )}

        {/* TAB 3: CODE COMPLIANCE AUDIT */}
        {activeTab === 'compliance' && hasCompliance && (
          <div className="dossier-pane compliance-pane">
            <div className="compliance-banner-row">
              <div className="compliance-status-block">
                {data.is_compliant !== false ? (
                  <div className="status-badge pass">
                    <CheckCircle2 size={13} />
                    <span>Compliant with Municipal Zoning Code</span>
                  </div>
                ) : (
                  <div className="status-badge warn">
                    <AlertTriangle size={13} />
                    <span>Requires Zoning Variance Review</span>
                  </div>
                )}
              </div>
              <span className="audit-jurisdiction">Standard Municipal Setbacks</span>
            </div>
            <div className="compliance-text-box mono-font">
              {data.compliance_report}
            </div>
          </div>
        )}

        {/* TAB 4: CAD & BIM EXPORTS */}
        {activeTab === 'engineering' && hasEngineering && (
          <div className="dossier-pane engineering-pane">
            <div className="engineering-grid">
              {data.dxf_download_url && (
                <div className="export-action-tile cad-tile">
                  <div className="tile-icon-bubble blue">
                    <FileCode size={20} />
                  </div>
                  <div className="tile-details">
                    <h5>{data.dxf_filename || 'Architectural_Plan.dxf'}</h5>
                    <p>AutoCAD 2D Floor Plan with Boundary & Municipal Setbacks</p>
                  </div>
                  <a
                    href={data.dxf_download_url}
                    download={data.dxf_filename || 'plan.dxf'}
                    className="tile-download-btn blue"
                  >
                    <Download size={13} />
                    <span>Download .DXF</span>
                  </a>
                </div>
              )}

              {data.bim_viewer_url && (
                <div className="export-action-tile bim-tile">
                  <div className="tile-icon-bubble purple">
                    <Box size={20} />
                  </div>
                  <div className="tile-details">
                    <h5>Speckle 3D BIM Model</h5>
                    <p>
                      {data.bim_elements_count ? `${data.bim_elements_count} Parametric elements` : 'Parametric elements'}
                      {data.bim_total_bua ? ` | BUA: ${data.bim_total_bua} m²` : ''}
                    </p>
                  </div>
                  <a
                    href={data.bim_viewer_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tile-download-btn purple"
                  >
                    <ExternalLink size={13} />
                    <span>Launch 3D Viewer</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
