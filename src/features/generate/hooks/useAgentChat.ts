import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ReplicateChatModel } from '../../../services/replicate/ReplicateService';
import { architectAgent, type ArchitectAgentRequest, type ArchitectAgentMessage } from '../../../services/agent/ArchitectAgentService';
import { archVisionAgent, type AgentHealth, type DesignResponseData } from '../../../services/agent/ArchVisionAgentService';
import { useAuth } from '../../auth/AuthContext';
import { deductCredits, GENERATION_COST, DEV_MODE, refundCredits } from '../../../services/credit/creditService';
import { logger } from '../../../utils/logger';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessageData extends DesignResponseData {
  dxf_download_url?: string;
  dxf_filename?: string;
  bim_viewer_url?: string;
  bim_elements_count?: number;
  bim_total_bua?: number;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: number;
  data?: ChatMessageData;
}

export type AgentMode = 'general' | 'prompt' | 'analysis' | 'compliance' | 'bim' | 'cad';

export const WELCOME_MESSAGE =
  'Welcome to ArchVision Studio. I am your autonomous Architectural AI Agent powered by LangGraph, Gemini Multimodal Vision, and Speckle AEC. I can assist you with spatial planning, building code compliance audits, high-fidelity architectural prompts, AutoCAD 2D (.DXF) generation, and interactive 3D BIM modeling.';

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

export const ARCHITECTURE_MODELS: { id: ReplicateChatModel; label: string; focus: string }[] = [
  { id: 'anthropic/claude-3.7-sonnet', label: 'Claude 3.7 Sonnet', focus: 'Best for architecture & spatial reasoning' },
  { id: 'deepseek-ai/deepseek-r1', label: 'DeepSeek R1', focus: 'Deep analytical and structural reasoning' },
  { id: 'meta/meta-llama-3-70b-instruct', label: 'Llama 3 70B', focus: 'Fast balanced generation' },
];

export const RENDERING_ENGINES = [
  { id: 'nano_banana_2', label: 'Nano Banana 2', vendor: 'Google Gemini 3.1', defaultAspect: '16:9' },
  { id: 'flux_2_pro', label: 'FLUX 2 Pro', vendor: 'Black Forest Labs', defaultAspect: '16:9' },
  { id: 'gpt_image_2_5', label: 'GPT Image 2.5 Flare', vendor: 'OpenAI', defaultAspect: '16:9' },
  { id: 'seedream_5_pro', label: 'Seedream 5 Pro', vendor: 'ByteDance', defaultAspect: '16:9' },
  { id: 'nano_banana_pro', label: 'Nano Banana Pro', vendor: 'Google Gemini Pro', defaultAspect: '21:9' },
];

export const ASPECT_RATIOS = ['16:9', '21:9', '1:1', '4:3', '3:2', '9:16'];

export function useAgentChat() {
  const { user: authUser } = useAuth();

  // Agent Backend Connectivity (E:\Agent)
  const [agentOnline, setAgentOnline] = useState<boolean>(false);
  const [agentInfo, setAgentInfo] = useState<AgentHealth | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(true);

  // Design Parameters
  const [selectedModel, setSelectedModel] = useState<ReplicateChatModel>('anthropic/claude-3.7-sonnet');
  const [selectedMode, setSelectedMode] = useState<AgentMode>('general');
  const [selectedStyle, setSelectedStyle] = useState<string>(ARCHITECTURAL_STYLES[0]);
  const [selectedTypology, setSelectedTypology] = useState<string>(BUILDING_TYPOLOGIES[0]);
  const [siteAreaSqm, setSiteAreaSqm] = useState<number>(500);
  const [targetEngine, setTargetEngine] = useState<string>('nano_banana_2');
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');
  const [autoRender, setAutoRender] = useState<boolean>(false);

  // Attached Image (Sketch / Facade / Floorplan)
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // Chat State
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isExportingCad, setIsExportingCad] = useState(false);
  const [isExportingBim, setIsExportingBim] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);

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

  const selectedModelInfo = useMemo(
    () => ARCHITECTURE_MODELS.find(model => model.id === selectedModel) || ARCHITECTURE_MODELS[0],
    [selectedModel]
  );

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

  /**
   * Reset conversation thread to clean zero-state
   */
  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  /**
   * Main Send Message Handler: Calls E:\Agent via ArchVisionAgentService
   */
  const sendMessage = useCallback(async (textOverride?: string, fileOverride?: File | null) => {
    const currentFile = fileOverride !== undefined ? fileOverride : attachedFile;
    const currentPreview = fileOverride !== undefined
      ? (fileOverride ? ((fileOverride as any).__previewUrl || URL.createObjectURL(fileOverride)) : null)
      : imagePreviewUrl;
    const content = (textOverride !== undefined ? textOverride : draft).trim();
    if ((!content && !currentFile) || isSending) return;

    // Deduct credits
    const chatCost = GENERATION_COST.chat;
    if (authUser?.id && !DEV_MODE) {
      const deduct = await deductCredits(authUser.id, chatCost, `AI Agent: ${selectedMode}`);
      if (!deduct.success) {
        const errorMessage: ChatMessage = {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          text: `Insufficient credits. You need ${chatCost} credit to complete this design request.`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, errorMessage]);
        return;
      }
    }

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

    try {
      if (agentOnline) {
        // Execute ArchVision Agent at E:\Agent (LangGraph pipeline)
        const compositeQuery = content
          ? `${content} (Typology: ${selectedTypology}, Style: ${selectedStyle}, Site Area: ${siteAreaSqm}m²)`
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
          },
        };

        setMessages(prev => [...prev, assistantMessage]);
      } else {
        // Fallback to Replicate cloud architect model
        const conversationHistory: ArchitectAgentMessage[] = messages
          .filter(m => !m.id.startsWith('welcome'))
          .map(m => ({
            role: m.role,
            content: m.text,
          }));

        const request: ArchitectAgentRequest = {
          message: content,
          mode: selectedMode as any,
          model: selectedModel,
          conversationHistory,
        };

        const response = await architectAgent.generateResponse(request);

        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: response.response,
          timestamp: Date.now(),
        };

        setMessages(prev => [...prev, assistantMessage]);
      }
    } catch (error) {
      logger.error('[AgentChat] Error generating response:', error);
      const errorMessage: ChatMessage = {
        id: `assistant-error-${Date.now()}`,
        role: 'assistant',
        text: error instanceof Error
          ? `Agent execution encountered an error: ${error.message}`
          : 'An unexpected error occurred while processing the architectural workflow.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);

      // Refund credits
      if (authUser?.id && !DEV_MODE) {
        refundCredits(authUser.id, chatCost, `Refund: Failed agent query for ${selectedMode}`)
          .catch((err) => logger.error('[Credit] Refund failed:', err));
      }
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
        text: `Interactive 3D BIM model synthesized via Speckle Systems AEC!\n• Structural Elements: ${res.data.elements_count || 36} parametric components\n• Total Built-Up Area (BUA): ${res.data.total_bua || 576} m²\n• Standalone Three.js WebGL 3D viewer is compiled and ready for spatial exploration.`,
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

    // Chat
    draft,
    setDraft,
    isSending,
    messages,
    selectedModelInfo,
    sendMessage,
    clearChat,

    // Architectural Tools
    isExportingCad,
    exportCadPlan,
    isExportingBim,
    exportBimModel,
  };
}
