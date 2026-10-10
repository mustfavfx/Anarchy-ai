import { useState, useMemo, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { architectAgent, parseCanvasActions, parseAutodeskActions, type ArchitectAgentRequest, type ArchitectAgentMessage } from '../../../services/agent/ArchitectAgentService';
import { archVisionAgent, type AgentHealth, type DesignResponseData } from '../../../services/agent/ArchVisionAgentService';
import { canvasContextEngine } from '../../../services/agent/CanvasContextEngine';
import { canvasBridge } from '../../../services/agent/CanvasBridgeService';
import { computerUseAgent, detectAutodeskIntent, formatCuaOutputMessage } from '../../../services/agent/ComputerUseAgentService';
import { cometApiService } from '../../../services/comet/CometApiService';
import { useAuth } from '../../auth/AuthContext';
import { logger } from '../../../utils/logger';
import { architecturalMaterialExtractor, type ArchitecturalMaterialPalette } from '../../../services/agent/ArchitecturalMaterialExtractor';
import { designDNAService, type ComplianceAuditReport } from '../../../services/agent/DesignDNAService';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessageData extends DesignResponseData {
  dxf_download_url?: string;
  dxf_filename?: string;
  bim_viewer_url?: string;
  bim_elements_count?: number;
  bim_total_bua?: number;
  cua_action_executed?: boolean;
  cua_action_title?: string;
  cua_software?: string;
  cua_script?: string;
  cua_status?: 'success' | 'queued' | 'failed' | 'idle';
  cua_output?: string;
  material_palette?: ArchitecturalMaterialPalette;
  compliance_audit?: ComplianceAuditReport;
  interactive_floorplan?: {
    buaM2?: number;
    floors?: number;
  };
}

export { formatCuaOutputMessage };

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: number;
  data?: ChatMessageData;
}

export type AgentMode = 'general' | 'prompt' | 'analysis' | 'compliance' | 'bim' | 'cad';

export const WELCOME_MESSAGE =
  'Welcome to ArchVision Generative Studio. I am connected directly to your canvas and 3D design workspace. I can synthesize architectural designs, audit building codes, generate DXF plans, and model parametric volumes in 3ds Max.';

export const ARCHITECTURAL_STYLES = [
  'Modern Contemporary',
  'Luxury Residential Villa',
  'Minimalist & Scandinavian',
  'Brutalist & Raw Concrete',
  'Modern Islamic & Mashrabiya',
  'Parametric & Biomorphic',
  'Neoclassical & Estate',
  'Sustainable Eco-Timber',
  'Futuristic High-Tech',
];

export const BUILDING_TYPOLOGIES = [
  'Residential Villa',
  'Commercial Office',
  'Mixed-Use Complex',
  'High-Rise Tower',
  'Hospitality & Resort',
  'Cultural Pavilion',
];

export const ARCHITECTURE_MODELS: {
  id: string;
  label: string;
  vendor: string;
  focus: string;
  badge?: string;
}[] = [
  {
    id: 'xai/grok-4-1-fast-reasoning',
    label: 'Grok 4.1 Fast Reasoning',
    vendor: 'xAI (CometAPI)',
    focus: 'Ultra-low latency architectural reasoning, instant script synthesis & spatial logic',
    badge: '⚡ Ultra Fast (~1.8s)',
  },
  {
    id: 'google/gemini-3.8-flash-thinking',
    label: 'Gemini 3.8 Flash Thinking',
    vendor: 'Google DeepMind (CometAPI)',
    focus: 'Fast multimodal spatial reasoning, visual facade parsing & rapid BIM synthesis',
    badge: '⚡ Instant (~1.5s)',
  },
  {
    id: 'minimax/minimax-m3-1-flash-preview',
    label: 'MiniMax M3.1 Flash',
    vendor: 'MiniMax (CometAPI)',
    focus: 'Ultra cost-effective & fastest drafts: 4–15 credits / 1M tokens (~2s)',
    badge: '⚡ Ultra Saver (4–15 credits)',
  },
  {
    id: 'anthropic/claude-sonnet-5-5',
    label: 'Claude Sonnet 5.5',
    vendor: 'Anthropic (CometAPI)',
    focus: 'Golden standard for premium spatial design: 20–85 credits / 1M tokens (~3.5s)',
    badge: '🏛️ Top Architecture (20–85 credits)',
  },
  {
    id: 'openai/gpt-6-1-sol',
    label: 'GPT-6.1 Sol',
    vendor: 'OpenAI (CometAPI)',
    focus: 'Engineering reasoning & accurate 3ds Max scripts: 20–85 credits / 1M tokens',
    badge: '🧠 Structural Logic (20–85 credits)',
  },
  {
    id: 'google/gemini-4-argon',
    label: 'Gemini 4 Argon',
    vendor: 'Google DeepMind (CometAPI)',
    focus: 'Multimodal visual facade analysis & BIM synthesis: 36–170 credits / 1M tokens',
    badge: '👁️ Vision & BIM (36–170 credits)',
  },
  {
    id: 'anthropic/claude-fable-5-1',
    label: 'Claude Fable 5.1',
    vendor: 'Anthropic (CometAPI)',
    focus: 'Architectural philosophy & avant-garde organic massing: 85–420 credits / 1M tokens',
    badge: '🎨 Avant-Garde (85–420 credits)',
  },
  {
    id: 'openai/gpt-6-astra',
    label: 'GPT-6 Astra',
    vendor: 'OpenAI (CometAPI)',
    focus: 'Titan reasoning model for major structural solutions: 85–420 credits / 1M tokens',
    badge: '👑 Giant Reasoning (85–420 credits)',
  },
  {
    id: 'xai/grok-5',
    label: 'Grok 5 / Grok 4.7',
    vendor: 'xAI (CometAPI)',
    focus: 'Analytical structural mechanics, real-time code generation & raw compute logic',
    badge: 'Advanced Logic 🚀',
  },
  {
    id: 'google/gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    vendor: 'Google Resident',
    focus: 'Live canvas awareness, real vision & sub-second response',
    badge: 'Resident AI ⚡',
  },
  {
    id: 'google/gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    vendor: 'Google DeepMind',
    focus: 'Multimodal spatial reasoning, high-throughput architectural synthesis',
    badge: 'Fast Multimodal',
  },
  {
    id: 'anthropic/claude-sonnet-5',
    label: 'Claude Sonnet 5',
    vendor: 'Anthropic',
    focus: 'State-of-the-art spatial reasoning & complex architectural design',
    badge: 'Top Architecture',
  },
  {
    id: 'anthropic/claude-fable-5',
    label: 'Claude Fable 5',
    vendor: 'Anthropic',
    focus: 'Architectural storytelling, concept narrative & avant-garde philosophy',
    badge: 'Creative Concept',
  },
  {
    id: 'openai/gpt-5.6-luna',
    label: 'GPT-5.6 Luna',
    vendor: 'OpenAI',
    focus: 'Deep engineering logic, spatial math & structural optimization',
    badge: 'Engineering',
  },
  {
    id: 'moonshotai/kimi-k2.6',
    label: 'Kimi K2.6',
    vendor: 'Moonshot AI',
    focus: 'Ultra-long context, building codes, zoning specifications & municipal bylaws',
    badge: 'Long Context',
  },
  {
    id: 'anthropic/claude-3.7-sonnet',
    label: 'Claude 3.7 Sonnet',
    vendor: 'Anthropic',
    focus: 'Hybrid reasoning & spatial design',
  },
  {
    id: 'deepseek-ai/deepseek-r1',
    label: 'DeepSeek R1',
    vendor: 'DeepSeek',
    focus: 'Deep analytical and structural reasoning',
  },
  {
    id: 'meta/meta-llama-3-70b-instruct',
    label: 'Llama 3 70B',
    vendor: 'Meta AI',
    focus: 'Open-weights fast generation',
  },
];

