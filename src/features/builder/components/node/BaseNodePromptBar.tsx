import React from 'react';
import { Copy } from 'lucide-react';

interface BaseNodePromptBarProps {
  prompt?: string;
  copied: boolean;
  onCopyPrompt: (e: React.MouseEvent) => void;
}

export const BaseNodePromptBar: React.FC<BaseNodePromptBarProps> = ({
  prompt,
  copied,
  onCopyPrompt,
}) => {
  if (!prompt) return null;

  return (
    <div
      className="node-prompt-bar"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="node-prompt-content-wrap">
        <button
          type="button"
          className={`node-prompt-copy-btn ${copied ? 'copied' : ''}`}
          onClick={onCopyPrompt}
          title={copied ? "Copied!" : "Copy Prompt"}
        >
          <Copy size={10} />
        </button>
        <span
          className="node-prompt-text"
          style={{ userSelect: 'text', cursor: 'text' }}
          title={String(prompt)}
        >
          {prompt.length > 80 ? prompt.slice(0, 80) + '...' : prompt}
        </span>
      </div>
    </div>
  );
};
