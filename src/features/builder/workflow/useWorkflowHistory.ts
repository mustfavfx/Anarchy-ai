import { useState, useRef, useCallback } from 'react';
import type { Edge } from '@xyflow/react';
import type { BuilderNode } from '../types';
import { type HistorySnapshot, MAX_HISTORY } from './workflowConstants';

export interface UseWorkflowHistoryParams {
  nodes: BuilderNode[];
  edges: Edge[];
  setNodes: (update: BuilderNode[] | ((curr: BuilderNode[]) => BuilderNode[])) => void;
  setEdges: (update: Edge[] | ((curr: Edge[]) => Edge[])) => void;
}

export const useWorkflowHistory = ({
  nodes,
  edges,
  setNodes,
  setEdges,
}: UseWorkflowHistoryParams) => {
  const past = useRef<HistorySnapshot[]>([]);
  const future = useRef<HistorySnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncUndoRedoState = useCallback(() => {
    setCanUndo(past.current.length > 0);
    setCanRedo(future.current.length > 0);
  }, []);

  // Call before any structural change (add/delete node, execute)
  const pushHistory = useCallback((currentNodes: BuilderNode[], currentEdges: Edge[]) => {
    past.current = [...past.current.slice(-MAX_HISTORY + 1), { nodes: currentNodes, edges: currentEdges }];
    future.current = []; // clear redo stack on new action
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    if (past.current.length === 0) return;
    const snapshot = past.current[past.current.length - 1];
    past.current = past.current.slice(0, -1);
    future.current = [{ nodes, edges }, ...future.current.slice(0, MAX_HISTORY - 1)];
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    syncUndoRedoState();
  }, [nodes, edges, setNodes, setEdges, syncUndoRedoState]);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    const snapshot = future.current[0];
    future.current = future.current.slice(1);
    past.current = [...past.current.slice(-MAX_HISTORY + 1), { nodes, edges }];
    setNodes(snapshot.nodes);
    setEdges(snapshot.edges);
    syncUndoRedoState();
  }, [nodes, edges, setNodes, setEdges, syncUndoRedoState]);

  return {
    canUndo,
    canRedo,
    pushHistory,
    undo,
    redo,
    syncUndoRedoState,
  };
};
