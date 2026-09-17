import React, { useState } from 'react';
import { Compass, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { canvasBridge } from '../../../services/agent/CanvasBridgeService';
import { useAIConfigStore } from '../../../stores/aiConfigStore';
import { useNotificationStore } from '../../../stores/notificationStore';
import './AgentRefineButton.css';

interface AgentRefineButtonProps {
  prompt: string;
  onApplyPrompt: (newPrompt: string) => void;
  className?: string;
}

export const AgentRefineButton: React.FC<AgentRefineButtonProps> = ({
  prompt,
  onApplyPrompt,
  className = '',
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previousPrompt, setPreviousPrompt] = useState<string | null>(null);
  const selectedNode = useAIConfigStore((s) => s.selectedNode);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const hasNodeImage = !!(selectedNode?.image || selectedNode?.originalImage);

  const handleRefine = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    const originalText = prompt;

    try {
      addNotification({
        type: 'info',
        title: 'ArchVision Agent',
        message: hasNodeImage
          ? 'Analyzing canvas node visual composition & architecture...'
          : 'Synthesizing professional architectural prompt...',
        duration: 2500,
      });

      const { response, appliedToNode, nodeId } = await canvasBridge.optimizeActiveNodeWithAgent({
        userPrompt: prompt,
      });

      const enhanced = response?.data?.enhanced_prompt;
      if (enhanced) {
        setPreviousPrompt(originalText);
        onApplyPrompt(enhanced);

        addNotification({
          type: 'success',
          title: 'Design Synthesized',
          message: appliedToNode
            ? `Applied enhanced prompt to canvas node #${nodeId?.slice(0, 8)}.`
            : 'Applied enhanced architectural prompt to prompt bar.',
          duration: 4000,
        });
      } else {
        addNotification({
          type: 'info',
          title: 'ArchVision Agent',
          message: 'Agent completed analysis without changing prompt.',
          duration: 2500,
        });
      }
    } catch (err: any) {
      console.error('[AgentRefineButton] Agent optimization failed:', err);
      const isConnectionError = err?.message?.includes('fetch') || err?.message?.includes('NetworkError') || err?.message?.includes('Failed to fetch');
      addNotification({
        type: 'error',
        title: 'ArchVision Agent Offline',
        message: isConnectionError
          ? 'Agent backend at http://127.0.0.1:8000 is not reachable. Ensure E:\\Agent is running.'
          : (err?.message || 'Agent reasoning failed.'),
        duration: 5000,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUndo = () => {
    if (previousPrompt !== null) {
      onApplyPrompt(previousPrompt);
      if (selectedNode?.id) {
        canvasBridge.applyPromptToNode(selectedNode.id, previousPrompt);
      }
      setPreviousPrompt(null);
      addNotification({
        type: 'info',
        title: 'Prompt Reverted',
        message: 'Restored previous prompt.',
        duration: 2000,
      });
    }
  };

  const tooltipText = hasNodeImage
    ? 'ArchVision Multimodal Vision: Inspects node image & applies your prompt modifications'
    : 'ArchVision Agent: Synthesizes professional architectural prompt';

  return (
    <div className={`agent-refine-wrapper ${previousPrompt !== null ? 'has-undo' : ''} ${isAnalyzing ? 'analyzing' : ''} ${className}`}>
      <button
        type="button"
        className="agent-refine-btn"
        onClick={handleRefine}
        disabled={isAnalyzing}
        title={tooltipText}
      >
        {isAnalyzing ? (
          <Loader2 size={12} className="agent-refine-icon animate-spin" />
        ) : (
          <Compass size={12} className="agent-refine-icon" />
        )}
        <span className="agent-refine-label">
          {isAnalyzing ? '...' : (hasNodeImage ? 'Vision' : 'Refine')}
        </span>
        <span className="agent-refine-indicator" />
      </button>

      {previousPrompt !== null && !isAnalyzing && (
        <button
          type="button"
          className="agent-refine-undo-btn"
          onClick={handleUndo}
          title="Revert to previous prompt"
        >
          <RotateCcw size={11} />
        </button>
      )}
    </div>
  );
};
