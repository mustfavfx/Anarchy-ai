import React from 'react';
import { Sparkles } from 'lucide-react';
import './AgentRefineButton.css';

interface AgentRefineButtonProps {
  prompt?: string;
  onApplyPrompt?: (newPrompt: string) => void;
  onOpenCopilot?: () => void;
  className?: string;
}

export const AgentRefineButton: React.FC<AgentRefineButtonProps> = ({
  onOpenCopilot,
  className = '',
}) => {
  return (
    <button
      type="button"
      className={`agent-copilot-prompt-btn ${className}`}
      onClick={onOpenCopilot}
      title="AI Copilot"
    >
      <Sparkles size={15} className="copilot-icon" />
      <span className="copilot-indicator-dot" />
    </button>
  );
};

