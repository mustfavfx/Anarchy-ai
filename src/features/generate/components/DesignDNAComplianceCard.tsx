import React, { useState } from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, Building, Sparkles, SlidersHorizontal, Check } from 'lucide-react';
import type { ComplianceAuditReport } from '../../../services/agent/DesignDNAService';
import { useAIConfigStore } from '../../../stores/aiConfigStore';
import './DesignDNAComplianceCard.css';

interface DesignDNAComplianceCardProps {
  report: ComplianceAuditReport;
  onApplyDNA?: (signature: string) => void;
}

export const DesignDNAComplianceCard: React.FC<DesignDNAComplianceCardProps> = ({
  report,
  onApplyDNA,
}) => {
  const [applied, setApplied] = useState(false);

  const handleApplySignature = () => {
    const current = useAIConfigStore.getState().workspacePrompt || '';
    const newPrompt = current
      ? `${current}, ${report.dna.promptSignature}`
      : report.dna.promptSignature;
    useAIConfigStore.getState().setWorkspacePrompt(newPrompt);

    if (onApplyDNA) onApplyDNA(report.dna.promptSignature);
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  return (
    <div className="arch-dna-card">
      <div className="arch-dna-header">
        <div className="arch-dna-badge-group">
          <span className="arch-dna-badge">{report.dna.badge}</span>
          <span className="arch-dna-title">{report.dna.name}</span>
        </div>
        <div className={`arch-compliance-pill ${report.status}`}>
          <ShieldCheck size={14} />
          <span>{report.complianceScore}% Compliant</span>
        </div>
      </div>

      <div className="arch-dna-sub">{report.code.codeName}</div>

      {/* Metrics Row */}
      <div className="arch-dna-metrics-grid">
        <div className="arch-dna-metric-box">
          <span className="metric-lbl">Coverage</span>
          <span className="metric-val">{report.metrics.coveragePercent}%</span>
          <span className="metric-sub">Max {report.code.maxCoveragePercent}%</span>
        </div>
        <div className="arch-dna-metric-box">
          <span className="metric-lbl">Est. BUA</span>
          <span className="metric-val">{report.metrics.estimatedBUA} m²</span>
          <span className="metric-sub">Site: {report.metrics.siteAreaM2} m²</span>
        </div>
        <div className="arch-dna-metric-box">
          <span className="metric-lbl">Front Setback</span>
          <span className="metric-val">{report.metrics.frontSetbackM}m</span>
          <span className="metric-sub">Req: {report.code.frontSetbackMeters}m</span>
        </div>
        <div className="arch-dna-metric-box">
          <span className="metric-lbl">Side Setback</span>
          <span className="metric-val">{report.metrics.sideSetbackM}m</span>
          <span className="metric-sub">Req: {report.code.sideSetbackMeters}m</span>
        </div>
      </div>

      {/* Checks list */}
      <div className="arch-dna-checks">
        {report.checks.map((chk, idx) => (
          <div key={idx} className={`arch-check-item ${chk.passed ? 'passed' : 'warning'}`}>
            {chk.passed ? (
              <CheckCircle2 size={13} className="chk-icon passed" />
            ) : (
              <AlertTriangle size={13} className="chk-icon warning" />
            )}
            <div className="chk-content">
              <span className="chk-name">{chk.itemAr} <small className="chk-en">({chk.item})</small></span>
              <span className="chk-status">{chk.actual}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      <div className="arch-dna-recs">
        <span className="recs-title">AEC Code Recommendations:</span>
        <ul>
          {report.recommendations.map((rec, idx) => (
            <li key={idx}>{rec}</li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="arch-dna-actions">
        <button
          type="button"
          className="arch-dna-btn primary"
          onClick={handleApplySignature}
        >
          {applied ? <Check size={13} /> : <Sparkles size={13} />}
          <span>{applied ? 'DNA Applied!' : `Apply ${report.dna.nameAr} DNA to Prompt`}</span>
        </button>
      </div>
    </div>
  );
};
