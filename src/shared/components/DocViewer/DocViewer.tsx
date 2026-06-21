/**
 * DocViewer Component
 * Displays markdown documentation content securely using react-markdown
 */

import React from 'react';
import { ChevronLeft } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import './DocViewer.css';

interface DocViewerProps {
  title: string;
  content: string;
  onBack: () => void;
}

export const DocViewer: React.FC<DocViewerProps> = ({ title, content, onBack }) => {
  return (
    <div className="doc-viewer">
      <div className="doc-viewer-header">
        <button className="doc-viewer-back" onClick={onBack}>
          <ChevronLeft size={20} />
          Back to Documentation
        </button>
        <h2 className="doc-viewer-title">{title}</h2>
      </div>
      
      <div className="doc-viewer-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
};