export const RENDERING_ENGINES = [
  { id: 'nano_banana_2', label: 'Nano Banana 2', vendor: 'Google Gemini 3.1', defaultAspect: '16:9' },
  { id: 'flux_2_pro', label: 'FLUX 2 Pro', vendor: 'Black Forest Labs', defaultAspect: '16:9' },
  { id: 'gpt_image_2_5', label: 'GPT Image 2.5 Flare', vendor: 'OpenAI', defaultAspect: '16:9' },
  { id: 'seedream_5_pro', label: 'Seedream 5 Pro', vendor: 'ByteDance', defaultAspect: '16:9' },
  { id: 'nano_banana_pro', label: 'Nano Banana Pro', vendor: 'Google Gemini Pro', defaultAspect: '21:9' },
];

export const ASPECT_RATIOS = ['16:9', '21:9', '1:1', '4:3', '3:2', '9:16'];

export interface AgentSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  model?: string;
  typology?: string;
  style?: string;
}

const SESSIONS_STORAGE_KEY = 'anarchy_ai_agent_sessions';
const ACTIVE_SESSION_ID_KEY = 'anarchy_ai_agent_active_session_id';
const LEGACY_MESSAGES_KEY = 'anarchy_ai_agent_messages';

export function useAgentChat() {
  const { user: authUser } = useAuth();

  // Agent Backend Connectivity (E:\Agent)
  const [agentOnline, setAgentOnline] = useState<boolean>(false);
  const [agentInfo, setAgentInfo] = useState<AgentHealth | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(true);

  // Check health on mount and periodically
  const refreshAgentHealth = useCallback(async () => {
    setIsCheckingHealth(true);
    try {
      const health = await archVisionAgent.checkHealth();
      setAgentOnline(health.online);
      setAgentInfo(health.info || null);
    } catch {
      setAgentOnline(false);
      setAgentInfo(null);
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  useEffect(() => {
    refreshAgentHealth();
    const interval = setInterval(refreshAgentHealth, 25000);
    return () => clearInterval(interval);
  }, [refreshAgentHealth]);

  // Design Parameters with persistent state across page navigation
  const [selectedModel, setSelectedModel] = useState<any>(() => {
    try {
      return localStorage.getItem('anarchy_agent_model') || 'google/gemini-3.6-flash';
    } catch {
      return 'google/gemini-3.6-flash';
    }
  });

  useEffect(() => {
    try {
      if (selectedModel) {
        localStorage.setItem('anarchy_agent_model', selectedModel);
      }
    } catch {}
  }, [selectedModel]);
  const selectedModelInfo = useMemo(
    () => ARCHITECTURE_MODELS.find(model => model.id === selectedModel) || ARCHITECTURE_MODELS[0],
    [selectedModel]
  );

  const [selectedMode, setSelectedMode] = useState<AgentMode>('general');
  const [selectedStyle, setSelectedStyle] = useState<string>(() => {
    try {
      return localStorage.getItem('anarchy_agent_style') || ARCHITECTURAL_STYLES[0];
    } catch {
      return ARCHITECTURAL_STYLES[0];
    }
  });
  const [selectedTypology, setSelectedTypology] = useState<string>(() => {
    try {
      return localStorage.getItem('anarchy_agent_typology') || BUILDING_TYPOLOGIES[0];
    } catch {
      return BUILDING_TYPOLOGIES[0];
    }
  });
  const [siteAreaSqm, setSiteAreaSqm] = useState<number>(() => {
    try {
      const s = localStorage.getItem('anarchy_agent_site_area');
      return s ? Number(s) : 500;
    } catch {
      return 500;
    }
  });
  const [targetEngine, setTargetEngine] = useState<string>(() => {
    try {
      return localStorage.getItem('anarchy_agent_engine') || 'nano_banana_2';
    } catch {
      return 'nano_banana_2';
    }
  });
  const [aspectRatio, setAspectRatio] = useState<string>(() => {
    try {
      return localStorage.getItem('anarchy_agent_aspect') || '16:9';
    } catch {
      return '16:9';
    }
  });
  const [autoRender, setAutoRender] = useState<boolean>(false);

  // Sync parameter changes to localStorage
  useEffect(() => {
    try { localStorage.setItem('anarchy_agent_style', selectedStyle); } catch {}
  }, [selectedStyle]);
  useEffect(() => {
    try { localStorage.setItem('anarchy_agent_typology', selectedTypology); } catch {}
  }, [selectedTypology]);
  useEffect(() => {
    try { localStorage.setItem('anarchy_agent_site_area', String(siteAreaSqm)); } catch {}
  }, [siteAreaSqm]);
  useEffect(() => {
    try { localStorage.setItem('anarchy_agent_engine', targetEngine); } catch {}
  }, [targetEngine]);
  useEffect(() => {
    try { localStorage.setItem('anarchy_agent_aspect', aspectRatio); } catch {}
  }, [aspectRatio]);

  // Attached Image (Sketch / Facade / Floorplan)
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const setAttachedImageFile = useCallback((file: File | null) => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setAttachedFile(file);
    if (file) {
      setImagePreviewUrl(URL.createObjectURL(file));
    } else {
      setImagePreviewUrl(null);
    }
  }, [imagePreviewUrl]);

  // Multi-Session Chat State with localStorage persistence
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isExportingCad, setIsExportingCad] = useState(false);
  const [isExportingBim, setIsExportingBim] = useState(false);

  const [sessions, setSessions] = useState<AgentSession[]>(() => {
    try {
      const saved = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      // Migrate legacy single-thread messages if present
      const legacy = localStorage.getItem(LEGACY_MESSAGES_KEY);
      if (legacy) {
        const parsedMsgs = JSON.parse(legacy);
        if (Array.isArray(parsedMsgs) && parsedMsgs.length > 0) {
          const firstUser = parsedMsgs.find((m: ChatMessage) => m.role === 'user');
          const title = firstUser?.text ? firstUser.text.slice(0, 32).trim() : 'Previous Session';
          return [{
            id: `session-legacy-${Date.now()}`,
            title,
            createdAt: parsedMsgs[0]?.timestamp || Date.now(),
            updatedAt: parsedMsgs[parsedMsgs.length - 1]?.timestamp || Date.now(),
            messages: parsedMsgs,
          }];
        }
      }
    } catch (e) {
      logger.warn('[AgentChat] Failed to restore sessions from localStorage:', e);
    }
    const initialId = `session-${Date.now()}`;
    return [{
      id: initialId,
      title: 'New Architectural Session',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    }];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(ACTIVE_SESSION_ID_KEY);
      if (savedId) return savedId;
    } catch {}
    return '';
  });

  // Ensure activeSessionId points to an existing session
  useEffect(() => {
    if (!sessions.some(s => s.id === activeSessionId)) {
      if (sessions.length > 0) {
        setActiveSessionId(sessions[0].id);
      }
    }
  }, [sessions, activeSessionId]);

  // Persist sessions
  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
      if (activeSessionId) {
        localStorage.setItem(ACTIVE_SESSION_ID_KEY, activeSessionId);
      }
    } catch (e) {
      logger.warn('[AgentChat] Failed to persist sessions:', e);
    }
  }, [sessions, activeSessionId]);

  const activeSession = useMemo(() => {
    return sessions.find(s => s.id === activeSessionId) || sessions[0];
  }, [sessions, activeSessionId]);

  const messages = activeSession?.messages || [];

  const setMessages = useCallback((updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setSessions(prevSessions => {
      const targetId = activeSessionId || (prevSessions[0]?.id);
      return prevSessions.map(sess => {
        if (sess.id !== targetId) return sess;
        const currentMsgs = sess.messages || [];
        const nextMsgs = typeof updater === 'function' ? updater(currentMsgs) : updater;

        let newTitle = sess.title;
        if ((!newTitle || newTitle === 'New Architectural Session' || newTitle === 'محادثة معمارية جديدة' || newTitle === 'جلسة جديدة' || newTitle === 'New Chat') && nextMsgs.length > 0) {
          const firstUser = nextMsgs.find(m => m.role === 'user');
          if (firstUser && firstUser.text) {
            newTitle = firstUser.text.replace(/[\r\n]+/g, ' ').trim().slice(0, 36) || 'Architectural Session';
          }
        }

        return {
          ...sess,
          title: newTitle,
          messages: nextMsgs,
          updatedAt: Date.now(),
        };
      });
    });
  }, [activeSessionId]);

  const createNewSession = useCallback((initialTitle?: string): string => {
    const newId = `session-${Date.now()}`;
    const newSession: AgentSession = {
      id: newId,
      title: initialTitle || 'New Architectural Session',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
      model: selectedModel,
      typology: selectedTypology,
      style: selectedStyle,
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    setDraft('');
    setAttachedFile(null);
    setImagePreviewUrl(null);
    return newId;
  }, [selectedModel, selectedTypology, selectedStyle]);

  const switchSession = useCallback((sessionId: string) => {
    if (sessions.some(s => s.id === sessionId)) {
      setActiveSessionId(sessionId);
      setDraft('');
      setAttachedFile(null);
      setImagePreviewUrl(null);
    }
  }, [sessions]);

  const renameSession = useCallback((sessionId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, title: trimmed, updatedAt: Date.now() } : s));
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    setSessions(prev => {
      const remaining = prev.filter(s => s.id !== sessionId);
      if (remaining.length === 0) {
        const freshId = `session-${Date.now()}`;
        setActiveSessionId(freshId);
        return [{
          id: freshId,
          title: 'New Architectural Session',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [],
        }];
      }
      if (activeSessionId === sessionId) {
        setActiveSessionId(remaining[0].id);
      }
      return remaining;
    });
  }, [activeSessionId]);

  const clearAllSessions = useCallback(() => {
    const freshId = `session-${Date.now()}`;
    const fresh: AgentSession = {
      id: freshId,
      title: 'New Architectural Session',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setSessions([fresh]);
    setActiveSessionId(freshId);
    setDraft('');
    setAttachedFile(null);
    setImagePreviewUrl(null);
    try {
      localStorage.removeItem(SESSIONS_STORAGE_KEY);
      localStorage.removeItem(LEGACY_MESSAGES_KEY);
    } catch {}
  }, []);

  const deleteMessage = useCallback((messageId: string) => {
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, [setMessages]);

  const clearChat = useCallback(() => {
    setMessages([]);
  }, [setMessages]);

  /**
   * Main Send Message Handler: Calls resident Antigravity Architectural AI Agent
   * AI Agent chat is 100% FREE (0 credits consumed).
   */
  const sendMessage = useCallback(async (textOverride?: string, fileOverride?: File | null) => {
    const currentFile = fileOverride !== undefined ? fileOverride : attachedFile;
    const currentPreview = fileOverride !== undefined
      ? (fileOverride ? ((fileOverride as any).__previewUrl || URL.createObjectURL(fileOverride)) : null)
      : imagePreviewUrl;
    const content = (textOverride !== undefined ? textOverride : draft).trim();
    if ((!content && !currentFile) || isSending) return;

    // AI Agent Chat is Free (0 credits deducted)

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: content || (currentFile ? `[Attached architectural image: ${currentFile.name}]` : ''),
      timestamp: Date.now(),
      data: currentPreview ? { rendered_image_url: currentPreview } : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setDraft('');
    setAttachedFile(null);
    setImagePreviewUrl(null);
    setIsSending(true);
    let currentAssistantMsgId: string | null = null;

    try {
      // 0. Check client-side Autodesk Intent (to be executed if model does not produce actions)
      const autodeskIntent = detectAutodeskIntent(content);

      // 1. Live Canvas Awareness & Comparative Diagnosis (AgentCanvas + Morpheus)
      const isComparisonQuery = /قارن|compare|أسوأ|افضل|أفضل|النتيجة الثانية|النتيجة الأولى|الفرق|فروقات|diff|versus|vs/i.test(content);
      const canvasGraph = canvasContextEngine.getCanvasGraph();
      const imageNodes = canvasGraph.nodes.filter(n => !!n.image || !!n.originalImage);

      if (isComparisonQuery && imageNodes.length >= 2) {
        const selected = canvasContextEngine.getSelectedNode();
        let nodeA = imageNodes[imageNodes.length - 2];
        let nodeB = imageNodes[imageNodes.length - 1];

        if (selected && selected.parentNodes.length > 0) {
          const parent = canvasContextEngine.getNode(selected.parentNodes[0]);
          if (parent && (parent.image || parent.originalImage)) {
            nodeA = parent;
            nodeB = selected;
          }
        }

        try {
          const report = await canvasContextEngine.compareNodes(nodeA.id, nodeB.id);
          const scoreAStr = typeof report.nodeA.score === 'number' && report.nodeA.score > 0 ? `${report.nodeA.score}/100` : 'Unverified';
          const scoreBStr = typeof report.nodeB.score === 'number' && report.nodeB.score > 0 ? `${report.nodeB.score}/100` : 'Unverified';
          const assistantMessage: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            text: `📊 **Architectural Comparison & Diagnosis (Canvas Context Engine):**\n\n` +
              `• **First Node [${report.nodeA.label || nodeA.id.slice(0, 6)}]:** Realism Rating (${scoreAStr})\n` +
              `• **Second Node [${report.nodeB.label || nodeB.id.slice(0, 6)}]:** Realism Rating (${scoreBStr})\n\n` +
              `🔍 **Architectural Diagnosis:**\n${report.expertExplanation}\n\n` +
              (report.actionableRecommendations.length > 0 ? `💡 **Recommended Modifications:**\n` + report.actionableRecommendations.map(r => `• ${r}`).join('\n') : ''),
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, assistantMessage]);
          setIsSending(false);
          return;
        } catch (compErr) {
          logger.warn('[AgentChat] Direct node comparison fallback:', compErr);
        }
      }

      const canvasContextSummary = canvasContextEngine.getCanvasSummaryForAgent();
      const enrichedQuery = canvasContextSummary && canvasContextSummary !== 'Canvas is currently empty.'
        ? `${content}\n\n[Live Canvas Context: ${canvasContextSummary}]`
        : content;

      if (agentOnline && !cometApiService.isCometModel(selectedModel)) {
        // Execute ArchVision Agent at E:\Agent (LangGraph pipeline)
        const compositeQuery = enrichedQuery
          ? `${enrichedQuery} (Typology: ${selectedTypology}, Style: ${selectedStyle}, Site Area: ${siteAreaSqm}m²)`
          : `Analyze and design for ${selectedTypology} in ${selectedStyle} style on ${siteAreaSqm}m² site`;

        let res;
        if (currentFile) {
          res = await archVisionAgent.designFromImage(currentFile, currentFile.name, {
            user_query: compositeQuery,
            site_area_sqm: siteAreaSqm,
            architectural_style: selectedStyle,
            target_engine: targetEngine,
            auto_render: autoRender,
          });
        } else {
          res = await archVisionAgent.designFromText({
            user_query: compositeQuery,
            site_area_sqm: siteAreaSqm,
            architectural_style: selectedStyle,
            target_engine: targetEngine,
            auto_render: autoRender,
          });
        }

        const data = res.data;
        const mainSummary = data.final_summary || data.vision_analysis || 'Architectural planning and synthesis completed successfully.';

        let cuaResult: { success: boolean; message: string; output?: string } | null = null;
        if (autodeskIntent) {
          try {
            if (autodeskIntent.action === 'cua_task' || autodeskIntent.isVisualCua) {
              const outcome = await computerUseAgent.executeAutonomousTask(content, {
                maxSteps: 25,
              });
              cuaResult = { success: outcome.success, message: outcome.message, output: outcome.message };
            } else {
              cuaResult = await computerUseAgent.executeAutodeskCommand({
                software: autodeskIntent.software,
                action: autodeskIntent.action as any,
                script: autodeskIntent.script,
                autoLaunch: true,
              });
            }
          } catch (cuaErr) {
            logger.warn('[AgentChat] CUA execution error:', cuaErr);
          }
        }

        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: mainSummary,
          timestamp: Date.now(),
          data: {
            ...data,
            rendered_image_url: data.rendered_image_url
              ? archVisionAgent.getDownloadUrl(data.rendered_image_url)
              : undefined,
            cua_action_executed: !!autodeskIntent,
            cua_action_title: autodeskIntent?.description,
            cua_software: autodeskIntent?.software || '3dsmax',
            cua_script: autodeskIntent?.script,
            cua_status: cuaResult ? (cuaResult.success ? 'success' : 'failed') : (autodeskIntent ? 'queued' : 'idle'),
            cua_output: formatCuaOutputMessage(cuaResult?.output || cuaResult?.message),
          },
        };

        setMessages(prev => [...prev, assistantMessage]);
      } else {
        // Execute Resident Antigravity Gemini Architectural Agent
        const conversationHistory: ArchitectAgentMessage[] = messages
          .filter(m => !m.id.startsWith('welcome') && !m.id.startsWith('assistant-error'))
          .map(m => {
            let content = m.text;
            if (m.role === 'assistant' && m.data?.cua_action_executed && m.data?.cua_output) {
              content += `\n[3ds Max Environment State: ${m.data.cua_output}]`;
            }
            return {
              role: m.role,
              content,
            };
          });

        let fileBase64: string | undefined = undefined;
        if (currentFile) {
          try {
            fileBase64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => resolve('');
              reader.readAsDataURL(currentFile);
            });
          } catch {
            // ignore
          }
        }

        const assistantMsgId = `assistant-${Date.now()}`;
        currentAssistantMsgId = assistantMsgId;
        const initialAssistantMsg: ChatMessage = {
          id: assistantMsgId,
          role: 'assistant',
          text: '...',
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, initialAssistantMsg]);

        const request: ArchitectAgentRequest = {
          message: content,
          mode: selectedMode as any,
          model: selectedModel,
          conversationHistory,
          attachedImageBase64: fileBase64,
          onChunk: (_delta, accumulated) => {
            const displayPreview = accumulated
              .replace(/\[CanvasAction:[\s\S]*?\]/gi, '')
              .replace(/CanvasAction:\s*\{[\s\S]*?\}/gi, '')
              .replace(/\[AutodeskAction:[\s\S]*?\]/gi, '')
              .replace(/AutodeskAction:\s*\{[\s\S]*?\}/gi, '')
              .trim();
            if (displayPreview) {
              setMessages(prev =>
                prev.map(m => (m.id === assistantMsgId ? { ...m, text: displayPreview } : m))
              );
            }
          },
        };

        const response = await architectAgent.generateResponse(request);

        // Parse any CanvasActions & AutodeskActions from reply
        const rawReply = response.response;
        const actions = parseCanvasActions(rawReply);
        const autodeskActions = response.autodeskActions || parseAutodeskActions(rawReply);

        // Execute all AutodeskActions produced by the model (or fallback to autodeskIntent if none produced)
        const executedOutputs: string[] = [];
        let autodeskRan = false;
        let allSuccess = true;
        let actionTitles: string[] = [];

        if (autodeskActions.length > 0) {
          autodeskRan = true;
          // Sort Autodesk actions in logical architectural pipeline order:
          // 0: Levels -> 1: Massing/Walls/Floors -> 2: Openings (Doors/Windows) -> 3: Materials -> 4: Sun/Lighting -> 5: Camera -> 6: Viewport/Render -> 7: BIM Data -> 8: Export
          const actionOrderScore = (act: any): number => {
            const name = (act.tool_name || act.action || '').toLowerCase();
            if (name.includes('create_level') || name.includes('level')) return 0;
            if (name.includes('create_box') || name.includes('box') || name.includes('house') || name.includes('villa') || name.includes('mass') || name.includes('wall') || name.includes('floor')) return 1;
            if (name.includes('opening') || name.includes('door') || name.includes('window')) return 2;
            if (name.includes('apply_material') || name.includes('material')) return 3;
            if (name.includes('setup_sun') || name.includes('lighting') || name.includes('sun')) return 4;
            if (name.includes('set_camera') || name.includes('camera') || name.includes('set_3d_view')) return 5;
            if (name.includes('render_preview') || name.includes('export_active_view') || name.includes('viewport_sync')) return 6;
            if (name.includes('get_scene_info') || name.includes('extract_bim') || name.includes('get_model_summary')) return 7;
            if (name.includes('export_model')) return 8;
            return 10;
          };
          autodeskActions.sort((a, b) => actionOrderScore(a) - actionOrderScore(b));

          // Batch pre-flight: ensure software is launched and connector is online ONCE for the batch
          const primarySoftware = autodeskActions[0]?.software || '3dsmax';
          const isVisualTask = autodeskActions.some(a => a.action === 'cua_task' || a.software === 'revit');
          let preflightConnected = true;

          if (!isVisualTask) {
            try {
              const isOnline = await invoke<boolean>('cua_is_connector_online', { software: primarySoftware });
              if (!isOnline) {
                logger.log(`[AgentChat] Preflight: ${primarySoftware} not online. Launching app and waiting for connector heartbeat...`);
                await invoke('cua_launch_app', { appName: primarySoftware });
                preflightConnected = await invoke<boolean>('cua_wait_for_connector', { software: primarySoftware, timeoutSecs: 55 });
              }
            } catch (preflightErr) {
              logger.warn('[AgentChat] Preflight connector check notice:', preflightErr);
            }
          }

          if (!preflightConnected && !isVisualTask) {
            allSuccess = false;
            actionTitles = autodeskActions.map(a => a.tool_name || a.description || a.action);
            executedOutputs.push(`${primarySoftware} connector did not respond within timeout. Please ensure ${primarySoftware} is running with the Anarchy AI plugin active.`);
          } else {
            for (const act of autodeskActions) {
              actionTitles.push(act.tool_name || act.description || act.action);
              try {
                let res: { success: boolean; message: string; output?: string };
                if (act.action === 'cua_task') {
                  const outcome = await computerUseAgent.executeAutonomousTask(content, {
                    maxSteps: 25,
                    onStep: (stepRecord) => {
                      logger.log('[AgentChat] CUA live step:', stepRecord.step, stepRecord.thought);
                    },
                  });
                  res = { success: outcome.success, message: outcome.message, output: outcome.message };
                } else if (act.action === 'tool_call' && act.tool_name) {
                  res = await computerUseAgent.executeAction({
                    type: 'tool_call',
                    autodeskSoftware: act.software,
                    toolName: act.tool_name,
                    toolParameters: act.params,
                    autoLaunch: false,
                  } as any);
                } else {
                  res = await computerUseAgent.executeAutodeskCommand({
                    software: act.software,
                    action: act.action as any,
                    script: act.script,
                    autoLaunch: false,
                  });
                }
                if (!res.success) allSuccess = false;
                if (res.output || res.message) executedOutputs.push(res.output || res.message);
              } catch (err: any) {
                allSuccess = false;
                executedOutputs.push(`Failed executing ${act.tool_name || act.action}: ${err?.message || err}`);
              }
            }
          }
        } else if (autodeskIntent) {
          autodeskRan = true;
          actionTitles.push(autodeskIntent.description);
          try {
            if (autodeskIntent.action === 'cua_task' || autodeskIntent.isVisualCua) {
              const outcome = await computerUseAgent.executeAutonomousTask(content, {
                maxSteps: 25,
                onStep: (stepRecord) => {
                  logger.log('[AgentChat] CUA live step:', stepRecord.step, stepRecord.thought);
                },
              });
              allSuccess = outcome.success;
              if (outcome.message) executedOutputs.push(outcome.message);
            } else {
              const res = await computerUseAgent.executeAutodeskCommand({
                software: autodeskIntent.software,
                action: autodeskIntent.action as any,
                script: autodeskIntent.script,
                autoLaunch: true,
              });
              allSuccess = res.success;
              if (res.output || res.message) executedOutputs.push(res.output || res.message);
            }
          } catch (err: any) {
            allSuccess = false;
            executedOutputs.push(`Failed executing Autodesk command: ${err?.message || err}`);
          }
        }

        // Also parse unbracketed CanvasAction: { ... } if any
        const unbracketedMatch = rawReply.match(/CanvasAction:\s*(\{[\s\S]*?\})/i);
        if (unbracketedMatch) {
          try {
            const parsed = JSON.parse(unbracketedMatch[1]);
            if (parsed.type && !actions.some(a => a.type === parsed.type)) {
              actions.push(parsed);
            }
          } catch {}
        }

        // Auto-execute CanvasActions on the active canvas
        for (const act of actions) {
          try {
            await canvasBridge.executeCanvasAction(act);
          } catch (actErr) {
            logger.warn('[AgentChat] Auto-execute canvas action error:', actErr);
          }
        }

        // Clean out raw JSON action blocks so user sees only pristine architectural thought
        const cleanedText = rawReply
          .replace(/\[CanvasAction:[\s\S]*?\]/gi, '')
          .replace(/CanvasAction:\s*\{[\s\S]*?\}/gi, '')
          .replace(/\[AutodeskAction:[\s\S]*?\]/gi, '')
          .replace(/AutodeskAction:\s*\{[\s\S]*?\}/gi, '')
          .trim();

        // 1. Material Extractor & Palette Detection
        let extractedPalette: ArchitecturalMaterialPalette | undefined = undefined;
        const wantsMaterials = actions.some(a => a.type === 'extract_materials') ||
          /material|خامات|مواد|palette|باليت|ترافرتين|رخام|حجر|خرسانة|كسوة/i.test(content) ||
          /material|خامات|مواد|palette|باليت/i.test(cleanedText);

        if (wantsMaterials) {
          if (fileBase64) {
            try {
              extractedPalette = await architecturalMaterialExtractor.extractFromImage(fileBase64, content);
            } catch {
              extractedPalette = architecturalMaterialExtractor.getDefaultPalette();
            }
          } else {
            extractedPalette = architecturalMaterialExtractor.getDefaultPalette();
          }
        }

        // 2. Local Building Code & Design DNA Compliance Audit Detection
        let complianceReport: ComplianceAuditReport | undefined = undefined;
        const wantsCompliance = actions.some(a => a.type === 'audit_compliance') ||
          /compliance|كود|كود البناء|sbc|ارتداد|setback|تغطية|coverage|بلدية|municipality|كود وادي حنيفة|كود الرياض/i.test(content) ||
          /compliance|كود|sbc|ارتداد|setback/i.test(cleanedText);

        if (wantsCompliance) {
          let dnaId = 'salmani';
          if (/dubai|دبي|luxury/i.test(content) || selectedStyle.toLowerCase().includes('luxury')) {
            dnaId = 'dubai_luxury';
          } else if (/zaha|بارامتري|parametric/i.test(content) || selectedStyle.toLowerCase().includes('parametric')) {
            dnaId = 'zaha_parametric';
          } else if (/japandi|scandinavian|minimal/i.test(content) || selectedStyle.toLowerCase().includes('minimalist')) {
            dnaId = 'japandi_minimalist';
          }

          const codeId = dnaId === 'dubai_luxury' ? 'DUBAI_MUNICIPALITY' : 'SBC_1101';
          complianceReport = designDNAService.auditCompliance(dnaId, codeId, {
            siteAreaM2: siteAreaSqm || 650,
          });
        }

        // 3. Interactive Floor Plan & CAD Vector Viewer Detection
        let floorPlanData: { buaM2?: number; floors?: number } | undefined = undefined;
        const wantsFloorPlan = selectedMode === 'cad' ||
          /مخطط|مسقط|floor plan|dxf|توزيع الفراغات|فراغات|توزيع معماري|مساقط/i.test(content) ||
          /مخطط|مسقط|floor plan|dxf/i.test(cleanedText);

        if (wantsFloorPlan) {
          floorPlanData = {
            buaM2: Math.round((siteAreaSqm || 500) * 0.58),
            floors: 2,
          };
        }

        const assistantMessage: ChatMessage = {
          id: assistantMsgId,
          role: 'assistant',
          text: cleanedText,
          timestamp: Date.now(),
          data: {
            ...(response.enhancedPrompt ? { enhanced_prompt: response.enhancedPrompt } : {}),
            cua_action_executed: autodeskRan || actions.length > 0,
            cua_action_title: autodeskRan
              ? (actionTitles.length === 1 ? actionTitles[0] : `Executed ${actionTitles.length} 3ds Max Tools: ${actionTitles.join(', ')}`)
              : (actions[0]?.type ? `Canvas Action: ${actions[0].type}` : undefined),
            cua_software: autodeskActions[0]?.software || autodeskIntent?.software || '3dsmax',
            cua_script: autodeskActions.map(a => a.tool_name || a.script || '').filter(Boolean).join(' | ') || autodeskIntent?.script,
            cua_status: autodeskRan ? (allSuccess ? 'success' : 'failed') : (actions.length > 0 ? 'success' : 'idle'),
            cua_output: executedOutputs.map(o => formatCuaOutputMessage(o) || o).join('\n') || undefined,
            ...(extractedPalette ? { material_palette: extractedPalette } : {}),
            ...(complianceReport ? { compliance_audit: complianceReport } : {}),
            ...(floorPlanData ? { interactive_floorplan: floorPlanData } : {}),
          },
        };

        setMessages(prev => prev.map(m => (m.id === assistantMsgId ? assistantMessage : m)));
      }
    } catch (error) {
      logger.error('[AgentChat] Error generating response:', error);
      const errText = error instanceof Error
        ? `Agent execution encountered an error: ${error.message}`
        : 'An unexpected error occurred while processing the architectural workflow.';
      setMessages(prev => {
        if (currentAssistantMsgId && prev.some(m => m.id === currentAssistantMsgId)) {
          return prev.map(m => (m.id === currentAssistantMsgId ? { ...m, text: errText } : m));
        }
        return [
          ...prev,
          {
            id: `assistant-error-${Date.now()}`,
            role: 'assistant',
            text: errText,
            timestamp: Date.now(),
          },
        ];
      });
    } finally {
      setIsSending(false);
    }
  }, [
    draft,
    attachedFile,
    imagePreviewUrl,
    isSending,
    authUser,
    selectedMode,
    agentOnline,
    siteAreaSqm,
    selectedStyle,
    selectedTypology,
    targetEngine,
    autoRender,
    messages,
    selectedModel,
  ]);

  /**
   * Export AutoCAD 2D DXF Floor Plan
   */
  const exportCadPlan = useCallback(async (customWidth?: number, customLength?: number) => {
    if (isExportingCad) return;
    setIsExportingCad(true);

    try {
      const plotWidth = customWidth || 20.0;
      const plotLength = customLength || Math.max(siteAreaSqm / plotWidth, 20.0);

      const res = await archVisionAgent.exportCad({
        project_title: `${selectedTypology} - ${selectedStyle} (${siteAreaSqm} m²)`,
        plot_width: plotWidth,
        plot_length: plotLength,
        front_setback: 3.0,
        side_setback: 2.0,
        rear_setback: 2.0,
      });

      const fullUrl = archVisionAgent.getDownloadUrl(res.download_url);

      const msg: ChatMessage = {
        id: `cad-${Date.now()}`,
        role: 'assistant',
        text: `AutoCAD 2D architectural floor plan (.DXF) generated with regulatory setbacks and room zoning for a ${siteAreaSqm} m² site.\nThe file is formatted for instant CAD import into AutoCAD, Revit, or Rhino.`,
        timestamp: Date.now(),
        data: {
          dxf_download_url: fullUrl,
          dxf_filename: res.filename,
        },
      };

      setMessages(prev => [...prev, msg]);

      // Auto trigger download
      const a = document.createElement('a');
      a.href = fullUrl;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      logger.error('[CAD Export] Failed:', err);
      const errMsg: ChatMessage = {
        id: `cad-error-${Date.now()}`,
        role: 'assistant',
        text: `AutoCAD DXF export failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsExportingCad(false);
    }
  }, [isExportingCad, siteAreaSqm, selectedTypology, selectedStyle]);

  /**
   * Export 3D BIM Speckle Model & Viewer
   */
  const exportBimModel = useCallback(async () => {
    if (isExportingBim) return;
    setIsExportingBim(true);

    try {
      const res = await archVisionAgent.exportBim({
        project_title: `${selectedTypology} BIM (${siteAreaSqm} m²)`,
        site_area_sqm: siteAreaSqm,
      });

      const viewerPath = res.data.viewer_web_url;
      const fullViewerUrl = viewerPath ? archVisionAgent.getDownloadUrl(viewerPath) : '';

      const msg: ChatMessage = {
        id: `bim-${Date.now()}`,
        role: 'assistant',
        text: `Interactive 3D BIM model synthesized via Speckle Systems AEC!\n` +
          (res.data.elements_count ? `• Structural Elements: ${res.data.elements_count} parametric components\n` : '') +
          (res.data.total_bua ? `• Total Built-Up Area (BUA): ${res.data.total_bua} m²\n` : '') +
          `• Standalone Three.js WebGL 3D viewer is compiled and ready for spatial exploration.`,
        timestamp: Date.now(),
        data: {
          bim_viewer_url: fullViewerUrl,
          bim_elements_count: res.data.elements_count,
          bim_total_bua: res.data.total_bua,
        },
      };

      setMessages(prev => [...prev, msg]);

      if (fullViewerUrl) {
        window.open(fullViewerUrl, '_blank');
      }
    } catch (err) {
      logger.error('[BIM Export] Failed:', err);
      const errMsg: ChatMessage = {
        id: `bim-error-${Date.now()}`,
        role: 'assistant',
        text: `3D BIM generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsExportingBim(false);
    }
  }, [isExportingBim, siteAreaSqm, selectedTypology]);

  /**
   * Dispatches parametric 3D modeling scripts to Autodesk 3ds Max or Blender 4.x
   */
  const execute3DModeling = useCallback(async (software: '3dsmax' | 'blender') => {
    if (software === '3dsmax') {
      const maxScript = `
-- Anarchy AI Autonomous Massing Generator
resetMaxFile #noPrompt
units.DisplayType = #Metric
units.MetricType = #Meters

b_site = Box length:30 width:25 height:0.2 pos:[0,0,0] name:"Site_Podium"
b_site.wirecolor = color 180 175 165

b_gf_west = Box length:14 width:11 height:3.8 pos:[-5,2,0.2] name:"Ground_West_Wing"
b_gf_west.wirecolor = color 225 218 205
b_gf_east = Box length:14 width:11 height:3.8 pos:[8,2,0.2] name:"Ground_East_Wing"
b_gf_east.wirecolor = color 225 218 205

pool = Box length:8 width:7 height:0.4 pos:[1.5,2,0.1] name:"Central_Courtyard_Pool"
pool.wirecolor = color 60 130 180

b_ff = Box length:15 width:18 height:3.6 pos:[1,0,4.0] name:"FirstFloor_Cantilever"
b_ff.wirecolor = color 240 235 228

c = TargetCamera pos:[28,-26,14] target:(Targetobject pos:[0,0,3])
viewport.setCamera c
max select all
completeredraw()
`;
      try {
        await computerUseAgent.executeAutodeskCommand({
          software: '3dsmax',
          action: 'execute_script',
          script: maxScript,
          autoLaunch: true,
        });
      } catch (err) {
        logger.warn('[AgentChat] Failed to launch 3ds Max script:', err);
      }
    } else {
      const blenderScript = `# Anarchy AI Autonomous Floorplan Generator for Blender 4.x
import bpy

bpy.ops.wm.read_factory_settings(use_empty=True)

# Ground Floor Wings
bpy.ops.mesh.primitive_cube_add(size=1, location=(-2.5, 1, 1.9))
gf_west = bpy.context.active_object
gf_west.name = "Ground_West_Wing"
gf_west.scale = (11, 14, 3.8)

bpy.ops.mesh.primitive_cube_add(size=1, location=(4, 1, 1.9))
gf_east = bpy.context.active_object
gf_east.name = "Ground_East_Wing"
gf_east.scale = (11, 14, 3.8)

# Cantilever First Floor
bpy.ops.mesh.primitive_cube_add(size=1, location=(0.5, 0, 5.8))
ff = bpy.context.active_object
ff.name = "FirstFloor_Cantilever"
ff.scale = (18, 15, 3.6)

# Sun & Camera
bpy.ops.object.camera_add(location=(22, -20, 12), rotation=(1.1, 0, 0.8))
bpy.context.scene.camera = bpy.context.active_object
bpy.ops.object.light_add(type='SUN', location=(10, -10, 15))
`;
      const blob = new Blob([blenderScript], { type: 'text/x-python' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'anarchy_blender_massing.py';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, []);

  return {
    // Backend Connectivity
    agentOnline,
    agentInfo,
    isCheckingHealth,
    refreshAgentHealth,

    // Design parameters
    selectedModel,
    setSelectedModel,
    selectedMode,
    setSelectedMode,
    selectedStyle,
    setSelectedStyle,
    selectedTypology,
    setSelectedTypology,
    siteAreaSqm,
    setSiteAreaSqm,
    targetEngine,
    setTargetEngine,
    aspectRatio,
    setAspectRatio,
    autoRender,
    setAutoRender,

    // Attached Image
    attachedFile,
    imagePreviewUrl,
    setAttachedImageFile,

    // Chat & Sessions
    draft,
    setDraft,
    isSending,
    messages,
    selectedModelInfo,
    sendMessage,
    clearChat,
    deleteMessage,

    sessions,
    activeSessionId,
    activeSession,
    createNewSession,
    switchSession,
    renameSession,
    deleteSession,
    clearAllSessions,

    // Architectural Tools
    isExportingCad,
    exportCadPlan,
    isExportingBim,
    exportBimModel,
    execute3DModeling,
  };
}
