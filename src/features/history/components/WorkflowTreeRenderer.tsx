import React, { useState } from 'react';
import type { HistoryEntry } from '../types';
import { useLazyImage } from '../hooks/useLazyImage';
import { useHistoryStore } from '@/stores/historyStore';
import { 
  GitBranch, ZoomIn, ZoomOut, Maximize2, 
  Sparkles, Image as ImageIcon, Sliders 
} from 'lucide-react';
import './WorkflowTreeRenderer.css';

export interface HistoryTreeNode {
  id: string;
  entry: HistoryEntry;
  parentId?: string;
  nodeType: 'source' | 'variation' | 'upscale' | 'edit' | 'canvas';
  children: HistoryTreeNode[];
}

interface WorkflowTreeRendererProps {
  preview: HistoryEntry;
  onNodeSelect: (entry: HistoryEntry) => void;
  compareIds: string[];
  onCompareToggle: (id: string) => void;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

/**
 * Builds the workflow tree of entries starting from the root of the lineage.
 */
export function buildWorkflowTreeForEntry(preview: HistoryEntry, allEntries: HistoryEntry[]): { root: HistoryTreeNode; activePath: string[] } {
  // Find root ID
  let rootId = preview.rootId || preview.rootSourceId;
  
  // If not found, trace parentId upwards to find the true root
  if (!rootId) {
    let curr = preview;
    const visited = new Set<string>();
    while (curr.parentId && !visited.has(curr.parentId)) {
      visited.add(curr.parentId);
      const parent = allEntries.find(e => e.id === curr.parentId);
      if (!parent) break;
      curr = parent;
    }
    rootId = curr.id;
  }
  
  // Find the root entry itself
  let rootEntry = allEntries.find(e => e.id === rootId);
  if (!rootEntry) {
    rootEntry = preview;
    rootId = preview.id;
  }
  
  // Find all entries in this workflow
  const workflowEntries = allEntries.filter(e => 
    e.id === rootId || 
    e.rootId === rootId || 
    e.rootSourceId === rootId || 
    e.parentId === rootId ||
    (() => {
      let curr = e;
      const visited = new Set<string>();
      while (curr.parentId && !visited.has(curr.parentId)) {
        visited.add(curr.parentId);
        if (curr.parentId === rootId) return true;
        const parent = allEntries.find(x => x.id === curr.parentId);
        if (!parent) break;
        curr = parent;
      }
      return false;
    })()
  );
  
  // Map of ID -> TreeNode
  const nodesMap = new Map<string, HistoryTreeNode>();
  for (const entry of workflowEntries) {
    nodesMap.set(entry.id, {
      id: entry.id,
      entry,
      parentId: entry.parentId || (entry.id !== rootId ? rootId : undefined),
      nodeType: entry.nodeType || (entry.id === rootId ? 'source' : (entry.type === 'upscale' ? 'upscale' : 'variation')),
      children: []
    });
  }
  
  // Link parents and children
  let rootNode = nodesMap.get(rootId);
  if (!rootNode) {
    rootNode = {
      id: rootId,
      entry: rootEntry,
      nodeType: rootEntry.nodeType || 'source',
      children: []
    };
    nodesMap.set(rootId, rootNode);
  }
  
  for (const node of nodesMap.values()) {
    if (node.id === rootId) continue;
    
    // Find parent node
    let parentNode = node.parentId ? nodesMap.get(node.parentId) : undefined;
    
    // Fallback if parent is not in this workflow set but in allEntries
    if (!parentNode && node.parentId) {
      const parentEntry = allEntries.find(e => e.id === node.parentId);
      if (parentEntry) {
        parentNode = {
          id: parentEntry.id,
          entry: parentEntry,
          parentId: parentEntry.parentId,
          nodeType: parentEntry.nodeType || 'variation',
          children: []
        };
        nodesMap.set(parentEntry.id, parentNode);
        if (parentEntry.id !== rootId) {
          rootNode.children.push(parentNode);
        }
      }
    }
    
    // Default fallback to connect to root
    if (!parentNode) {
      parentNode = rootNode;
    }
    
    parentNode.children.push(node);
  }
  
  // Sort children by timestamp chronologically
  for (const node of nodesMap.values()) {
    node.children.sort((a, b) => a.entry.timestamp - b.entry.timestamp);
  }
  
  // Trace active path from root to preview
  const activePath: string[] = [];
  let currId: string | undefined = preview.id;
  const visited = new Set<string>();
  while (currId && !visited.has(currId)) {
    visited.add(currId);
    if (nodesMap.has(currId)) {
      activePath.unshift(currId);
    }
    const currNode = nodesMap.get(currId);
    currId = currNode?.parentId;
  }
  
  return { root: rootNode, activePath };
}

/**
 * Node card showing lazy-loaded thumbnail image, type label, and prompt.
 */
const WorkflowTreeNodeCard: React.FC<{
  node: HistoryTreeNode;
  isActive: boolean;
  onSelect: () => void;
  compareIndex: number;
  onCompareToggle: () => void;
}> = ({ node, isActive, onSelect, compareIndex, onCompareToggle }) => {
  const { containerRef, src, isLoading } = useLazyImage(node.id, 'output');
  const isCompared = compareIndex >= 0;

  const TYPE_ICONS: Record<string, React.ReactNode> = {
    source: <ImageIcon size={10} />,
    variation: <GitBranch size={10} />,
    upscale: <Sparkles size={10} />,
    edit: <Sliders size={10} />,
    canvas: <Sliders size={10} />,
  };

  const TYPE_LABELS: Record<string, string> = {
    source: 'Orig',
    variation: 'Var',
    upscale: 'Upscale',
    edit: 'Edit',
    canvas: 'Canvas',
  };

  return (
    <div 
      ref={containerRef as any}
      className={`tree-node-card-wrapper ${isActive ? 'active' : ''} ${isCompared ? 'compared' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <div className="tree-node-card-inner">
        {src ? (
          <img src={src} className="node-card-thumb" alt={node.entry.label} />
        ) : isLoading ? (
          <div className="node-card-thumb-placeholder skeleton-image" style={{ overflow: 'hidden', position: 'relative' }}>
            <div className="skeleton-shimmer" />
          </div>
        ) : (
          <div className="node-card-thumb-placeholder error" style={{ background: '#181818' }}>
            <ImageIcon size={14} color="rgba(255,255,255,0.25)" />
          </div>
        )}
        
        <div className="node-card-info">
          <div className="node-card-badge">
            {TYPE_ICONS[node.nodeType] || <GitBranch size={10} />}
            <span>{TYPE_LABELS[node.nodeType] || node.nodeType}</span>
          </div>
          <span className="node-card-desc" title={node.entry.prompt}>
            {node.entry.prompt || 'No Prompt'}
          </span>
        </div>

        {/* Comparison Badge */}
        <button
          className={`node-card-compare ${isCompared ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onCompareToggle();
          }}
          title="Compare this version"
        >
          {isCompared ? compareIndex + 1 : ''}
        </button>
      </div>
    </div>
  );
};

/**
 * TreeNodeComponent rendering parent card, collapse/expand button, and recursively children.
 */
const TreeNodeComponent: React.FC<{
  node: HistoryTreeNode;
  activeId: string;
  onSelect: (entry: HistoryEntry) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  compareIds: string[];
  onCompareToggle: (id: string) => void;
}> = ({
  node,
  activeId,
  onSelect,
  expandedIds,
  onToggleExpand,
  compareIds,
  onCompareToggle
}) => {
  const isExpanded = expandedIds.has(node.id);
  const hasChildren = node.children.length > 0;
  const isActive = activeId === node.id;
  const compareIndex = compareIds.indexOf(node.id);

  return (
    <div className="tree-node-branch">
      <div className="tree-node-holder">
        <WorkflowTreeNodeCard 
          node={node}
          isActive={isActive}
          onSelect={() => onSelect(node.entry)}
          compareIndex={compareIndex}
          onCompareToggle={() => onCompareToggle(node.id)}
        />
        
        {hasChildren && (
          <button 
            className={`tree-branch-toggle-btn ${isExpanded ? 'expanded' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            title={isExpanded ? 'Collapse children' : `Expand ${node.children.length} variations`}
          >
            {isExpanded ? '−' : `+${node.children.length}`}
          </button>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="tree-branches-container">
          {node.children.map(child => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              activeId={activeId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              compareIds={compareIds}
              onCompareToggle={onCompareToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const WorkflowTreeRenderer: React.FC<WorkflowTreeRendererProps> = ({
  preview,
  onNodeSelect,
  compareIds,
  onCompareToggle,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onZoomReset
}) => {
  const { entries: allEntries } = useHistoryStore();
  
  // Build tree & get active path to auto-expand path nodes
  const { root, activePath } = buildWorkflowTreeForEntry(preview, allEntries);

  // Expanded nodes map (default: expand nodes on active lineage path so user can see it right away)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const s = new Set<string>();
    activePath.forEach(id => s.add(id));
    s.add(root.id);
    return s;
  });

  const handleToggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="workflow-tree-history-container">
      {/* Mindmap / Tree Toolbar */}
      <div className="tree-toolbar">
        <div className="tree-toolbar-left">
          <GitBranch size={14} color="#e11d48" />
          <span className="toolbar-title">Workflow Evolution Tree</span>
        </div>
        
        <div className="toolbar-actions">
          <button className="timeline-tool-btn" onClick={onZoomOut} title="Zoom Out"><ZoomOut size={13} /></button>
          <span className="zoom-label">{Math.round(zoomLevel * 100)}%</span>
          <button className="timeline-tool-btn" onClick={onZoomIn} title="Zoom In"><ZoomIn size={13} /></button>
          <button className="timeline-tool-btn" onClick={onZoomReset} title="Reset Zoom"><Maximize2 size={13} /></button>
        </div>
      </div>

      {/* Horizontal Canvas Area */}
      <div className="tree-canvas-scroll-area">
        <div 
          className="tree-root-canvas"
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'left center' }}
        >
          <TreeNodeComponent
            node={root}
            activeId={preview.id}
            onSelect={onNodeSelect}
            expandedIds={expandedIds}
            onToggleExpand={handleToggleExpand}
            compareIds={compareIds}
            onCompareToggle={onCompareToggle}
          />
        </div>
      </div>
    </div>
  );
};
