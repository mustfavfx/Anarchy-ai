import React from 'react';
import { RotateCcw, Sparkles, Coins } from 'lucide-react';
import { AutoPromptButton } from '../../../builder/components/AutoPromptButton';

export interface MaskPromptBarProps {
  prompt: string;
  onPromptChange: (newPrompt: string) => void;
  onGenerate: () => void | Promise<void>;
  isGenerating: boolean;
  cost: number;
  userCredits: number | null;
  isArabicUI?: boolean;
}

export const MaskPromptBar: React.FC<MaskPromptBarProps> = ({
  prompt,
  onPromptChange,
  onGenerate,
  isGenerating,
  cost,
  userCredits,
  isArabicUI = false,
}) => {
  return (
    <div className="vizmaker-bottom-prompt-bar-container">
      <div className="vizmaker-bottom-prompt-bar">
        <div className="vizmaker-prompt-inner-wrapper">
          <textarea
            className="vizmaker-prompt-textarea"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Describe what to generate inside the masked area..."
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void onGenerate();
              }
            }}
          />

          <AutoPromptButton
            prompt={prompt}
            onApplyPrompt={onPromptChange}
            mode="inpaint"
            compact={true}
            isArabicUI={isArabicUI}
          />

          <button
            type="button"
            className="vizmaker-reset-prompt-btn"
            onClick={() => onPromptChange('')}
            title="Reset prompt"
          >
            <RotateCcw size={13} />
          </button>
        </div>

        <div className="vizmaker-make-btn-group">
          <button
            type="button"
            className="vizmaker-make-btn"
            onClick={() => void onGenerate()}
            disabled={isGenerating}
            title="Generate AI Inpaint (Make)"
          >
            <Sparkles size={15} className={isGenerating ? 'spin' : ''} />
            <span>{isGenerating ? 'Generating...' : 'Make'}</span>
          </button>
        </div>
      </div>

      <div
        className="prompt-bottom-badges-container"
        style={{ marginTop: '8px', display: 'flex', gap: '8px', justifyContent: 'center' }}
      >
        <span className="generate-cost-badge" title="Credits required per generation">
          <Coins size={10} />
          Cost: {cost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </span>
        {userCredits !== null && (
          <span className="user-balance-badge" title="Your available credits">
            <Coins size={10} className="balance-icon" />
            Balance: {userCredits.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </span>
        )}
      </div>
    </div>
  );
};
