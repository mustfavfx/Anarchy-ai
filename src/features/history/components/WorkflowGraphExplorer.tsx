import React, { useMemo, useEffect } from 'react';
import { 
  ReactFlow, 
  Background, 
  MiniMap, 
  Handle, 
  Position, 
  useNodesState, 
  useEdgesState, 
  useReactFlow,
  ReactFlowProvider,
  BaseEdge,
  type EdgeProps
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { HistoryEntry } from '../types';
import { useLazyImage } from '../hooks/useLazyImage';
import { useHistoryStore } from '@/stores/historyStore';
import { 
  GitBranch, ZoomIn, ZoomOut, Maximize2, 
  Sparkles, Image as ImageIcon, Sliders 
} from 'lucide-react';
import './WorkflowGraphExplorer.css';

// ─── Custom Node Definition ─────────────────────────────────────────────────

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

export const HistoryGraphNode = React.memo(({ data }: { data: any }) => {
  const entry = data.entry;
  const isActive = data.isActive;
  const isCompared = data.compareIndex >= 0;
  const compareIndex = data.compareIndex;
  
  const { containerRef, src, isLoading } = useLazyImage(entry.id, 'output');
  
  const nodeType = entry.nodeType || (entry.parentId ? 'variation' : 'source');

  return (
    <div 
      ref={containerRef as any}
      className={`tree-node-card-wrapper history-rf-node-card ${isActive ? 'active' : ''} ${isCompared ? 'compared' : ''}`}
      style={{ margin: 0 }}
      onClick={() => data.onSelect(entry)}
    >
      {/* Target handle on left */}
      {entry.parentId && (
        <Handle 
          type="target" 
          position={Position.Left} 
          id="target" 
          style={{ background: '#e11d48', border: '1px solid #000', width: 8, height: 8 }} 
        />
      )}

      <div className="tree-node-card-inner">
        {src ? (
          <img src={src} className="node-card-thumb" alt={entry.label} />
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
            {TYPE_ICONS[nodeType] || <GitBranch size={10} />}
            <span>{TYPE_LABELS[nodeType] || nodeType}</span>
          </div>
          <span className="node-card-desc" title={entry.prompt}>
            {entry.prompt || 'No Prompt'}
          </span>
        </div>

        {/* Comparison Badge */}
        <button
          className={`node-card-compare ${isCompared ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            data.onCompareToggle(entry.id);
          }}
          title="Compare this version"
        >
          {isCompared ? compareIndex + 1 : ''}
        </button>
      </div>

      {/* Source handle on right */}
      {data.hasChildren && (
        <Handle 
          type="source" 
          position={Position.Right} 
          id="source" 
          style={{ background: '#e11d48', border: '1px solid #000', width: 8, height: 8 }} 
        />
      )}
    </div>
  );
});

// ─── Custom Connection Edge ─────────────────────────────────────────────────

const HistoryBezierEdge = React.memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition: _sourcePosition = Position.Right,
  targetPosition: _targetPosition = Position.Left,
  style = {},
  markerEnd,
}: EdgeProps) => {
  const distanceX = Math.abs(targetX - sourceX);
  const offset = Math.max(distanceX, 50) * 0.45;
  const path = `M ${sourceX} ${sourceY} C ${sourceX + offset} ${sourceY}, ${targetX - offset} ${targetY}, ${targetX} ${targetY}`;

  return (
    <BaseEdge 
      id={id} 
      path={path} 
      style={{
        ...style,
        strokeWidth: 2,
        stroke: 'rgba(225, 29, 72, 0.4)',
        strokeDasharray: '4 4',
        fill: 'none',
      }} 
      markerEnd={markerEnd}
    />
  );
});

const nodeTypes = {
  historyNode: HistoryGraphNode,
};

const edgeTypes = {
  bezierEdge: HistoryBezierEdge,
};

// ─── Main Explorer Component ────────────────────────────────────────────────

interface LayoutNode {
  id: string;
  entry: HistoryEntry;
  children: LayoutNode[];
  x: number;
  y: number;
  height: number;
}

interface WorkflowGraphExplorerProps {
  preview: HistoryEntry;
  onNodeSelect: (entry: HistoryEntry) => void;
  compareIds: string[];
  onCompareToggle: (id: string) => void;
}

function WorkflowGraphExplorerInner({
  preview,
  onNodeSelect,
  compareIds,
  onCompareToggle,
}: WorkflowGraphExplorerProps) {
  const { entries: allEntries } = useHistoryStore();
  const { fitView, zoomIn, zoomOut, getViewport } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);

  // 1. Build and layout hierarchy recursively
  const graphData = useMemo(() => {
    // Find Root Node
    let rootId = preview.rootId || preview.rootSourceId;
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

    let rootEntry = allEntries.find(e => e.id === rootId) || preview;

    // Filter all entries belonging to this lineage
    const lineage = allEntries.filter(e => 
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

    // Build adjacency map
    const nodesMap = new Map<string, LayoutNode>();
    for (const entry of lineage) {
      nodesMap.set(entry.id, {
        id: entry.id,
        entry,
        children: [],
        x: 0,
        y: 0,
        height: 0
      });
    }

    const rootNode = nodesMap.get(rootEntry.id) || {
      id: rootEntry.id,
      entry: rootEntry,
      children: [],
      x: 0,
      y: 0,
      height: 0
    };
    if (!nodesMap.has(rootEntry.id)) {
      nodesMap.set(rootEntry.id, rootNode);
    }

    // Link parents to children
    for (const node of nodesMap.values()) {
      if (node.id === rootNode.id) continue;
      const pId = node.entry.parentId || rootNode.id;
      const parent = nodesMap.get(pId) || rootNode;
      parent.children.push(node);
    }

    // Sort children chronologically
    for (const node of nodesMap.values()) {
      node.children.sort((a, b) => a.entry.timestamp - b.entry.timestamp);
    }

    // Compute heights recursively (post-order)
    const computeHeight = (n: LayoutNode) => {
      if (n.children.length === 0) {
        n.height = 90; // single node vertical spacing
      } else {
        n.children.forEach(computeHeight);
        const childrenHeightSum = n.children.reduce((acc, c) => acc + c.height, 0);
        const gaps = (n.children.length - 1) * 20;
        n.height = Math.max(90, childrenHeightSum + gaps);
      }
    };
    computeHeight(rootNode);

    // Assign x, y coordinates recursively (pre-order)
    const assignCoords = (n: LayoutNode, currentX: number, centerY: number) => {
      n.x = currentX;
      n.y = centerY;

      if (n.children.length > 0) {
        const totalHeight = n.children.reduce((acc, c) => acc + c.height, 0) + (n.children.length - 1) * 20;
        let startY = centerY - totalHeight / 2;
        
        n.children.forEach(child => {
          const childY = startY + child.height / 2;
          assignCoords(child, currentX + 260, childY);
          startY += child.height + 20;
        });
      }
    };
    assignCoords(rootNode, 50, 200);

    // Flatten to React Flow nodes and edges
    const rfNodes: any[] = [];
    const rfEdges: any[] = [];

    nodesMap.forEach(n => {
      rfNodes.push({
        id: n.id,
        type: 'historyNode',
        position: { x: n.x, y: n.y },
        data: {
          entry: n.entry,
          isActive: n.id === preview.id,
          compareIndex: compareIds.indexOf(n.id),
          hasChildren: n.children.length > 0,
          onSelect: onNodeSelect,
          onCompareToggle: onCompareToggle,
        },
      });

      n.children.forEach(child => {
        rfEdges.push({
          id: `e-${n.id}-${child.id}`,
          source: n.id,
          target: child.id,
          type: 'bezierEdge',
        });
      });
    });

    return { rfNodes, rfEdges };
  }, [preview, allEntries, compareIds, onNodeSelect, onCompareToggle]);

  // Synchronize layout data to ReactFlow state
  useEffect(() => {
    setNodes(graphData.rfNodes);
    setEdges(graphData.rfEdges);

    // Fit view after small delay to let browser measure elements
    const timer = setTimeout(() => {
      fitView({ padding: 0.15, duration: 400 });
    }, 150);
    return () => clearTimeout(timer);
  }, [graphData, setNodes, setEdges, fitView]);

  const handleResetZoom = () => {
    fitView({ padding: 0.15, duration: 400 });
  };

  const currentZoom = Math.round((getViewport().zoom || 1) * 100);

  return (
    <div className="workflow-graph-explorer">
      {/* Mindmap / Tree Toolbar */}
      <div className="tree-toolbar">
        <div className="tree-toolbar-left">
          <GitBranch size={14} color="#e11d48" />
          <span className="toolbar-title">Interactive Workflow Evolution Graph</span>
        </div>
        
        <div className="toolbar-actions">
          <button className="timeline-tool-btn" onClick={() => zoomOut()} title="Zoom Out"><ZoomOut size={13} /></button>
          <span className="zoom-label" style={{ width: '42px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
            {currentZoom}%
          </span>
          <button className="timeline-tool-btn" onClick={() => zoomIn()} title="Zoom In"><ZoomIn size={13} /></button>
          <button className="timeline-tool-btn" onClick={handleResetZoom} title="Fit Graph"><Maximize2 size={13} /></button>
        </div>
      </div>

      <div className="graph-explorer-canvas-wrapper" style={{ flexGrow: 1, height: '350px', position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          fitViewOptions={{ padding: 0.15 }}
          colorMode="dark"
          minZoom={0.1}
          maxZoom={1.5}
          preventScrolling={true}
          zoomOnScroll={false}
          panOnDrag={true}
        >
          <Background color="#333" gap={16} size={1} />
          <MiniMap 
            nodeColor={() => 'rgba(225, 29, 72, 0.3)'} 
            maskColor="rgba(0, 0, 0, 0.6)"
            style={{
              background: 'rgba(10, 10, 10, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              width: 100,
              height: 75,
            }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}

export function WorkflowGraphExplorer(props: WorkflowGraphExplorerProps) {
  return (
    <ReactFlowProvider>
      <WorkflowGraphExplorerInner {...props} />
    </ReactFlowProvider>
  );
}

export default WorkflowGraphExplorer;
