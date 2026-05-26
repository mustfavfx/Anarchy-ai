/**
 * DocViewer Component
 * Displays markdown documentation content
 */

import React from 'react';
import { ChevronLeft } from 'lucide-react';
import './DocViewer.css';

interface DocViewerProps {
  title: string;
  content: string;
  onBack: () => void;
}

// Simple markdown parser for basic formatting
const parseMarkdown = (markdown: string): string => {
  return markdown
    // Headers
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Bold and Italic
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Lists
    .replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>')
    .replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>')
    // Line breaks
    .replace(/\n/g, '<br/>')
    // Tables (basic)
    .replace(/\|(.+)\|/g, '<tr><td>$1</td></tr>')
    // Horizontal rule
    .replace(/^---$/gim, '<hr/>');
};

export const DocViewer: React.FC<DocViewerProps> = ({ title, content, onBack }) => {
  const parsedContent = parseMarkdown(content);

  return (
    <div className="doc-viewer">
      <div className="doc-viewer-header">
        <button className="doc-viewer-back" onClick={onBack}>
          <ChevronLeft size={20} />
          Back to Documentation
        </button>
        <h2 className="doc-viewer-title">{title}</h2>
      </div>
      
      <div 
        className="doc-viewer-content"
        dangerouslySetInnerHTML={{ __html: parsedContent }}
      />
    </div>
  );
};
