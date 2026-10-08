import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  GitBranch,
  X,
  Send,
  Eye,
  Check,
  Copy,
  Layers,
  Scale,
  Compass,
  Sun,
  LayoutGrid,
  Brain,
  Monitor,
  Bot,
  Play,
  Square,
  RefreshCw,
  Box,
} from 'lucide-react';
import { architectAgent, type ArchitectAgentMessage } from '../../../services/agent/ArchitectAgentService';
import { canvasBridge } from '../../../services/agent/CanvasBridgeService';
import type { CanvasAction } from '../../../services/agent/ArchitecturalUnderstanding';
import {
  computerUseAgent,
  type CUAStepRecord,
  type CUAStatus,
  type CUAObservation,
} from '../../../services/agent/ComputerUseAgentService';
import { useAIConfigStore } from '../../../stores/aiConfigStore';
import { useNotificationStore } from '../../../stores/notificationStore';
import './ArchitectCopilotDock.css';

interface CopilotChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  enhancedPrompt?: string;
  actions?: CanvasAction[];
  timestamp: number;
}

interface ArchitectCopilotDockProps {
  onClose: () => void;
}

export const ArchitectCopilotDock: React.FC<ArchitectCopilotDockProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'advisor' | 'cua'>('advisor');
  const [cuaGoal, setCuaGoal] = useState('');
  const [cuaStatus, setCuaStatus] = useState<CUAStatus>('idle');
  const [cuaSteps, setCuaSteps] = useState<CUAStepRecord[]>([]);
  const [cuaObservation, setCuaObservation] = useState<CUAObservation | null>(null);
  const [plannerProvider, setPlannerProviderState] = useState<'gemini' | 'openai'>(() =>
    computerUseAgent.getPlannerProvider()
  );
  const [bimMetadata, setBimMetadata] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    const handleBimEvent = (e: Event) => {
      const customEvent = e as CustomEvent<any>;
      if (customEvent.detail) {
        setBimMetadata(customEvent.detail);
      }
    };
    window.addEventListener('anarchy:bim-metadata-global', handleBimEvent);
    return () => {
      window.removeEventListener('anarchy:bim-metadata-global', handleBimEvent);
    };
  }, []);

  const handleTogglePlanner = (prov: 'gemini' | 'openai') => {
    computerUseAgent.setPlannerProvider(prov);
    setPlannerProviderState(prov);
    addNotification({
      type: 'info',
      title: 'Multi-Provider Planner Engine',
      message: prov === 'openai' ? 'Switched to OpenAI GPT-4o Vision Planner' : 'Switched to Google Gemini Flash Engine',
      duration: 3000,
    });
  };

  const [messages, setMessages] = useState<CopilotChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '**Welcome.** I am your **Autonomous Architectural Agent & CUA** integrated directly into Anarchy AI.\n\n' +
        'I maintain comprehensive awareness of canvas layers, design lineage, and full computer-use integration with **Autodesk (3ds Max / AutoCAD / Revit)** and desktop CAD workflows.',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [executedActionIds, setExecutedActionIds] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedNode = useAIConfigStore((s) => s.selectedNode);
  const workflowSnapshot = useAIConfigStore((s) => s.workflowSnapshot);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const activeRawNode = (workflowSnapshot.nodes || []).find((n) => n.id === selectedNode?.id);
  const nodeData = (activeRawNode?.data || {}) as Record<string, any>;
  const activeThumbnail = selectedNode?.image || selectedNode?.originalImage || nodeData.image || nodeData.thumbnail;
  const activeLineage = nodeData.lineage;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, cuaSteps]);

  useEffect(() => {
    const unsub = computerUseAgent.subscribeStatus((status, step) => {
      setCuaStatus(status);
      if (step) {
        setCuaSteps((prev) => {
          const idx = prev.findIndex((s) => s.step === step.step);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = step;
            return next;
          }
          return [...prev, step];
        });
      }
    });
    return unsub;
  }, []);

  const handleRefreshObservation = async () => {
    try {
      const obs = await computerUseAgent.observe();
      setCuaObservation(obs);
    } catch {}
  };

  useEffect(() => {
    if (activeTab === 'cua') {
      handleRefreshObservation();
    }
  }, [activeTab]);

  const handleStartCuaTask = async (customGoal?: string) => {
    const goal = (customGoal || cuaGoal).trim();
    if (!goal || cuaStatus === 'acting' || cuaStatus === 'thinking' || cuaStatus === 'observing') return;

    setCuaSteps([]);
    try {
      const outcome = await computerUseAgent.executeAutonomousTask(goal, {
        maxSteps: 30,
        onStep: (step) => {
          setCuaSteps((prev) => {
            const exists = prev.some((s) => s.step === step.step);
            if (exists) {
              return prev.map((s) => (s.step === step.step ? step : s));
            }
            return [...prev, step];
          });
        },
      });
      if (outcome.success) {
        addNotification({
          type: 'success',
          title: 'CUA Execution Completed',
          message: outcome.message || 'Computer-Use Agent successfully finished the autonomous workflow.',
        });
      } else {
        addNotification({
          type: 'warning',
          title: 'CUA Task Notice',
          message: outcome.message || 'CUA task completed with unverified steps or warnings.',
        });
      }
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'CUA Task Error',
        message: err?.message || 'Error executing CUA task.',
      });
    }
  };

  const handleAbortCua = () => {
    computerUseAgent.abort();
    addNotification({
      type: 'warning',
      title: 'CUA Aborted',
      message: 'Autonomous computer-use execution stopped by user.',
    });
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMsg: CopilotChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      // Build history for model
      const history: ArchitectAgentMessage[] = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Grab active node visual if relevant
      const imageBase64 = await canvasBridge.getActiveNodeImageBase64();

      const res = await architectAgent.generateResponse({
        message: query,
        conversationHistory: history,
        attachedImageBase64: imageBase64 || undefined,
        nodeId: selectedNode?.id || undefined,
      });

      const assistantMsg: CopilotChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: res.response.replace(/\[CanvasAction:[\s\S]*?\]/gi, '').trim(),
        enhancedPrompt: res.enhancedPrompt,
        actions: res.actions,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Architect Agent Error',
        message: err?.message || 'Failed to generate architectural reasoning.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecuteAction = async (action: CanvasAction, actionKey: string) => {
    try {
      const result = await canvasBridge.executeCanvasAction(action);
      if (result.success) {
        setExecutedActionIds((prev) => new Set(prev).add(actionKey));
        addNotification({
          type: 'success',
          title: 'Canvas Action Executed',
          message: result.message,
          duration: 3500,
        });
      } else {
        addNotification({
          type: 'warning',
          title: 'Action Warning',
          message: result.message,
          duration: 4000,
        });
      }
    } catch (e: any) {
      addNotification({
        type: 'error',
        title: 'Action Failed',
        message: e?.message || 'Could not execute canvas action.',
      });
    }
  };

  const handleApplyPrompt = (promptText: string) => {
    if (selectedNode?.id) {
      canvasBridge.applyPromptToNode(selectedNode.id, promptText);
      addNotification({
        type: 'success',
        title: 'Prompt Applied',
        message: `Applied to Node #${selectedNode.id.slice(0, 6)} and workspace prompt.`,
      });
    } else {
      useAIConfigStore.getState().setWorkspacePrompt(promptText);
      addNotification({
        type: 'info',
        title: 'Prompt Applied',
        message: 'Applied to global prompt bar.',
      });
    }
  };

  const handleCopyPrompt = (promptText: string, msgId: string) => {
    navigator.clipboard.writeText(promptText);
    setCopiedPromptId(msgId);
    setTimeout(() => setCopiedPromptId(null), 2000);
    addNotification({
      type: 'info',
      title: 'Copied',
      message: 'Prompt copied to clipboard.',
      duration: 1500,
    });
  };

  return (
    <div className="architect-copilot-dock" onClick={(e) => e.stopPropagation()}>
      {/* ── Header ── */}
      <div className="copilot-header">
        <div className="copilot-header-brand">
          <div className="copilot-brand-icon-box">
            <Compass size={18} />
          </div>
          <div className="copilot-title-group">
            <h3>
              <span>Antigravity Architect</span>
              <span className="copilot-resident-badge">Resident AI</span>
            </h3>
            <div className="copilot-subtitle">Resident Senior Principal Architect — Live Canvas Sync</div>
          </div>
        </div>
        <div className="copilot-header-actions">
          <button
            type="button"
            className="copilot-action-btn"
            onClick={onClose}
            title="Close Architect Copilot"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── Mode Switcher Tabs ── */}
      <div className="copilot-mode-tabs">
        <button
          type="button"
          className={`copilot-mode-tab ${activeTab === 'advisor' ? 'active' : ''}`}
          onClick={() => setActiveTab('advisor')}
        >
          <Compass size={13} />
          <span>Architect Advisor</span>
        </button>
        <button
          type="button"
          className={`copilot-mode-tab ${activeTab === 'cua' ? 'active' : ''}`}
          onClick={() => setActiveTab('cua')}
        >
          <Monitor size={13} />
          <span>Autonomous Control (CUA)</span>
          <span className="copilot-tab-live-pulse" />
        </button>
      </div>

      {activeTab === 'advisor' ? (
        <>
          {/* ── Live Canvas Sensor Bar ── */}
      <div className="copilot-canvas-sensor">
        <div className="sensor-node-info">
          {activeThumbnail && (
            <img src={activeThumbnail} alt="Active Node" className="sensor-node-thumb" />
          )}
          <span>
            {selectedNode?.id
              ? `Selected Node: #${selectedNode.id.slice(0, 6)}`
              : `${workflowSnapshot.nodes?.length || 0} nodes on canvas`}
          </span>
          {activeLineage?.parentId && (
            <span className="sensor-branch-badge">
              <GitBranch size={9} />
              <span>Branch v{activeLineage.generation || 1}</span>
            </span>
          )}
        </div>
        {selectedNode?.id && (
          <button
            type="button"
            className="copilot-action-btn"
            style={{ fontSize: 11, padding: '2px 6px', gap: 4 }}
            onClick={() => selectedNode.id && canvasBridge.focusNode(selectedNode.id)}
            title="Focus camera on selected node"
          >
            <Eye size={12} />
            <span>Focus</span>
          </button>
        )}
      </div>

      {/* ── Quick Action Chips ── */}
      <div className="copilot-quick-chips">
        <button
          type="button"
          className="copilot-chip"
          onClick={() =>
            handleSendMessage('Critique this architectural design in depth: volumetric massing, daylight temperature, material tectonics, and negative reveals.')
          }
        >
          <Sparkles size={11} style={{ color: '#34d399' }} />
          <span>Critique Scene</span>
        </button>

        <button
          type="button"
          className="copilot-chip"
          onClick={() =>
            handleSendMessage('Analyze bioclimatic solar orientation: North-facing daylighting, deep South-West cantilevers, and motorized vertical louvers.')
          }
        >
          <Sun size={11} style={{ color: '#eab308' }} />
          <span>Bioclimatic Study</span>
        </button>

        <button
          type="button"
          className="copilot-chip"
          onClick={() =>
            handleSendMessage('Refine with bespoke micro-architectural details: 15mm negative shadow reveals, vein-cut Roman travertine, and 20mm sightline glazing.')
          }
        >
          <Layers size={11} style={{ color: '#fb7185' }} />
          <span>Tectonic Detailing</span>
        </button>

        <button
          type="button"
          className="copilot-chip"
          onClick={() =>
            handleSendMessage('Fork this node into a dramatic night scene with 3000K linear architectural coves and a calm water courtyard.')
          }
        >
          <GitBranch size={11} style={{ color: '#38bdf8' }} />
          <span>Fork Night Branch</span>
        </button>

        <button
          type="button"
          className="copilot-chip"
          onClick={() =>
            handleSendMessage('Evaluate functional zoning and circulation: entrance vestibule, acoustic privacy buffers, and service circulation.')
          }
        >
          <LayoutGrid size={11} style={{ color: '#a855f7' }} />
          <span>Spatial Zoning</span>
        </button>

        <button
          type="button"
          className="copilot-chip"
          onClick={() =>
            handleSendMessage('Reflect on your Hindsight memory: what are my dominant architectural preferences, material palettes, and design rules across our sessions?')
          }
        >
          <Brain size={11} style={{ color: '#ec4899' }} />
          <span>Hindsight Memory</span>
        </button>

        <button
          type="button"
          className="copilot-chip"
          onClick={() =>
            handleSendMessage('Compare the connected canvas nodes and summarize key architectural evolutions and realism deltas.')
          }
        >
          <Scale size={11} style={{ color: '#f59e0b' }} />
          <span>Compare Iterations</span>
        </button>
      </div>

      {/* ── Message Thread ── */}
      <div className="copilot-messages-container">
        {messages.map((msg) => (
          <div key={msg.id} className={`copilot-message ${msg.role}`}>
            <div className="copilot-message-bubble">{msg.content}</div>

            {/* Generated Prompt Block */}
            {msg.enhancedPrompt && (
              <div className="copilot-prompt-card">
                <div className="copilot-prompt-card-title">
                  <Sparkles size={12} />
                  <span>Architectural Render Prompt:</span>
                </div>
                <div className="copilot-prompt-card-text">{msg.enhancedPrompt}</div>
                <div className="copilot-prompt-card-buttons">
                  <button
                    type="button"
                    className="copilot-prompt-action-btn apply-active"
                    onClick={() => handleApplyPrompt(msg.enhancedPrompt!)}
                  >
                    <Check size={12} />
                    <span>Apply to Node</span>
                  </button>
                  <button
                    type="button"
                    className="copilot-prompt-action-btn"
                    onClick={() => handleCopyPrompt(msg.enhancedPrompt!, msg.id)}
                  >
                    {copiedPromptId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedPromptId === msg.id ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Action Dispatches (Fork, Focus, Compare) */}
            {msg.actions && msg.actions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {msg.actions.map((act, idx) => {
                  const actKey = `${msg.id}_act_${idx}`;
                  const isDone = executedActionIds.has(actKey);

                  if (act.type === 'fork_node') {
                    return (
                      <div key={actKey} className="copilot-action-card">
                        <div className="copilot-action-card-header">
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <GitBranch size={13} />
                            <span>Fork to Child Node (Connected Branch)</span>
                          </span>
                          {isDone && <span style={{ color: '#34d399', fontSize: 10 }}>✓ Forked</span>}
                        </div>
                        <div className="copilot-action-card-desc">
                          {act.label || 'Design Alternative'} — Creates a new child node connected by an animated edge in the project family tree.
                        </div>
                        <button
                          type="button"
                          className="copilot-action-execute-btn"
                          disabled={isDone}
                          onClick={() => handleExecuteAction(act, actKey)}
                        >
                          <GitBranch size={13} />
                          <span>{isDone ? 'Forked to Canvas' : 'Fork Branch to Canvas'}</span>
                        </button>
                      </div>
                    );
                  }

                  if (act.type === 'focus_node') {
                    return (
                      <div key={actKey} className="copilot-action-card">
                        <div className="copilot-action-card-header">
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Eye size={13} />
                            <span>Focus Camera on Node #{act.nodeId?.slice(0, 6)}</span>
                          </span>
                        </div>
                        <button
                          type="button"
                          className="copilot-action-execute-btn secondary"
                          onClick={() => handleExecuteAction(act, actKey)}
                        >
                          <Eye size={13} />
                          <span>Focus Node on Canvas</span>
                        </button>
                      </div>
                    );
                  }

                  if (act.type === 'update_prompt') {
                    return (
                      <div key={actKey} className="copilot-action-card">
                        <div className="copilot-action-card-header">
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Sparkles size={13} style={{ color: '#38bdf8' }} />
                            <span>Update Node Prompt (#{act.nodeId ? act.nodeId.slice(0, 6) : 'Active'})</span>
                          </span>
                          {isDone && <span style={{ color: '#34d399', fontSize: 10 }}>✓ Applied</span>}
                        </div>
                        <div className="copilot-action-card-desc">
                          {act.prompt ? `"${act.prompt.slice(0, 90)}..."` : 'Injects synthesized architectural prompt directly into the node.'}
                        </div>
                        <button
                          type="button"
                          className="copilot-action-execute-btn"
                          disabled={isDone}
                          onClick={() => handleExecuteAction(act, actKey)}
                        >
                          <Sparkles size={13} />
                          <span>{isDone ? 'Applied to Node' : 'Apply Prompt to Node'}</span>
                        </button>
                      </div>
                    );
                  }

                  if (act.type === 'compare_nodes') {
                    return (
                      <div key={actKey} className="copilot-action-card">
                        <div className="copilot-action-card-header">
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Scale size={13} style={{ color: '#f59e0b' }} />
                            <span>Compare Iterations (#{act.nodeIdA?.slice(0, 6)} vs #{act.nodeIdB?.slice(0, 6)})</span>
                          </span>
                          {isDone && <span style={{ color: '#34d399', fontSize: 10 }}>✓ Analyzed</span>}
                        </div>
                        <button
                          type="button"
                          className="copilot-action-execute-btn secondary"
                          disabled={isDone}
                          onClick={() => handleExecuteAction(act, actKey)}
                        >
                          <Scale size={13} />
                          <span>{isDone ? 'Comparison Done' : 'Run Node Comparison'}</span>
                        </button>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="copilot-message assistant">
            <div
              className="copilot-message-bubble"
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Compass size={15} className="spin-slow" style={{ color: '#34d399' }} />
              <span>Analyzing spatial composition & canvas graph topology...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Box ── */}
      <div className="copilot-input-area">
        <div className="copilot-input-row">
          <textarea
            ref={textareaRef}
            className="copilot-textarea"
            placeholder="Ask for design critique, fork a branch, or specify tectonic materials..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            rows={1}
          />
          <button
            type="button"
            className="copilot-send-btn"
            disabled={!input.trim() || isLoading}
            onClick={() => handleSendMessage()}
            title="Send"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </>
  ) : (
    <div className="copilot-cua-container">
      {/* CUA Status Dashboard */}
      <div className="cua-status-deck">
        <div className="cua-status-item">
          <span className={`cua-dot ${cuaObservation?.autodesk.is3dsMaxRunning ? 'online' : 'offline'}`} />
          <span className="cua-label">3ds Max:</span>
          <span className="cua-val">{cuaObservation?.autodesk.is3dsMaxRunning ? 'Connected' : 'Offline'}</span>
        </div>
        <div className="cua-status-item">
          <span className={`cua-dot ${cuaObservation?.autodesk.isRevitRunning ? 'online' : 'offline'}`} />
          <span className="cua-label">Revit:</span>
          <span className="cua-val">{cuaObservation?.autodesk.isRevitRunning ? 'Connected' : 'Offline'}</span>
        </div>
        <div className="cua-status-item">
          <span className={`cua-dot ${cuaObservation?.autodesk.isAutoCADRunning ? 'online' : 'offline'}`} />
          <span className="cua-label">AutoCAD:</span>
          <span className="cua-val">{cuaObservation?.autodesk.isAutoCADRunning ? 'Connected' : 'Offline'}</span>
        </div>
        <div className="cua-status-item">
          <span className="cua-dot online" />
          <span className="cua-label">Canvas:</span>
          <span className="cua-val">{workflowSnapshot.nodes?.length || 0} nodes</span>
        </div>
        <div className="cua-planner-switch" style={{ display: 'flex', alignItems: 'center', gap: 4, marginInlineStart: 'auto' }}>
          <button
            type="button"
            className={`cua-provider-toggle-btn ${plannerProvider === 'gemini' ? 'active' : ''}`}
            onClick={() => handleTogglePlanner('gemini')}
            title="Google Gemini Flash Engine"
          >
            Gemini
          </button>
          <button
            type="button"
            className={`cua-provider-toggle-btn ${plannerProvider === 'openai' ? 'active' : ''}`}
            onClick={() => handleTogglePlanner('openai')}
            title="OpenAI GPT-4o Vision Engine"
          >
            OpenAI (GPT-4o)
          </button>
        </div>
        <button
          type="button"
          className="cua-refresh-btn"
          onClick={handleRefreshObservation}
          title="Refresh Environment Inspection"
        >
          <RefreshCw size={11} />
        </button>
      </div>

      {/* BIM / CAD Live Metadata Card */}
      {bimMetadata ? (
        <div className="cua-bim-deck" style={{
          background: 'rgba(30, 41, 59, 0.65)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: 8,
          padding: '8px 12px',
          margin: '0 12px 10px 12px',
          fontSize: 11,
          color: '#cbd5e1'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontWeight: 600, color: '#38bdf8' }}>
            <span>🏢 Live BIM/CAD Metadata ({bimMetadata.software})</span>
            <span>{bimMetadata.project_name || 'Active Project'}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px' }}>
            {bimMetadata.levels !== undefined && <span>Levels: <b style={{ color: '#f8fafc' }}>{bimMetadata.levels}</b></span>}
            {bimMetadata.walls !== undefined && <span>Walls: <b style={{ color: '#f8fafc' }}>{bimMetadata.walls}</b></span>}
            {bimMetadata.doors !== undefined && <span>Doors: <b style={{ color: '#f8fafc' }}>{bimMetadata.doors}</b></span>}
            {bimMetadata.windows !== undefined && <span>Windows: <b style={{ color: '#f8fafc' }}>{bimMetadata.windows}</b></span>}
            {bimMetadata.rooms !== undefined && <span>Rooms: <b style={{ color: '#f8fafc' }}>{bimMetadata.rooms}</b></span>}
            {bimMetadata.layers !== undefined && <span>Layers: <b style={{ color: '#f8fafc' }}>{bimMetadata.layers}</b></span>}
            {bimMetadata.blocks !== undefined && <span>Blocks: <b style={{ color: '#f8fafc' }}>{bimMetadata.blocks}</b></span>}
            {bimMetadata.element_count !== undefined && <span>Total Elements: <b style={{ color: '#f8fafc' }}>{bimMetadata.element_count}</b></span>}
          </div>
        </div>
      ) : (
        <div className="cua-bim-deck empty" style={{
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px dashed rgba(255, 255, 255, 0.12)',
          borderRadius: 8,
          padding: '7px 12px',
          margin: '0 12px 10px 12px',
          fontSize: 10.5,
          color: 'rgba(255, 255, 255, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>🏢 Waiting for Revit / AutoCAD Connection • No Data Received</span>
          <span style={{ fontSize: 9.5, color: '#38bdf8' }}>Send to Anarchy</span>
        </div>
      )}

      {/* Quick Autonomous Action Presets */}
      <div className="cua-presets-deck">
        <div className="cua-presets-title">⚡ Comprehensive Architectural & CAD Automations (CUA):</div>
        <div className="cua-presets-grid">
          <button
            type="button"
            className="cua-preset-btn"
            disabled={cuaStatus === 'acting' || cuaStatus === 'thinking' || cuaStatus === 'observing'}
            onClick={() => handleStartCuaTask('Comprehensive Feasibility & Design for 500m² Plot: setbacks, solar analysis, 2D CAD layout, 3D Speckle model, BOQ Excel schedule, and presentation deck')}
          >
            <Sparkles size={12} style={{ color: '#ec4899' }} />
            <span>All-in-One Comprehensive Feasibility</span>
          </button>
          <button
            type="button"
            className="cua-preset-btn"
            disabled={cuaStatus === 'acting' || cuaStatus === 'thinking' || cuaStatus === 'observing'}
            onClick={() => handleStartCuaTask('Export detailed BOQ Schedule Excel spreadsheet for 500m² villa')}
          >
            <Layers size={12} style={{ color: '#10b981' }} />
            <span>BOQ Schedule Export (Excel)</span>
          </button>
          <button
            type="button"
            className="cua-preset-btn"
            disabled={cuaStatus === 'acting' || cuaStatus === 'thinking' || cuaStatus === 'observing'}
            onClick={() => handleStartCuaTask('Generate 2D architectural AutoCAD DXF drawing for 20x25m plot with regulatory setbacks')}
          >
            <Compass size={12} style={{ color: '#06b6d4' }} />
            <span>AutoCAD 2D DXF Generation</span>
          </button>
          <button
            type="button"
            className="cua-preset-btn"
            disabled={cuaStatus === 'acting' || cuaStatus === 'thinking' || cuaStatus === 'observing'}
            onClick={() => handleStartCuaTask('Create interactive 3D BIM model with WebGL interactive viewport')}
          >
            <Box size={12} style={{ color: '#8b5cf6' }} />
            <span>Interactive 3D BIM Model</span>
          </button>
          <button
            type="button"
            className="cua-preset-btn"
            disabled={cuaStatus === 'acting' || cuaStatus === 'thinking' || cuaStatus === 'observing'}
            onClick={() => handleStartCuaTask('Analyze solar path, daylight angles, and facade shading geometry')}
          >
            <Sun size={12} style={{ color: '#f59e0b' }} />
            <span>Solar Analysis & Climate Orientation</span>
          </button>
          <button
            type="button"
            className="cua-preset-btn"
            disabled={cuaStatus === 'acting' || cuaStatus === 'thinking' || cuaStatus === 'observing'}
            onClick={() => handleStartCuaTask('Generate full architectural presentation deck PowerPoint (.pptx)')}
          >
            <Brain size={12} style={{ color: '#38bdf8' }} />
            <span>Presentation Deck (PowerPoint)</span>
          </button>
          <button
            type="button"
            className="cua-preset-btn"
            disabled={cuaStatus === 'acting' || cuaStatus === 'thinking' || cuaStatus === 'observing'}
            onClick={() => handleStartCuaTask('Capture camera perspective from 3ds Max to canvas with realistic architectural lighting')}
          >
            <Monitor size={12} style={{ color: '#34d399' }} />
            <span>Sync 3ds Max Viewport</span>
          </button>
          <button
            type="button"
            className="cua-preset-btn"
            disabled={cuaStatus === 'acting' || cuaStatus === 'thinking' || cuaStatus === 'observing'}
            onClick={() => handleStartCuaTask('Capture full desktop screenshot and analyze active CAD design elements')}
          >
            <Eye size={12} style={{ color: '#38bdf8' }} />
            <span>Screen Vision Inspection (SoM)</span>
          </button>
        </div>
      </div>

      {/* CUA Step Execution Timeline */}
      <div className="cua-timeline">
        {cuaSteps.length === 0 ? (
          <div className="cua-empty-state">
            <Bot size={32} style={{ color: 'rgba(255,255,255,0.2)' }} />
            <div className="cua-empty-title">Ready for Autonomous Execution (CUA & Architectural Engine)</div>
            <div className="cua-empty-text">
              Command the agent to control 3ds Max, compute building codes & setbacks, generate DXF layouts, export Excel BOQ schedules, and create presentations autonomously.
            </div>
          </div>
        ) : (
          cuaSteps.map((step) => {
            const hasLinks = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/.test(step.result.message || '');
            return (
              <div key={step.step} className="cua-step-card">
                <div className="cua-step-header">
                  <span className="cua-step-badge">Step {step.step}</span>
                  <span className="cua-action-type">{step.action.type}</span>
                  <span className={`cua-step-status ${step.result.success ? 'success' : 'pending'}`}>
                    {step.result.success ? '✓ Completed' : '⟳ Running'}
                  </span>
                </div>
                <div className="cua-step-thought">{step.thought}</div>
                <div className="cua-step-result" style={{ lineHeight: 1.6 }}>
                  {hasLinks ? (
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                      {step.result.message.split('\n').map((line, lIdx) => {
                        const match = line.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
                        if (match) {
                          const [full, label, url] = match;
                          const prefix = line.slice(0, match.index);
                          const suffix = line.slice((match.index || 0) + full.length);
                          return (
                            <div key={lIdx} style={{ margin: '3px 0' }}>
                              <span>{prefix}</span>
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '2px 8px',
                                  background: 'rgba(56, 189, 248, 0.2)',
                                  border: '1px solid rgba(56, 189, 248, 0.5)',
                                  borderRadius: 4,
                                  color: '#38bdf8',
                                  textDecoration: 'none',
                                  fontWeight: 600,
                                  fontSize: 11,
                                }}
                              >
                                📥 {label}
                              </a>
                              <span>{suffix}</span>
                            </div>
                          );
                        }
                        return <div key={lIdx}>{line}</div>;
                      })}
                    </div>
                  ) : (
                    step.result.message
                  )}
                </div>
                {step.result.thumbnailUrl && (
                  <img src={step.result.thumbnailUrl} alt="Step observation" className="cua-step-thumb" />
                )}
              </div>
            );
          })
        )}
        {cuaStatus !== 'idle' && cuaStatus !== 'completed' && cuaStatus !== 'aborted' && (
          <div className="cua-running-hud">
            <RefreshCw size={13} className="spin-slow" style={{ color: '#34d399' }} />
            <span>Agent executing autonomous task ({cuaStatus})...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* CUA Input & Action Control */}
      <div className="copilot-input-area cua-input-area">
        <div className="copilot-input-row">
          <textarea
            className="copilot-textarea"
            placeholder="Command the agent with a computer task: e.g. (Sync camera from 3ds Max, branch canvas node, apply travertine texture with warm sunlight, and render)..."
            value={cuaGoal}
            onChange={(e) => setCuaGoal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleStartCuaTask();
              }
            }}
            rows={1}
            disabled={cuaStatus === 'acting' || cuaStatus === 'thinking' || cuaStatus === 'observing'}
          />
          {cuaStatus === 'acting' || cuaStatus === 'thinking' || cuaStatus === 'observing' ? (
            <button
              type="button"
              className="copilot-send-btn abort-btn"
              onClick={handleAbortCua}
              title="Emergency Stop Agent"
            >
              <Square size={13} />
            </button>
          ) : (
            <button
              type="button"
              className="copilot-send-btn cua-exec-btn"
              disabled={!cuaGoal.trim()}
              onClick={() => handleStartCuaTask()}
              title="Run Autonomous Task (CUA)"
            >
              <Play size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  )}
</div>
);
};

