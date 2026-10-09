/**
 * ComputerUseAgentService (CUA Engine)
 * 
 * SOTA Multimodal Computer-Using Agent engine operating Anarchy AI Canvas,
 * Autodesk 3ds Max / AutoCAD / Revit, and Windows OS desktop with surgical precision.
 * 
 * Architecture inspired by OpenAI CUA pattern:
 * Observe -> Think -> Act -> Verify -> Self-Correct Loop
 */

import { invoke } from '@tauri-apps/api/core';
import { canvasBridge } from './CanvasBridgeService';
import type { CanvasAction } from './ArchitecturalUnderstanding';
import { useAIConfigStore, type SelectedNodeInfo } from '../../stores/aiConfigStore';
import { geminiAgentService } from '../gemini/GeminiAgentService';
import { archVisionAgent } from './ArchVisionAgentService';
import { logger } from '../../utils/logger';

export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowInfo {
  id: number;
  title: string;
  process_id: number;
  rect: WindowRect;
  is_autodesk: boolean;
  is_minimized: boolean;
}

export interface ScreenCaptureResult {
  image: string;
  width: number;
  height: number;
  original_width?: number;
  original_height?: number;
  origin_x?: number;
  origin_y?: number;
  scale_factor?: number;
  window_title?: string;
}

export interface ScreenMetrics {
  width: number;
  height: number;
  virtual_x: number;
  virtual_y: number;
  virtual_width: number;
  virtual_height: number;
}

export interface UIElementMark {
  id: string; // e.g. "#1", "#2"
  type: 'window' | 'button' | 'menu' | 'input' | 'canvas_node' | 'viewport_control' | 'panel';
  label: string;
  normalizedBbox: { x: number; y: number; width: number; height: number }; // normalized [0, 1000]
  normalizedCenter: { x: number; y: number }; // normalized [0, 1000]
  screenCenter: { x: number; y: number }; // absolute screen desktop pixels
}

export interface CUASubGoal {
  id: number;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  targetTool?: string;
  expectedOutcome?: string;
}

export interface CUAExecutionPlan {
  mainGoal: string;
  subGoals: CUASubGoal[];
  currentSubGoalIndex: number;
}

export interface CUAObservation {
  screen?: ScreenCaptureResult;
  windows: WindowInfo[];
  marks: UIElementMark[];
  canvasNode?: SelectedNodeInfo;
  canvasImageCount: number;
  workspacePrompt: string;
  autodesk: {
    is3dsMaxRunning: boolean;
    isAutoCADRunning: boolean;
    isRevitRunning: boolean;
  };
  timestamp: number;
}

export type CUAActionType =
  | 'canvas_action'
  | 'autodesk_action'
  | 'tool_call'
  | 'launch_app'
  | 'focus_window'
  | 'mouse_click'
  | 'mouse_move'
  | 'mouse_drag'
  | 'mouse_scroll'
  | 'send_keys'
  | 'fetch_web_reference'
  | 'export_cad'
  | 'export_bim'
  | 'export_boq'
  | 'analyze_solar'
  | 'calculate_zoning'
  | 'create_presentation'
  | 'query_codes'
  | 'execute_arch_skill'
  | 'manage_memory'
  | 'wait'
  | 'complete'
  | 'fail';

export interface CUAAction {
  type: CUAActionType;
  targetId?: string; // Set-of-Marks ID (e.g. "#1", "#2") for 100% deterministic clicking
  canvasAction?: CanvasAction;
  appName?: string;
  autodeskSoftware?: '3dsmax' | 'autocad' | 'revit';
  autodeskAction?: 'viewport_sync' | 'execute_script' | 'tool_call';
  autodeskScript?: string;
  toolName?: string;
  toolParameters?: Record<string, any>;
  params?: Record<string, any>;
  windowTitlePattern?: string;
  x?: number;
  y?: number;
  isNormalized?: boolean;
  button?: 'left' | 'right' | 'middle';
  doubleClick?: boolean;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  scrollDirection?: 'up' | 'down';
  scrollAmount?: number;
  text?: string;
  keyCombo?: string[];
  webQuery?: string;
  durationMs?: number;
  completionSummary?: string;
  failureReason?: string;
  cadParams?: Record<string, any>;
  bimParams?: Record<string, any>;
  boqParams?: Record<string, any>;
  solarParams?: Record<string, any>;
  zoningParams?: Record<string, any>;
  presentationParams?: Record<string, any>;
  codeQueryParams?: Record<string, any>;
  skillParams?: { skillName: string; parameters: Record<string, any> };
  memoryParams?: { action: 'get' | 'add'; content?: string; category?: string; query?: string };
}

export interface CUAStepRecord {
  step: number;
  thought: string;
  action: CUAAction;
  result: {
    success: boolean;
    message: string;
    thumbnailUrl?: string;
  };
  timestamp: number;
}

export type CUAStatus = 'idle' | 'observing' | 'thinking' | 'acting' | 'verifying' | 'completed' | 'aborted' | 'error';
export type CUAPlannerProvider = 'gemini' | 'openai';

// ── Human-in-the-loop safety layer ─────────────────────────────────────────────────────────────
// The planner reads screenshots and web images, i.e. UNTRUSTED input (prompt-injection surface).
// Risky actions therefore need an explicit approval before the autonomous loop may run them.
//   'prompt' (default): ask via the registered handler (or window.confirm); no handler => DENY
//   'auto'            : run everything (only for tests / fully sandboxed machines)
//   'deny'            : never run an action that needs approval
export type CUAApprovalPolicy = 'prompt' | 'auto' | 'deny';
export type CUAActionRiskLevel = 'safe' | 'approval' | 'blocked';
export interface CUAApprovalRequest {
  action: CUAAction;
  reason: string;
  step: number;
  summary: string;
}
export type CUAApprovalHandler = (request: CUAApprovalRequest) => Promise<boolean>;

/** Navigation / undo keys that cannot type text, save, delete or close anything. */
const SAFE_KEY_COMBOS = new Set([
  'escape', 'esc', 'ctrl+z', 'ctrl+y', 'tab', 'up', 'down', 'left', 'right', 'home', 'end', 'pageup', 'pagedown',
]);
/** Combos that are refused outright - they open a shell or the task manager / security screen. */
const BLOCKED_KEY_COMBOS: string[][] = [
  ['win', 'r'], ['meta', 'r'], ['cmd', 'r'], ['super', 'r'],
  ['ctrl', 'alt', 'delete'], ['ctrl', 'alt', 'del'],
  ['ctrl', 'shift', 'escape'], ['ctrl', 'shift', 'esc'],
];

export class ComputerUseAgentService {
  private static instance: ComputerUseAgentService;
  private isRunning = false;
  private shouldAbort = false;
  private currentStatus: CUAStatus = 'idle';
  private plannerProvider: CUAPlannerProvider = 'gemini';
  private openAIApiKey: string | null = null;
  private statusListeners: Array<(status: CUAStatus, currentStep?: CUAStepRecord) => void> = [];
  private executionLog: CUAStepRecord[] = [];
  private lastObservation: CUAObservation | null = null;
  private approvalPolicy: CUAApprovalPolicy = 'prompt';
  private approvalHandler: CUAApprovalHandler | null = null;
  private approvalTimeoutMs = 120_000; // unanswered approval = denied

  private constructor() {}

  public static getInstance(): ComputerUseAgentService {
    if (!ComputerUseAgentService.instance) {
      ComputerUseAgentService.instance = new ComputerUseAgentService();
    }
    return ComputerUseAgentService.instance;
  }

  public setPlannerProvider(provider: CUAPlannerProvider, openAiKey?: string): void {
    this.plannerProvider = provider;
    if (openAiKey !== undefined) {
      this.openAIApiKey = openAiKey?.trim() || null;
    }
    logger.log(`[CUA] Active Multimodal Planner Provider set to: ${provider}`);
  }

  public setApprovalPolicy(policy: CUAApprovalPolicy): void {
    this.approvalPolicy = policy;
    if (policy === 'auto') {
      logger.warn('[CUA] Approval policy set to AUTO: risky actions will run without confirmation.');
    }
  }

  /** Test/advanced use: how long an unanswered approval request waits before it counts as denied. */
  public setApprovalTimeoutMs(ms: number): void {
    this.approvalTimeoutMs = Math.max(1, ms);
  }

  public getApprovalPolicy(): CUAApprovalPolicy {
    return this.approvalPolicy;
  }

  /** Register the UI callback that asks the user (e.g. a modal in ArchitectCopilotDock). */
  public setApprovalHandler(handler: CUAApprovalHandler | null): void {
    this.approvalHandler = handler;
  }

  /** Classifies an action: 'safe' runs freely, 'approval' needs the user, 'blocked' never runs. */
  public classifyActionRisk(action: CUAAction): { level: CUAActionRiskLevel; reason: string } {
    switch (action.type) {
      case 'send_keys': {
        const combo = (action.keyCombo || []).map((k) => String(k).toLowerCase().trim());
        if (combo.length > 0 && BLOCKED_KEY_COMBOS.some((b) => b.every((k) => combo.includes(k)))) {
          return { level: 'blocked', reason: `key combination [${combo.join('+')}] is never allowed` };
        }
        if (action.text) {
          return { level: 'approval', reason: 'types text into whatever window currently has focus' };
        }
        if (combo.length > 0 && SAFE_KEY_COMBOS.has(combo.join('+'))) {
          return { level: 'safe', reason: 'navigation/undo key' };
        }
        return { level: 'approval', reason: `sends keyboard shortcut [${combo.join('+') || '?'}]` };
      }
      case 'launch_app':
        return { level: 'approval', reason: 'starts an application' };
      case 'execute_arch_skill':
        return { level: 'approval', reason: 'runs a backend Python skill' };
      case 'manage_memory':
        return action.memoryParams?.action === 'add'
          ? { level: 'approval', reason: 'writes to long-term memory (persists across projects)' }
          : { level: 'safe', reason: 'memory read' };
      case 'autodesk_action':
      case 'tool_call': {
        const isToolCall = action.type === 'tool_call' || action.autodeskAction === 'tool_call';
        if (!isToolCall && action.autodeskScript) {
          return { level: 'approval', reason: 'executes a free-form script inside the Autodesk application' };
        }
        return { level: 'safe', reason: 'structured Autodesk tool call' };
      }
      default:
        return { level: 'safe', reason: 'no elevated risk' };
    }
  }

  private async authorizeAction(action: CUAAction, step: number): Promise<{ allowed: boolean; message: string }> {
    const risk = this.classifyActionRisk(action);
    if (risk.level === 'safe') return { allowed: true, message: '' };
    if (risk.level === 'blocked') {
      return { allowed: false, message: `Blocked by safety policy: ${risk.reason}.` };
    }
    if (this.approvalPolicy === 'auto') {
      logger.warn(`[CUA] Auto-approved risky action (${action.type}): ${risk.reason}`);
      return { allowed: true, message: '' };
    }
    if (this.approvalPolicy === 'deny') {
      return { allowed: false, message: `Denied by policy: action needs approval (${risk.reason}).` };
    }

    let summary = '';
    try {
      summary = JSON.stringify({ ...action, imageBase64: undefined }).slice(0, 400);
    } catch {
      summary = String(action.type);
    }
    const request: CUAApprovalRequest = { action, reason: risk.reason, step, summary };

    try {
      let approved = false;
      if (this.approvalHandler) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(false), this.approvalTimeoutMs);
        });
        try {
          approved = await Promise.race([this.approvalHandler(request), timeout]);
        } finally {
          if (timer) clearTimeout(timer);
        }
      } else if (typeof (globalThis as any).confirm === 'function') {
        approved = (globalThis as any).confirm(
          `Anarchy agent wants to run a risky action (step ${step}):\n\n${risk.reason}\n\n${summary}\n\nAllow?`
        );
      }
      return approved
        ? { allowed: true, message: '' }
        : { allowed: false, message: `Not approved by user: ${risk.reason}.` };
    } catch (err: any) {
      // Fail closed: if the approval UI errors out, nothing risky runs.
      return { allowed: false, message: `Approval failed (${err?.message || err}); action not executed.` };
    }
  }

  public getPlannerProvider(): CUAPlannerProvider {
    return this.plannerProvider;
  }

  /**
   * Transforms coordinates into Windows Virtual Desktop absolute screen coordinates.
   * Standard convention: LLM outputs normalized [0, 1000] coordinates (standard in UI-TARS / Gemini Grounding).
   * If isNormalized is false (e.g. from direct pixel clicks), scales from captured image dimensions to original dimensions.
   */
  public transformCoordinates(
    x: number,
    y: number,
    screen?: ScreenCaptureResult,
    isNormalized = true
  ): { x: number; y: number } {
    if (!screen) {
      return { x: Math.round(x), y: Math.round(y) };
    }

    const origW = screen.original_width || screen.width;
    const origH = screen.original_height || screen.height;
    const originX = screen.origin_x || 0;
    const originY = screen.origin_y || 0;

    let unscaledX: number;
    let unscaledY: number;

    if (isNormalized) {
      // Standard LLM grounding convention [0, 1000]
      const clampedX = Math.max(0, Math.min(1000, x));
      const clampedY = Math.max(0, Math.min(1000, y));
      unscaledX = (clampedX / 1000) * origW;
      unscaledY = (clampedY / 1000) * origH;
    } else {
      // Direct captured image pixel coordinates: scale by downscale ratio
      const scaleX = screen.width > 0 ? origW / screen.width : 1;
      const scaleY = screen.height > 0 ? origH / screen.height : 1;
      unscaledX = x * scaleX;
      unscaledY = y * scaleY;
    }

    // Add window or virtual screen origin offset to get absolute virtual desktop coordinates
    const absoluteX = Math.round(originX + unscaledX);
    const absoluteY = Math.round(originY + unscaledY);

    // Target Window Clamping: If captured screen is bound to a specific window, clamp strictly inside its bounds
    if (screen.window_title && origW > 0 && origH > 0) {
      const minX = originX + 2;
      const maxX = originX + origW - 2;
      const minY = originY + 2;
      const maxY = originY + origH - 2;
      return {
        x: Math.max(minX, Math.min(maxX, absoluteX)),
        y: Math.max(minY, Math.min(maxY, absoluteY)),
      };
    }

    return { x: absoluteX, y: absoluteY };
  }

  public subscribeStatus(listener: (status: CUAStatus, currentStep?: CUAStepRecord) => void): () => void {
    this.statusListeners.push(listener);
    listener(this.currentStatus);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private setStatus(status: CUAStatus, step?: CUAStepRecord): void {
    this.currentStatus = status;
    for (const listener of this.statusListeners) {
      listener(status, step);
    }
  }

  public getStatus(): CUAStatus {
    return this.currentStatus;
  }

  public getExecutionLog(): CUAStepRecord[] {
    return [...this.executionLog];
  }

  public abort(): void {
    if (this.isRunning) {
      this.shouldAbort = true;
      this.setStatus('aborted');
      logger.log('[CUA] Emergency abort signaled.');
    }
  }

  /**
   * Generates Set-of-Marks (SoM) UI visual grounding anchors across active windows,
   * 3D viewports, command panels, and canvas elements for 100% deterministic interaction.
   */
  public generateSetOfMarks(
    windows: WindowInfo[],
    screen?: ScreenCaptureResult,
    canvasNode?: SelectedNodeInfo
  ): UIElementMark[] {
    const marks: UIElementMark[] = [];
    let markIndex = 1;

    const origW = screen?.original_width || screen?.width || 1920;
    const origH = screen?.original_height || screen?.height || 1080;
    const originX = screen?.origin_x || 0;
    const originY = screen?.origin_y || 0;

    // 1. Process Active Windows
    for (const win of windows) {
      if (win.is_minimized || win.rect.width <= 50 || win.rect.height <= 50) continue;

      const relX = win.rect.x - originX;
      const relY = win.rect.y - originY;
      const normX = Math.max(0, Math.min(1000, Math.round((relX / origW) * 1000)));
      const normY = Math.max(0, Math.min(1000, Math.round((relY / origH) * 1000)));
      const normW = Math.max(0, Math.min(1000, Math.round((win.rect.width / origW) * 1000)));
      const normH = Math.max(0, Math.min(1000, Math.round((win.rect.height / origH) * 1000)));

      const screenCenterX = Math.round(win.rect.x + win.rect.width / 2);
      const screenCenterY = Math.round(win.rect.y + win.rect.height / 2);
      const normCenterX = Math.max(0, Math.min(1000, Math.round(((screenCenterX - originX) / origW) * 1000)));
      const normCenterY = Math.max(0, Math.min(1000, Math.round(((screenCenterY - originY) / origH) * 1000)));

      const isAutodesk = win.is_autodesk || /(?:3ds max|autocad|revit)/i.test(win.title);

      marks.push({
        id: `#${markIndex++}`,
        type: 'window',
        label: `Window: ${win.title.slice(0, 32)}`,
        normalizedBbox: { x: normX, y: normY, width: normW, height: normH },
        normalizedCenter: { x: normCenterX, y: normCenterY },
        screenCenter: { x: screenCenterX, y: screenCenterY },
      });

      if (isAutodesk && win.rect.width > 400 && win.rect.height > 300) {
        const vpScreenX = Math.round(win.rect.x + win.rect.width * 0.45);
        const vpScreenY = Math.round(win.rect.y + win.rect.height * 0.52);
        marks.push({
          id: `#${markIndex++}`,
          type: 'viewport_control',
          label: `${win.title.split(' ')[0]} 3D Viewport Center`,
          normalizedBbox: {
            x: Math.max(0, Math.round(((vpScreenX - originX) / origW) * 1000) - 150),
            y: Math.max(0, Math.round(((vpScreenY - originY) / origH) * 1000) - 150),
            width: 300,
            height: 300,
          },
          normalizedCenter: {
            x: Math.max(0, Math.min(1000, Math.round(((vpScreenX - originX) / origW) * 1000))),
            y: Math.max(0, Math.min(1000, Math.round(((vpScreenY - originY) / origH) * 1000))),
          },
          screenCenter: { x: vpScreenX, y: vpScreenY },
        });

        const panelScreenX = Math.round(win.rect.x + win.rect.width * 0.92);
        const panelScreenY = Math.round(win.rect.y + win.rect.height * 0.40);
        marks.push({
          id: `#${markIndex++}`,
          type: 'panel',
          label: `${win.title.split(' ')[0]} Command Panel / Tools`,
          normalizedBbox: {
            x: Math.max(0, Math.round(((panelScreenX - originX) / origW) * 1000) - 40),
            y: Math.max(0, Math.round(((panelScreenY - originY) / origH) * 1000) - 100),
            width: 80,
            height: 200,
          },
          normalizedCenter: {
            x: Math.max(0, Math.min(1000, Math.round(((panelScreenX - originX) / origW) * 1000))),
            y: Math.max(0, Math.min(1000, Math.round(((panelScreenY - originY) / origH) * 1000))),
          },
          screenCenter: { x: panelScreenX, y: panelScreenY },
        });
      }
    }

    // 2. Active Canvas Node
    if (canvasNode && canvasNode.id) {
      marks.push({
        id: `#${markIndex++}`,
        type: 'canvas_node',
        label: `Canvas Node #${canvasNode.id.slice(0, 6)} ("${(canvasNode.prompt || 'Design Node').slice(0, 20)}")`,
        normalizedBbox: { x: 400, y: 350, width: 200, height: 200 },
        normalizedCenter: { x: 500, y: 450 },
        screenCenter: { x: Math.round(originX + origW * 0.5), y: Math.round(originY + origH * 0.45) },
      });
    }

    return marks;
  }

  /**
   * 1. OBSERVE: Captures multimodal state across Screen, Windows, Canvas, and Autodesk
   */
  public async observe(targetWindow?: string): Promise<CUAObservation> {
    let windows: WindowInfo[] = [];
    try {
      const res = await invoke<WindowInfo[]>('cua_get_active_windows');
      if (Array.isArray(res)) {
        windows = res;
      }
    } catch (err) {
      logger.warn('[CUA] Failed to get active windows:', err);
    }

    const is3dsMaxRunning = windows.some((w) => w.title.toLowerCase().includes('3ds max'));
    const isAutoCADRunning = windows.some((w) => w.title.toLowerCase().includes('autocad'));
    const isRevitRunning = windows.some((w) => w.title.toLowerCase().includes('revit'));

    let screen: ScreenCaptureResult | undefined;
    try {
      screen = await invoke<ScreenCaptureResult>('cua_capture_screen', {
        windowTitle: targetWindow || undefined,
        maxDimension: 1280, // Optimized resolution for vision model
      });
    } catch (err) {
      logger.warn('[CUA] Failed to capture screen:', err);
    }

    const canvasNode = canvasBridge.getActiveNode();
    const canvasImages = canvasBridge.getCanvasImages();
    const workspacePrompt = useAIConfigStore.getState().workspacePrompt;

    const marks = this.generateSetOfMarks(windows, screen, canvasNode);

    const obs: CUAObservation = {
      screen,
      windows,
      marks,
      canvasNode,
      canvasImageCount: canvasImages.length,
      workspacePrompt,
      autodesk: {
        is3dsMaxRunning,
        isAutoCADRunning,
        isRevitRunning,
      },
      timestamp: Date.now(),
    };
    this.lastObservation = obs;
    return obs;
  }

  /**
   * 2. ACT: Executes a specific CUA action via Tauri / CanvasBridge
   */
  public async executeAction(action: CUAAction): Promise<{ success: boolean; message: string }> {
    switch (action.type) {
      case 'canvas_action': {
        if (!action.canvasAction) {
          return { success: false, message: 'Missing canvasAction payload' };
        }
        const res = await canvasBridge.executeCanvasAction(action.canvasAction);
        return { success: res.success, message: res.message };
      }

      case 'autodesk_action':
      case 'tool_call': {
        const isToolCall = action.type === 'tool_call' || action.autodeskAction === 'tool_call';
        const script = action.autodeskScript || (action.toolName || '');
        const toolParameters = action.toolParameters || (action as any).params || {};
        const toolNameLower = (action.toolName || script || '').toLowerCase();

        // Architectural Super-Tools Delegation (E:\Agent)
        if (toolNameLower === 'export_cad' || toolNameLower === 'cad' || toolNameLower === 'generate_architectural_dxf') {
          return await this.executeAction({ type: 'export_cad', cadParams: toolParameters });
        }
        if (toolNameLower === 'export_bim' || toolNameLower === 'speckle' || toolNameLower === 'export_architectural_speckle_bim') {
          return await this.executeAction({ type: 'export_bim', bimParams: toolParameters });
        }
        if (toolNameLower === 'export_boq' || toolNameLower === 'boq' || toolNameLower === 'generate_architectural_boq_excel') {
          return await this.executeAction({ type: 'export_boq', boqParams: toolParameters });
        }
        if (toolNameLower === 'analyze_solar' || toolNameLower === 'solar' || toolNameLower === 'analyze_solar_orientation') {
          return await this.executeAction({ type: 'analyze_solar', solarParams: toolParameters });
        }
        if (toolNameLower === 'calculate_zoning' || toolNameLower === 'zoning' || toolNameLower === 'calculate_zoning_metrics') {
          return await this.executeAction({ type: 'calculate_zoning', zoningParams: toolParameters });
        }
        if (toolNameLower === 'create_presentation' || toolNameLower === 'presentation' || toolNameLower === 'create_architectural_deck') {
          return await this.executeAction({ type: 'create_presentation', presentationParams: toolParameters });
        }
        if (toolNameLower === 'query_codes' || toolNameLower === 'building_codes' || toolNameLower === 'query_building_codes') {
          return await this.executeAction({ type: 'query_codes', codeQueryParams: toolParameters });
        }
        if (toolNameLower === 'calculate_window_wall_ratio' || toolNameLower === 'wwr') {
          return await this.executeAction({
            type: 'execute_arch_skill',
            skillParams: { skillName: 'calculate_window_wall_ratio', parameters: toolParameters },
          });
        }

        const software = action.autodeskSoftware || '3dsmax';
        const subAction = isToolCall ? 'tool_call' : (action.autodeskAction || 'viewport_sync');
        const params = isToolCall ? {
          tool_name: action.toolName || action.autodeskScript || '',
          parameters: toolParameters,
          ...toolParameters,
        } : undefined;

        if ((action as any).autoLaunch !== false) {
          try {
            await invoke('cua_launch_app', { appName: software });
          } catch (launchErr) {
            logger.warn('[CUA] Auto-launch notice:', launchErr);
          }

          // Wait for Autodesk connector heartbeat before dispatching command (handles app launch/startup delay)
          try {
            const isOnline = await invoke<boolean>('cua_is_connector_online', { software });
            if (!isOnline) {
              logger.log(`[CUA] Connector for ${software} is not online yet. Waiting up to 55s for heartbeat...`);
              const connected = await invoke<boolean>('cua_wait_for_connector', { software, timeoutSecs: 55 });
              if (!connected) {
                return {
                  success: false,
                  message: `Autodesk connector for ${software} did not come online within 55 seconds. Ensure ${software} is running with AnarchyConnector.ms loaded.`,
                };
              }
            }
          } catch (heartbeatErr) {
            logger.warn('[CUA] Connector heartbeat check notice:', heartbeatErr);
          }
        }

        try {
          const res = await invoke<{ id: string; success: boolean; output?: string; error?: string }>(
            'cua_dispatch_autodesk_command',
            {
              software,
              action: subAction,
              script,
              params,
              timeoutSecs: 12,
            }
          );
          if (res.success) {
            return { success: true, message: res.output || `Autodesk command (${subAction}) executed.` };
          }
          return { success: false, message: res.error || 'Autodesk command timed out or failed.' };
        } catch (err: any) {
          return { success: false, message: `Autodesk bridge invoke error: ${err?.message || err}` };
        }
      }

      case 'export_cad': {
        try {
          const params = action.cadParams || action.toolParameters || {};
          const res = await archVisionAgent.exportCad({
            project_title: params.project_title || 'مشروع معماري 2D',
            plot_width: params.plot_width || 20.0,
            plot_length: params.plot_length || 25.0,
            front_setback: params.front_setback || 3.0,
            side_setback: params.side_setback || 2.0,
            rear_setback: params.rear_setback || 2.0,
          });
          const downloadFullUrl = archVisionAgent.getDownloadUrl(res.download_url);
          return {
            success: true,
            message: `Generated AutoCAD DXF Floor Plan: [${res.filename}](${downloadFullUrl}) (Saved: ${res.dxf_path})`,
          };
        } catch (err: any) {
          return { success: false, message: `AutoCAD DXF generation error: ${err?.message || err}` };
        }
      }

      case 'export_bim': {
        try {
          const params = action.bimParams || action.toolParameters || {};
          const res = await archVisionAgent.exportBim({
            project_title: params.project_title || 'مشروع فيلا معاصرة 3D BIM',
            site_area_sqm: params.site_area_sqm || 500.0,
            speckle_token: params.speckle_token,
            speckle_server: params.speckle_server,
            stream_id: params.stream_id,
          });
          const viewerFullUrl = res.data.viewer_web_url ? archVisionAgent.getDownloadUrl(res.data.viewer_web_url) : '';
          const speckleUrl = res.data.speckle_viewer_url || res.data.speckle_stream_url || '';
          return {
            success: true,
            message: `Generated 3D BIM Speckle Model (${res.data.elements_count || 0} elements, BUA: ${res.data.total_bua || 0}m²).\nInteractive 3D Viewer: [Open 3D Viewer](${viewerFullUrl})${speckleUrl ? ` | Speckle: [Speckle Stream](${speckleUrl})` : ''}`,
          };
        } catch (err: any) {
          return { success: false, message: `3D BIM export error: ${err?.message || err}` };
        }
      }

      case 'export_boq': {
        try {
          const params = action.boqParams || action.toolParameters || {};
          const res = await archVisionAgent.exportBoq({
            project_title: params.project_title || 'مشروع فيلا سكنية معاصرة',
            site_area: params.site_area || 500.0,
            ground_bua: params.ground_bua || 300.0,
            first_bua: params.first_bua || 250.0,
          });
          const downloadFullUrl = archVisionAgent.getDownloadUrl(res.download_url);
          return {
            success: true,
            message: `Generated Excel Bill of Quantities (BOQ Schedule): [${res.filename}](${downloadFullUrl}) (Saved: ${res.excel_path})`,
          };
        } catch (err: any) {
          return { success: false, message: `Excel BOQ export error: ${err?.message || err}` };
        }
      }

      case 'analyze_solar': {
        try {
          const params = action.solarParams || action.toolParameters || {};
          const city = params.city || 'riyadh';
          const res = await archVisionAgent.analyzeSolar({ city });
          const data = res.data || {};
          const tips = (data.facade_recommendations || []).slice(0, 3).join(' • ');
          return {
            success: true,
            message: `Solar Analysis (${data.city || city}): Peak Sun Azimuth: ${data.solar_angles?.noon_azimuth || 180}°, Altitude: ${data.solar_angles?.noon_altitude || 65}°. Recommendations: ${tips || 'Optimized orientation.'}`,
          };
        } catch (err: any) {
          return { success: false, message: `Solar analysis error: ${err?.message || err}` };
        }
      }

      case 'calculate_zoning': {
        try {
          const params = action.zoningParams || action.toolParameters || {};
          const res = await archVisionAgent.calculateZoning({
            site_area_sqm: params.site_area_sqm || 500.0,
            max_coverage_ratio: params.max_coverage_ratio ?? 0.6,
            far: params.far ?? 1.8,
            floors: params.floors ?? 2,
          });
          const d = res.data;
          return {
            success: true,
            message: `Zoning Calculation for ${d.site_area_sqm}m² plot: Max Footprint: ${d.max_ground_footprint_sqm}m² (${(d.max_coverage_ratio * 100).toFixed(0)}%), Max BUA: ${d.max_total_bua_sqm}m² (FAR ${d.far}), Floors: ${d.floors}, Parking: ${d.parking_spaces_required || 2} cars.`,
          };
        } catch (err: any) {
          return { success: false, message: `Zoning calculation error: ${err?.message || err}` };
        }
      }

      case 'create_presentation': {
        try {
          const params = action.presentationParams || action.toolParameters || {};
          const res = await archVisionAgent.exportPresentation({
            project_title: params.project_title || 'مشروع الفيلا المعاصرة',
            project_subtitle: params.project_subtitle || 'العرض التقديمي للتصميم المبدئي والاشتراطات',
            brief: params.brief || 'فيلا سكنية فاخرة',
            space_program: params.space_program || '',
            compliance_report: params.compliance_report || '',
            solar_recommendations: params.solar_recommendations || [],
            render_image_path: params.render_image_path,
          });
          const downloadFullUrl = archVisionAgent.getDownloadUrl(res.download_url);
          return {
            success: true,
            message: `Generated Architectural Client Deck (.pptx): [${res.filename}](${downloadFullUrl}) (Saved: ${res.pptx_path})`,
          };
        } catch (err: any) {
          return { success: false, message: `Presentation export error: ${err?.message || err}` };
        }
      }

      case 'query_codes': {
        try {
          const params = action.codeQueryParams || action.toolParameters || {};
          const query = params.query || action.text || '';
          const res = await archVisionAgent.queryCodes({ query, n_results: params.n_results || 3 });
          return {
            success: true,
            message: `Building Code Compliance RAG Results:\n${(res.results || []).map((r, i) => `${i + 1}. ${r}`).join('\n')}`,
          };
        } catch (err: any) {
          return { success: false, message: `Code query error: ${err?.message || err}` };
        }
      }

      case 'execute_arch_skill': {
        try {
          const skillName = action.skillParams?.skillName || action.toolName || 'calculate_window_wall_ratio';
          const params = action.skillParams?.parameters || action.toolParameters || {};
          const res = await archVisionAgent.executeSkill(skillName, params);
          return {
            success: res.success,
            message: res.success
              ? `Skill '${skillName}' executed successfully: ${JSON.stringify(res.result)}`
              : `Skill '${skillName}' error: ${res.error}`,
          };
        } catch (err: any) {
          return { success: false, message: `Skill execution error: ${err?.message || err}` };
        }
      }

      case 'manage_memory': {
        try {
          const memAction = action.memoryParams?.action || 'get';
          if (memAction === 'add') {
            const content = action.memoryParams?.content || action.text || '';
            const cat = action.memoryParams?.category || 'general';
            await archVisionAgent.addMemory(content, cat);
            return { success: true, message: `Saved memory to long-term database: "${content.slice(0, 50)}..."` };
          } else {
            const q = action.memoryParams?.query || action.text || '';
            const memories = await archVisionAgent.getMemories(q);
            return {
              success: true,
              message: `Recalled memories (${memories.length}):\n${memories.slice(0, 4).map((m) => `• [${m.category}] ${m.content}`).join('\n')}`,
            };
          }
        } catch (err: any) {
          return { success: false, message: `Memory management error: ${err?.message || err}` };
        }
      }

      case 'launch_app': {
        const app = action.appName || '3dsmax';
        try {
          const res = await invoke<string>('cua_launch_app', { appName: app });
          return { success: true, message: res };
        } catch (err: any) {
          return { success: false, message: `Launch app error: ${err?.message || err}` };
        }
      }

      case 'focus_window': {
        const pattern = action.windowTitlePattern || '3ds max';
        try {
          const ok = await invoke<boolean>('cua_focus_window', {
            titlePattern: pattern,
          });
          return { success: ok, message: ok ? `Focused window matching '${pattern}'` : `Window not found: '${pattern}'` };
        } catch (err: any) {
          return { success: false, message: `Focus window error: ${err?.message || err}` };
        }
      }

      case 'mouse_click': {
        const targetWindow = this.lastObservation?.screen?.window_title;
        // 1. Check Set-of-Marks targetId resolution
        if (action.targetId && this.lastObservation?.marks) {
          const mark = this.lastObservation.marks.find((m) => m.id.toLowerCase() === action.targetId?.toLowerCase());
          if (mark) {
            try {
              await invoke('cua_mouse_click', {
                x: mark.screenCenter.x,
                y: mark.screenCenter.y,
                button: action.button || 'left',
                doubleClick: action.doubleClick || false,
                targetWindow: targetWindow || undefined,
              });
              return {
                success: true,
                message: `Clicked SoM Mark [${mark.id}] "${mark.label}" at (${mark.screenCenter.x}, ${mark.screenCenter.y})`,
              };
            } catch (err: any) {
              return { success: false, message: `Mouse click SoM mark error: ${err?.message || err}` };
            }
          }
        }

        // 2. Coordinate-based click
        if (action.x === undefined || action.y === undefined) {
          return { success: false, message: 'Missing (x, y) coordinates or targetId for click' };
        }
        try {
          const isNorm = action.isNormalized !== undefined ? action.isNormalized : (this.plannerProvider === 'gemini');
          const transformed = this.transformCoordinates(action.x, action.y, this.lastObservation?.screen, isNorm);
          await invoke('cua_mouse_click', {
            x: transformed.x,
            y: transformed.y,
            button: action.button || 'left',
            doubleClick: action.doubleClick || false,
            targetWindow: targetWindow || undefined,
          });
          return {
            success: true,
            message: `Clicked at screen (${transformed.x}, ${transformed.y}) [model input: ${action.x}, ${action.y}, normalized: ${isNorm}]`,
          };
        } catch (err: any) {
          return { success: false, message: `Mouse click error: ${err?.message || err}` };
        }
      }

      case 'mouse_move': {
        if (action.x === undefined || action.y === undefined) {
          return { success: false, message: 'Missing (x, y) coordinates for move' };
        }
        try {
          const isNorm = action.isNormalized !== undefined ? action.isNormalized : (this.plannerProvider === 'gemini');
          const transformed = this.transformCoordinates(action.x, action.y, this.lastObservation?.screen, isNorm);
          const targetWindow = this.lastObservation?.screen?.window_title;
          await invoke('cua_mouse_move', {
            x: transformed.x,
            y: transformed.y,
            targetWindow: targetWindow || undefined,
          });
          return { success: true, message: `Moved mouse to screen (${transformed.x}, ${transformed.y})` };
        } catch (err: any) {
          return { success: false, message: `Mouse move error: ${err?.message || err}` };
        }
      }

      case 'mouse_drag': {
        if (
          action.fromX === undefined ||
          action.fromY === undefined ||
          action.toX === undefined ||
          action.toY === undefined
        ) {
          return { success: false, message: 'Missing drag coordinates' };
        }
        try {
          const isNorm = action.isNormalized !== undefined ? action.isNormalized : true;
          const from = this.transformCoordinates(action.fromX, action.fromY, this.lastObservation?.screen, isNorm);
          const to = this.transformCoordinates(action.toX, action.toY, this.lastObservation?.screen, isNorm);
          const targetWindow = this.lastObservation?.screen?.window_title;
          await invoke('cua_mouse_drag', {
            fromX: from.x,
            fromY: from.y,
            toX: to.x,
            toY: to.y,
            steps: 25,
            targetWindow: targetWindow || undefined,
          });
          return { success: true, message: `Dragged from (${from.x}, ${from.y}) to (${to.x}, ${to.y})` };
        } catch (err: any) {
          return { success: false, message: `Mouse drag error: ${err?.message || err}` };
        }
      }

      case 'send_keys': {
        try {
          await invoke('cua_send_keys', {
            text: action.text || undefined,
            keyCombo: action.keyCombo || undefined,
          });
          return {
            success: true,
            message: `Sent keys: ${action.text ? `text "${action.text}"` : ''} ${action.keyCombo ? `combo [${action.keyCombo.join('+')}]` : ''}`,
          };
        } catch (err: any) {
          return { success: false, message: `Send keys error: ${err?.message || err}` };
        }
      }

      case 'mouse_scroll': {
        try {
          await invoke('cua_mouse_scroll', {
            direction: action.scrollDirection || 'down',
            amount: action.scrollAmount || 2,
          });
          return { success: true, message: `Scrolled mouse ${action.scrollDirection || 'down'}` };
        } catch (err: any) {
          return { success: false, message: `Mouse scroll error: ${err?.message || err}` };
        }
      }

      case 'fetch_web_reference': {
        try {
          let rawQuery = (action.webQuery || 'modern architectural facade').trim();
          // Translate common architectural Arabic search terms to English for Wikimedia global repository
          const arToEnMap: Record<string, string> = {
            'فيلا مودرن': 'modern villa architecture',
            'واجهة مودرن': 'modern facade architecture',
            'برج زجاجي': 'glass skyscraper architecture',
            'كتلة معمارية': 'architectural massing building',
            'مبنى سكني': 'residential building architecture',
            'ترافرتين': 'travertine facade architecture',
            'كونكريت': 'brutalist concrete architecture',
            'تصميم داخلي': 'contemporary interior architecture',
          };
          for (const [ar, en] of Object.entries(arToEnMap)) {
            if (rawQuery.includes(ar)) {
              rawQuery = rawQuery.replace(ar, en);
            }
          }

          // Query real Wikimedia Commons architecture & design repository with gsrnamespace=6 (File:) and iiurlwidth=1280
          const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(rawQuery)}&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url&iiurlwidth=1280&format=json&origin=*`;
          const searchRes = await fetch(searchUrl);
          let chosenUrl: string | null = null;
          if (searchRes.ok) {
            const data = await searchRes.json();
            const pages = data?.query?.pages;
            if (pages) {
              for (const pageId of Object.keys(pages)) {
                const info = pages[pageId]?.imageinfo?.[0];
                const url = info?.thumburl || info?.url;
                if (url && /\.(jpg|jpeg|png|webp)/i.test(url)) {
                  chosenUrl = url;
                  break;
                }
              }
            }
          }

          if (!chosenUrl) {
            return {
              success: false,
              message: `No online architectural reference images found matching "${rawQuery}".`,
            };
          }

          const imgRes = await fetch(chosenUrl);
          const blob = await imgRes.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });

          const store = useAIConfigStore.getState();
          const activeId = store.selectedNode?.id || 'root';
          const childId = store.forkChildNode(
            activeId,
            base64,
            `Ref: ${rawQuery.slice(0, 20)}`,
            `Online web reference retrieved for "${rawQuery}".`
          );
          if (childId) {
            store.focusNode(childId);
          }
          return {
            success: true,
            message: `Fetched online architectural reference for "${rawQuery}" and placed on Canvas as node #${childId?.slice(0, 6) || 'new'}.`,
          };
        } catch (err: any) {
          return { success: false, message: `Web reference fetch error: ${err?.message || err}` };
        }
      }

      case 'wait': {
        const ms = action.durationMs || 1000;
        await new Promise((resolve) => setTimeout(resolve, ms));
        return { success: true, message: `Waited ${ms}ms` };
      }

      case 'complete': {
        return { success: true, message: action.completionSummary || 'Goal achieved successfully.' };
      }

      case 'fail': {
        return { success: false, message: action.failureReason || 'Action failed explicitly.' };
      }

      default:
        return { success: false, message: `Unknown action type: ${(action as any).type}` };
    }
  }

  /**
   * Host Planner: Decomposes a user objective into an actionable multi-stage architectural execution plan.
   */
  public async createHierarchicalPlan(goal: string, _obs: CUAObservation): Promise<CUAExecutionPlan> {
    const g = goal.toLowerCase();
    const subGoals: CUASubGoal[] = [];

    const isComprehensive = /(?:كامل|شامل|كل شيء|متكامل|دراسة|مشروع|تطوير|مخطط وجدول|فيلا كاملة|سوي كلشي)/i.test(g);
    const wantsZoning = isComprehensive || /(?:ارتداد|تغطية|مساحة بناء|far|zoning|اشتراطات)/i.test(g);
    const wantsSolar = isComprehensive || /(?:تشميس|شمس|طاقة|واجهات مناخية|solar|مناخ)/i.test(g);
    const wantsCad = isComprehensive || /(?:كاد|مخطط|dxf|cad|أوتوكاد|2d)/i.test(g);
    const wantsBim = isComprehensive || /(?:مودل|3d|bim|ريفيت|ماكس|سبيكل|speckle)/i.test(g);
    const wantsBoq = isComprehensive || /(?:كميات|جدول كميات|boq|تكلفة|excel|اكسل)/i.test(g);
    const wantsDeck = isComprehensive || /(?:عرض|بريزنتيشن|بوربوينت|deck|presentation|تقرير)/i.test(g);
    const wantsCodes = /(?:كود|اشتراط|sbc|معايير|كود البناء)/i.test(g);

    let sgId = 1;
    if (wantsCodes) {
      subGoals.push({
        id: sgId++,
        title: 'Building Code Compliance & Technical Standards Audit',
        status: 'pending',
        targetTool: 'query_codes',
        expectedOutcome: 'Retrieve applicable building code compliance requirements',
      });
    }

    if (wantsZoning) {
      subGoals.push({
        id: sgId++,
        title: 'Calculate Municipal Zoning, Setbacks & FAR',
        status: 'pending',
        targetTool: 'calculate_zoning',
        expectedOutcome: 'Determine maximum footprint, gross floor area, and regulatory setbacks',
      });
    }

    if (wantsSolar) {
      subGoals.push({
        id: sgId++,
        title: 'Solar Analysis, Sun Angles & Climate Orientation',
        status: 'pending',
        targetTool: 'analyze_solar',
        expectedOutcome: 'Calculate solar angles and recommend shading and aperture orientations',
      });
    }

    if (wantsCad) {
      subGoals.push({
        id: sgId++,
        title: 'Generate 2D Architectural AutoCAD DXF Layout',
        status: 'pending',
        targetTool: 'export_cad',
        expectedOutcome: 'Produce AutoCAD DXF layout conforming to statutory setbacks',
      });
    }

    if (wantsBim) {
      subGoals.push({
        id: sgId++,
        title: 'Generate 3D Architectural BIM Model & Speckle Viewer',
        status: 'pending',
        targetTool: 'export_bim',
        expectedOutcome: 'Generate interactive 3D model viewable in browser and 3ds Max',
      });
    }

    if (wantsBoq) {
      subGoals.push({
        id: sgId++,
        title: 'Export Detailed BOQ Schedule (Excel)',
        status: 'pending',
        targetTool: 'export_boq',
        expectedOutcome: 'Produce comprehensive schedule of quantities for all structural and architectural work',
      });
    }

    if (wantsDeck) {
      subGoals.push({
        id: sgId++,
        title: 'Generate Comprehensive Presentation Deck PowerPoint (.pptx)',
        status: 'pending',
        targetTool: 'create_presentation',
        expectedOutcome: 'Create full presentation deck with complete slides and visuals',
      });
    }

    if (subGoals.length === 0) {
      subGoals.push({
        id: 1,
        title: 'Execute Action via Computer Vision and UI Control',
        status: 'pending',
        expectedOutcome: 'Accomplish user objective and verify outcome visually',
      });
    }

    subGoals.push({
      id: sgId++,
      title: 'Final Verification & Canvas Synchronization',
      status: 'pending',
      targetTool: 'complete',
      expectedOutcome: 'Complete all deliverables and synchronize with canvas successfully',
    });

    return {
      mainGoal: goal,
      subGoals,
      currentSubGoalIndex: 0,
    };
  }

  /**
   * 3. SOTA HIERARCHICAL MULTIMODAL CUA REASONING LOOP (Host Planner + App Actor + SoM Grounding)
   */
  public async executeAutonomousTask(
    goal: string,
    options?: {
      maxSteps?: number;
      onStep?: (step: CUAStepRecord) => void;
    }
  ): Promise<{ success: boolean; message: string; steps: CUAStepRecord[] }> {
    if (this.isRunning) {
      return { success: false, message: 'A CUA task is already executing.', steps: [] };
    }

    this.isRunning = true;
    this.shouldAbort = false;
    this.executionLog = [];
    const maxSteps = options?.maxSteps || 30; // Expanded to 30 steps for comprehensive workflows

    logger.log(`[CUA] Starting task: "${goal}" (Max steps: ${maxSteps})`);

    try {
      let currentObs: CUAObservation | null = null;
      let lastReflection: string | null = null;

      // Host Planner: Establish hierarchical roadmap
      const initialObs = await this.observe();
      currentObs = initialObs;
      const plan = await this.createHierarchicalPlan(goal, initialObs);
      let deniedStreak = 0;

      for (let stepIndex = 1; stepIndex <= maxSteps; stepIndex++) {
        if (this.shouldAbort) {
          this.setStatus('aborted');
          return { success: false, message: 'Task aborted by user.', steps: this.executionLog };
        }

        // Phase A: OBSERVE (Reuse previous step's post-action observation to prevent double screen capture)
        this.setStatus('observing');
        const obs = currentObs || (await this.observe());

        if (this.shouldAbort) break;

        // Phase B: THINK & PLAN (App Actor guided by Host Plan & Reflection)
        this.setStatus('thinking');
        const decision = await this.planNextAction(goal, this.executionLog, obs, plan, lastReflection);

        if (this.shouldAbort) break;

        // Phase C: ACT
        this.setStatus('acting');
        const hadPendingFailure = lastReflection !== null; // previous step failed / was unverified
        const authz = await this.authorizeAction(decision.action, stepIndex);
        deniedStreak = authz.allowed ? 0 : deniedStreak + 1;
        const actionResult = authz.allowed
          ? await this.executeAction(decision.action)
          : { success: false, message: authz.message };

        // Phase D: VERIFY (Visual inspection after action settling)
        this.setStatus('verifying');
        await new Promise((r) => setTimeout(r, 600));
        const postObs = await this.observe();
        currentObs = postObs; // Hand over to next loop iteration!

        // Verification used to be `isVerified = actionResult.success`, i.e. "the IPC call did not throw".
        // Now we also require evidence for actions that should change the screen: if the captured screen is
        // byte-identical before and after, the action very likely had no effect. (Still a heuristic - a
        // changed screen proves *something* happened, not that it was the right thing.)
        const expectsVisibleChange = ['mouse_click', 'mouse_drag', 'send_keys', 'launch_app'].includes(decision.action.type);
        const preImg = obs.screen?.image;
        const postImg = postObs.screen?.image;
        const screenChanged: boolean | null = preImg && postImg ? preImg !== postImg : null;
        const noVisibleEffect = expectsVisibleChange && screenChanged === false;

        let isVerified = actionResult.success && !noVisibleEffect;
        let resultMsg = actionResult.message;
        if (!actionResult.success) {
          isVerified = false;
          resultMsg = `Action failed: ${actionResult.message}`;
          lastReflection = `Previous action (${decision.action.type}) failed with: "${actionResult.message}". Reflect on why this occurred and formulate an alternative or corrective step.`;
        } else if (noVisibleEffect) {
          resultMsg = `${actionResult.message} (UNVERIFIED: the screen did not change after this action)`;
          lastReflection = `The ${decision.action.type} action reported success but the screen is identical afterwards, so it probably had no effect. Re-inspect the screen and try a different target or approach.`;
        } else {
          lastReflection = null;
          // Advance sub-goal only on a verified action that matches the sub-goal's target tool.
          // (Old condition `type === targetTool || actionResult.success` was always true on success,
          //  so any successful click completed the current sub-goal.)
          const currentSg = plan.subGoals[plan.currentSubGoalIndex];
          const hasTarget = !!currentSg?.targetTool;
          const matchesTarget =
            hasTarget &&
            (decision.action.type === currentSg.targetTool || (decision.action as any).toolName === currentSg.targetTool);
          if (currentSg && (matchesTarget || !hasTarget)) {
            if (decision.action.type !== 'mouse_move' && decision.action.type !== 'wait') {
              currentSg.status = 'completed';
              if (plan.currentSubGoalIndex < plan.subGoals.length - 1) {
                plan.currentSubGoalIndex++;
              }
            }
          }
        }

        const stepRecord: CUAStepRecord = {
          step: stepIndex,
          thought: decision.thought,
          action: decision.action,
          result: {
            success: isVerified,
            message: resultMsg,
            thumbnailUrl: postObs.screen?.image || obs.screen?.image,
          },
          timestamp: Date.now(),
        };

        this.executionLog.push(stepRecord);
        if (options?.onStep) {
          options.onStep(stepRecord);
        }

        // Stop instead of letting the planner hammer against the approval wall
        if (deniedStreak >= 2) {
          this.setStatus('error', stepRecord);
          this.isRunning = false;
          return {
            success: false,
            message: `Task halted: ${deniedStreak} consecutive actions were blocked or not approved (${actionResult.message})`,
            steps: this.executionLog,
          };
        }

        // Check explicit fail action
        if (decision.action.type === 'fail') {
          this.setStatus('error', stepRecord);
          this.isRunning = false;
          return {
            success: false,
            message: decision.action.failureReason || actionResult.message || 'Task halted: explicit failure action signaled.',
            steps: this.executionLog,
          };
        }

        // Check if goal reached
        if (decision.action.type === 'complete') {
          if (isVerified && !hadPendingFailure) {
            this.setStatus('completed', stepRecord);
            this.isRunning = false;
            return {
              success: true,
              message: decision.action.completionSummary || 'Task marked complete by the planner (no independent visual verification was performed).',
              steps: this.executionLog,
            };
          } else {
            this.setStatus('error', stepRecord);
            this.isRunning = false;
            return {
              success: false,
              message: decision.action.completionSummary || 'Task halted due to unverified state or action failure.',
              steps: this.executionLog,
            };
          }
        }

        // Settling delay between steps
        await new Promise((r) => setTimeout(r, 400));
      }

      if (this.shouldAbort) {
        this.setStatus('aborted');
        this.isRunning = false;
        return {
          success: false,
          message: 'Task aborted by user.',
          steps: this.executionLog,
        };
      }

      this.setStatus('error');
      this.isRunning = false;
      return {
        success: false,
        message: `Task reached maximum execution limit (${maxSteps} steps) without completing goal.`,
        steps: this.executionLog,
      };
    } catch (err: any) {
      this.setStatus('error');
      this.isRunning = false;
      logger.error('[CUA] Execution loop encountered an error:', err);
      return {
        success: false,
        message: `CUA Error: ${err?.message || err}`,
        steps: this.executionLog,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Directly executes an Autodesk command (3ds Max / AutoCAD / Revit).
   * Automatically launches and brings the application to the foreground if requested.
   */
  public async executeAutodeskCommand(options: {
    software: '3dsmax' | 'autocad' | 'revit';
    action: 'viewport_sync' | 'execute_script';
    script?: string;
    autoLaunch?: boolean;
  }): Promise<{ success: boolean; message: string; output?: string }> {
    const { software, action, script = '', autoLaunch = true } = options;

    if (autoLaunch) {
      try {
        await invoke('cua_launch_app', { appName: software });
      } catch (launchErr) {
        logger.warn('[CUA] Auto-launch notice:', launchErr);
      }
    }

    // Wait for connector online status before dispatching command
    if (autoLaunch) {
      try {
        const isOnline = await invoke<boolean>('cua_is_connector_online', { software });
        if (!isOnline) {
          logger.log(`[CUA] Autodesk connector for ${software} is not online yet. Waiting up to 55s for heartbeat...`);
          const connected = await invoke<boolean>('cua_wait_for_connector', { software, timeoutSecs: 55 });
          if (!connected) {
            return {
              success: false,
              message: `Autodesk connector for ${software} did not come online within 55 seconds. Ensure ${software} is running with AnarchyConnector.ms loaded.`,
            };
          }
        }
      } catch (heartbeatErr) {
        logger.warn('[CUA] Connector heartbeat check notice:', heartbeatErr);
      }
    }

    try {
      const res = await invoke<{ id: string; success: boolean; output?: string; error?: string }>(
        'cua_dispatch_autodesk_command',
        {
          software,
          action,
          script,
          timeoutSecs: 12,
        }
      );
      if (res.success) {
        return { success: true, message: res.output || 'Autodesk command executed.', output: res.output };
      }
      return { success: false, message: res.error || 'Autodesk command queued.', output: res.output };
    } catch (err: any) {
      return { success: false, message: `Autodesk dispatch failed: ${err?.message || err}` };
    }
  }

  /**
   * Plans the next optimal action using Gemini Vision / Multimodal LLM,
   * taking into account Host Planner sub-goals, Set-of-Marks visual anchors, and reflections.
   */
  private async planNextAction(
    goal: string,
    history: CUAStepRecord[],
    obs: CUAObservation,
    plan?: CUAExecutionPlan,
    reflection?: string | null
  ): Promise<{ thought: string; action: CUAAction }> {
    const windowsSummary = (obs?.windows || [])
      .slice(0, 10)
      .map((w) => `• "${w.title}" [pid:${w.process_id}, rect:(${w.rect.x},${w.rect.y},${w.rect.width}x${w.rect.height})]`)
      .join('\n');

    const marksSummary = (obs?.marks || [])
      .slice(0, 15)
      .map((m) => `[${m.id}] ${m.label} -> center: (${m.normalizedCenter.x}, ${m.normalizedCenter.y}) [Screen: (${m.screenCenter.x}, ${m.screenCenter.y})]`)
      .join('\n');

    const subGoalsRoadmap = plan?.subGoals?.length
      ? plan.subGoals
          .map((sg, idx) => {
            const marker = idx === plan.currentSubGoalIndex ? '⏩ [IN-PROGRESS]' : sg.status === 'completed' ? '✓ [COMPLETED]' : '⏳ [PENDING]';
            return `${marker} Sub-Goal ${sg.id}: ${sg.title} (Tool: ${sg.targetTool || 'general'}) -> Expected: ${sg.expectedOutcome || ''}`;
          })
          .join('\n')
      : 'Single direct objective.';

    const reflectionSection = reflection
      ? `\nPREVIOUS STEP REFLECTION & SELF-HEALING:\n${reflection}\n`
      : '';

    const historySummary = (history || []).length === 0
      ? 'No prior steps executed.'
      : history
          .map((h) => {
            let resMsg = (h.result.message || '').trim();
            if (resMsg.startsWith('{') && resMsg.endsWith('}')) {
              try {
                const parsed = JSON.parse(resMsg);
                if (parsed.message) {
                  const dims = parsed.scene_bounds?.dimensions_m;
                  const boundsStr = dims ? ` [Bounds: ${dims[0]}x${dims[1]}x${dims[2]}m]` : '';
                  resMsg = `${parsed.message}${boundsStr}`;
                } else if (parsed.error) {
                  resMsg = `Error: ${parsed.error}`;
                } else {
                  resMsg = resMsg.slice(0, 180) + '... (truncated JSON)';
                }
              } catch {
                if (resMsg.length > 200) {
                  resMsg = resMsg.slice(0, 200) + '... (truncated)';
                }
              }
            } else if (resMsg.length > 250) {
              resMsg = resMsg.slice(0, 250) + '... (truncated)';
            }
            return `Step ${h.step}: Thought: "${h.thought}" -> Action: ${h.action.type} -> Result: ${h.result.success ? 'SUCCESS' : 'FAILED'} (${resMsg})`;
          })
          .join('\n');

    const prompt = `You are Anarchy Computer-Use Agent (CUA) — the elite autonomous multimodal intelligence operating Anarchy AI, E:\\Agent backend tools, and Autodesk engineering software.

USER GOAL:
"${goal}"

STRATEGIC HIERARCHICAL ROADMAP (HOST PLANNER):
${subGoalsRoadmap}
${reflectionSection}
OBSERVED ENVIRONMENT:
- Active Windows:
${windowsSummary || 'None detected'}
- Set-of-Marks UI Grounding Anchors:
${marksSummary || 'None detected'}
- 3ds Max Running: ${obs.autodesk.is3dsMaxRunning ? 'YES' : 'NO'}
- AutoCAD Running: ${obs.autodesk.isAutoCADRunning ? 'YES' : 'NO'}
- Revit Running: ${obs.autodesk.isRevitRunning ? 'YES' : 'NO'}
- Canvas Active Node: ${obs.canvasNode?.id ? `#${obs.canvasNode.id.slice(0, 6)} (Prompt: "${obs.canvasNode.prompt || ''}")` : 'No node selected'}
- Total Canvas Images: ${obs.canvasImageCount}
- Workspace Prompt: "${obs.workspacePrompt || ''}"
- Screen Geometry: ${obs.screen?.width || 1280}x${obs.screen?.height || 720} (original screen: ${obs.screen?.original_width || 1920}x${obs.screen?.original_height || 1080}, offset: (${obs.screen?.origin_x || 0}, ${obs.screen?.origin_y || 0}))

HISTORY OF COMPLETED STEPS:
${historySummary}

AVAILABLE ACTIONS:
--- ARCHITECTURAL SUPER-TOOLS (E:\\Agent Brain & Engine) ---
1. {"type": "calculate_zoning", "zoningParams": {"site_area_sqm": 500.0, "max_coverage_ratio": 0.6, "far": 1.8, "floors": 2}} -> Compute municipal zoning allowances, maximum footprints, BUA, setbacks, and parking.
2. {"type": "analyze_solar", "solarParams": {"city": "riyadh"}} -> Calculate solar angles, sun paths, and passive shading/facade recommendations.
3. {"type": "export_cad", "cadParams": {"project_title": "...", "plot_width": 20.0, "plot_length": 25.0, "front_setback": 3.0, "side_setback": 2.0, "rear_setback": 2.0}} -> Generate 2D AutoCAD architectural DXF floor plan.
4. {"type": "export_bim", "bimParams": {"project_title": "...", "site_area_sqm": 500.0}} -> Generate 3D BIM Speckle model and interactive WebGL 3D viewer.
5. {"type": "export_boq", "boqParams": {"project_title": "...", "site_area": 500.0, "ground_bua": 300.0, "first_bua": 250.0}} -> Generate comprehensive itemized Excel BOQ Schedule (.xlsx).
6. {"type": "create_presentation", "presentationParams": {"project_title": "...", "project_subtitle": "...", "brief": "..."}} -> Generate complete PowerPoint (.pptx) client presentation deck.
7. {"type": "query_codes", "codeQueryParams": {"query": "ارتداد فيلا سكني كود SBC 201"}} -> Query building code compliance knowledge base using ChromaDB RAG.
8. {"type": "execute_arch_skill", "skillParams": {"skillName": "calculate_window_wall_ratio", "parameters": {"window_area": 40.0, "wall_area": 160.0}}} -> Execute self-improving architectural skill.
9. {"type": "manage_memory", "memoryParams": {"action": "get" | "add", "content": "..."}} -> Store or recall architectural long-term memories.

--- AUTODESK 3DS MAX TOOLS ---
10. {"type": "tool_call", "autodeskSoftware": "3dsmax", "toolName": "create_box", "toolParameters": {"length": 10.0, "width": 8.0, "height": 3.2, "name": "Main_Massing"}} -> Create parametric architectural massing in meters with automatic unit-scaling.
11. {"type": "tool_call", "autodeskSoftware": "3dsmax", "toolName": "set_camera", "toolParameters": {"target_x": 0.0, "target_y": 0.0, "target_z": 1.6, "distance": 18.0, "pitch": 0.0, "yaw": 45.0, "focal_length": 35.0, "eye_level": true}} -> Position eye-level architectural camera and align viewport with parallel verticals.
12. {"type": "tool_call", "autodeskSoftware": "3dsmax", "toolName": "setup_sun_lighting", "toolParameters": {"azimuth": 135.0, "altitude": 32.0, "intensity": 1.0, "color_temp": 4500}} -> Configure realistic sun angle and daylight warmth.
13. {"type": "tool_call", "autodeskSoftware": "3dsmax", "toolName": "apply_material", "toolParameters": {"material_type": "travertine" | "concrete" | "glass" | "wood" | "metal", "base_color": "#E2D9C8", "roughness": 0.45}} -> Apply physical PBR architectural material to selection.
14. {"type": "tool_call", "autodeskSoftware": "3dsmax", "toolName": "get_scene_info", "toolParameters": {}} -> READ TOOL: Query 3ds Max scene objects, names, classes, positions, bounding box, dimensions in meters, and active camera.
15. {"type": "tool_call", "autodeskSoftware": "3dsmax", "toolName": "render_preview", "toolParameters": {}} -> READ/CAPTURE TOOL: Capture active 3ds Max viewport and sync image to Anarchy AI.
16. {"type": "autodesk_action", "autodeskSoftware": "3dsmax", "autodeskAction": "viewport_sync"} -> Request active viewport from 3ds Max immediately.
17. {"type": "autodesk_action", "autodeskSoftware": "3dsmax", "autodeskAction": "execute_script", "autodeskScript": "<maxscript code>"} -> Run custom safe MaxScript code inside 3ds Max.

--- AUTODESK REVIT BIM TOOLS ---
18. {"type": "tool_call", "autodeskSoftware": "revit", "toolName": "create_architectural_villa", "toolParameters": {"width": 14.0, "length": 16.0, "height": 3.5, "style": "modern"}} -> Parametrically generate complete 2-story architectural villa in Revit (Levels, Outer & Interior Walls, Floors, Doors, Windows, and 3D View).
19. {"type": "tool_call", "autodeskSoftware": "revit", "toolName": "create_walls", "toolParameters": {"width": 12.0, "length": 14.0, "height": 3.2}} -> Create perimeter walls on active level.
20. {"type": "tool_call", "autodeskSoftware": "revit", "toolName": "create_levels", "toolParameters": {"name": "First Floor", "elevation": 3.5}} -> Create building level at elevation in meters.
21. {"type": "tool_call", "autodeskSoftware": "revit", "toolName": "create_floors", "toolParameters": {"width": 14.0, "length": 16.0}} -> Generate architectural floor slab covering footprint.
22. {"type": "tool_call", "autodeskSoftware": "revit", "toolName": "place_doors_windows", "toolParameters": {}} -> Insert doors and windows onto walls.
23. {"type": "tool_call", "autodeskSoftware": "revit", "toolName": "set_camera", "toolParameters": {"eye_level": true, "yaw": 35.0, "distance": 22.0}} -> Align Revit 3D perspective camera at human eye level.
24. {"type": "tool_call", "autodeskSoftware": "revit", "toolName": "export_active_view", "toolParameters": {}} -> Capture active Revit view (3D or 2D) and sync directly to Anarchy AI canvas.
25. {"type": "tool_call", "autodeskSoftware": "revit", "toolName": "extract_bim_data", "toolParameters": {}} -> Extract BIM metadata: levels, rooms, areas, elements, and schedules.
26. {"type": "tool_call", "autodeskSoftware": "revit", "toolName": "export_model", "toolParameters": {"format": "ifc" | "dwg"}} -> Export active Revit project to IFC or DWG file.

--- DESKTOP & CANVAS INTERACTION (SET-OF-MARKS GROUNDED) ---
27. {"type": "mouse_click", "targetId": "#1"} -> Click target UI element directly by Set-of-Marks ID (100% deterministic, no coordinate drift).
28. ${this.plannerProvider === 'gemini'
    ? '{"type": "mouse_click", "x": 500, "y": 500, "button": "left"} -> Click at screen coordinates. Output normalized coordinates strictly in range [0, 1000].'
    : `{"type": "mouse_click", "x": 640, "y": 360, "button": "left"} -> Click at screen pixel coordinates strictly in range [0, ${obs.screen?.width || 1280}] for X and [0, ${obs.screen?.height || 720}] for Y.`}
29. {"type": "send_keys", "text": "...", "keyCombo": ["ctrl", "s"]} -> Type text or hotkeys.
30. {"type": "focus_window", "windowTitlePattern": "3ds max"} -> Bring target window to front.
31. {"type": "canvas_action", "canvasAction": {"type": "fork_node", "label": "<Branch Label>", "prompt": "<architectural prompt>"}} -> Branch node on canvas with new design prompt.
32. {"type": "canvas_action", "canvasAction": {"type": "update_prompt", "prompt": "<refined architectural prompt>"}} -> Update prompt on active node.
33. {"type": "canvas_action", "canvasAction": {"type": "focus_node", "nodeId": "<nodeId>"}} -> Focus canvas camera on node.
34. {"type": "fetch_web_reference", "webQuery": "modern villa facade"} -> Fetch online reference image to canvas.
35. {"type": "wait", "durationMs": 1500} -> Wait for rendering or processing.
36. {"type": "complete", "completionSummary": "<Summary of what was achieved>"} -> Finish execution successfully.
37. {"type": "fail", "failureReason": "<Reason why goal cannot be achieved>"} -> Terminate execution with failure notice.

Decide the SINGLE next best action to advance towards the active sub-goal and user objective.
Respond strictly in JSON format:
{
  "thought": "<concise explanation in Arabic or English of what you observe and why you are taking this step>",
  "action": <Action Object>
}`;

    try {
      let raw = '';

      if (this.plannerProvider === 'openai') {
        let apiKey = this.openAIApiKey;
        if (!apiKey) {
          try {
            const secureKey = await invoke<string>('load_secure_key', { service: 'openai' });
            if (secureKey && typeof secureKey === 'string' && secureKey.trim().length > 0) {
              apiKey = secureKey.trim();
            }
          } catch (keyErr) {
            logger.warn('[CUA] Failed to load OpenAI key from secure storage:', keyErr);
          }
        }

        if (!apiKey) {
          return {
            thought: 'OpenAI API key is missing. No silent fallback to ensure transparency.',
            action: {
              type: 'fail',
              failureReason: 'مفتاح OpenAI API غير متوفر في التخزين الآمن. OpenAI API key not found in secure keyring. Please configure your key in settings.',
            },
          };
        }

        const contentItems: any[] = [{ type: 'text', text: prompt }];
        if (obs.screen?.image) {
          contentItems.push({
            type: 'image_url',
            image_url: {
              url: obs.screen.image.startsWith('data:') ? obs.screen.image : `data:image/jpeg;base64,${obs.screen.image}`,
              detail: 'high',
            },
          });
        }

        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey.trim()}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o',
              messages: [
                {
                  role: 'system',
                  content: "You are Anarchy Computer-Use Agent (CUA) — the elite autonomous multimodal intelligence operating Anarchy AI and Autodesk engineering software.",
                },
                {
                  role: 'user',
                  content: contentItems,
                },
              ],
              response_format: { type: 'json_object' },
              temperature: 0.2,
            }),
          });

          if (!response.ok) {
            const errBody = await response.text().catch(() => '');
            logger.error(`[CUA] OpenAI planner request failed with HTTP ${response.status}:`, errBody);
            return {
              thought: `OpenAI API returned HTTP ${response.status}. Execution stopped to avoid silent fallback.`,
              action: {
                type: 'fail',
                failureReason: `OpenAI GPT-4o request failed (HTTP error ${response.status}). Execution halted to prevent unselected fallback.`,
              },
            };
          }

          const data = await response.json();
          raw = data?.choices?.[0]?.message?.content || '';
        } catch (fetchErr: any) {
          logger.error('[CUA] OpenAI planner network error:', fetchErr);
          return {
            thought: `OpenAI network error: ${fetchErr?.message || fetchErr}`,
            action: {
              type: 'fail',
              failureReason: `Unable to connect to OpenAI API: ${fetchErr?.message || fetchErr}`,
            },
          };
        }
      } else {
        // Planner provider is 'gemini'
        const parts: any[] = [];
        if (obs.screen?.image) {
          parts.push({
            inlineData: {
              data: obs.screen.image.replace(/^data:image\/\w+;base64,/, ''),
              mimeType: 'image/jpeg',
            },
          });
        }
        parts.push({ text: prompt });

        raw = await geminiAgentService.chatWithGemini({
          systemPrompt: "You are Anarchy Computer-Use Agent (CUA) — the elite autonomous multimodal intelligence operating Anarchy AI and Autodesk engineering software.",
          messages: [
            {
              role: 'user',
              parts,
            },
          ],
          model: 'gemini-3.6-flash',
        });
      }

      const cleanRaw = raw.trim();
      const jsonMatch = cleanRaw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.thought && parsed.action && parsed.action.type) {
          return {
            thought: parsed.thought,
            action: parsed.action,
          };
        }
      }

      // Check UI-TARS action syntax (Thought: ... Action: ...)
      const uiTarsParsed = parseUITARSAction(cleanRaw);
      if (uiTarsParsed && uiTarsParsed.action) {
        return {
          thought: uiTarsParsed.thought || 'UI-TARS visual action executed',
          action: uiTarsParsed.action,
        };
      }
    } catch (err) {
      logger.warn('[CUA] Multimodal planner fallback triggered:', err);
    }

    // Diagnostic Fallback: If LLM is unavailable or failed to respond, return explicit fail action
    logger.warn('[CUA] Model visual planner is unavailable or failed to produce structured plan.');
    return {
      thought: 'Visual model connection or parsing error.',
      action: {
        type: 'fail',
        failureReason: 'Visual planning model unavailable or quota exceeded; halted execution cleanly.',
      },
    };
  }
}

export function parseUITARSAction(text: string): { thought?: string; action?: CUAAction } | null {
  const thoughtMatch = text.match(/Thought:\s*(.*?)(?=\nAction:|$)/is);
  const actionMatch = text.match(/Action:\s*(.*?)$/is);

  const thought = thoughtMatch ? thoughtMatch[1].trim() : undefined;
  const actionText = actionMatch ? actionMatch[1].trim() : text.trim();

  // 1. click(target='#1') or click('#1') or click(point='#1') [Set-of-Marks UI Grounding]
  const targetMatch = actionText.match(/click\((?:target=|point=)?['"]?(#\d+)['"]?\)/i);
  if (targetMatch) {
    return {
      thought,
      action: {
        type: 'mouse_click',
        targetId: targetMatch[1],
        button: 'left',
      },
    };
  }

  // 2. Architectural Super-Tools Direct Calls
  if (/export_cad|generate_dxf/i.test(actionText)) {
    return {
      thought,
      action: { type: 'export_cad' },
    };
  }
  if (/export_bim|speckle/i.test(actionText)) {
    return {
      thought,
      action: { type: 'export_bim' },
    };
  }
  if (/export_boq|generate_boq/i.test(actionText)) {
    return {
      thought,
      action: { type: 'export_boq' },
    };
  }
  if (/analyze_solar/i.test(actionText)) {
    return {
      thought,
      action: { type: 'analyze_solar' },
    };
  }
  if (/calculate_zoning/i.test(actionText)) {
    return {
      thought,
      action: { type: 'calculate_zoning' },
    };
  }
  if (/create_presentation|export_presentation/i.test(actionText)) {
    return {
      thought,
      action: { type: 'create_presentation' },
    };
  }
  if (/query_codes/i.test(actionText)) {
    const qMatch = actionText.match(/query_codes\((?:query=)?['"]([\s\S]*?)['"]\)/i);
    return {
      thought,
      action: { type: 'query_codes', codeQueryParams: { query: qMatch ? qMatch[1] : (thought || '') } },
    };
  }

  // 3. click(point='[x, y]')
  const clickMatch = actionText.match(/click\(point=['"]?\[\s*(\d+)\s*,\s*(\d+)\s*\]['"]?\)/i);
  if (clickMatch) {
    return {
      thought,
      action: {
        type: 'mouse_click',
        x: parseInt(clickMatch[1], 10),
        y: parseInt(clickMatch[2], 10),
        button: 'left',
      },
    };
  }

  // 2. right_click(point='[x, y]')
  const rightClickMatch = actionText.match(/right_click\(point=['"]?\[\s*(\d+)\s*,\s*(\d+)\s*\]['"]?\)/i);
  if (rightClickMatch) {
    return {
      thought,
      action: {
        type: 'mouse_click',
        x: parseInt(rightClickMatch[1], 10),
        y: parseInt(rightClickMatch[2], 10),
        button: 'right',
      },
    };
  }

  // 3. left_double_click(point='[x, y]')
  const dblClickMatch = actionText.match(/left_double_click\(point=['"]?\[\s*(\d+)\s*,\s*(\d+)\s*\]['"]?\)/i);
  if (dblClickMatch) {
    return {
      thought,
      action: {
        type: 'mouse_click',
        x: parseInt(dblClickMatch[1], 10),
        y: parseInt(dblClickMatch[2], 10),
        doubleClick: true,
      },
    };
  }

  // 4. drag(start_point='[x1, y1]', end_point='[x2, y2]')
  const dragMatch = actionText.match(/drag\(start_point=['"]?\[\s*(\d+)\s*,\s*(\d+)\s*\]['"]?,\s*end_point=['"]?\[\s*(\d+)\s*,\s*(\d+)\s*\]['"]?\)/i);
  if (dragMatch) {
    return {
      thought,
      action: {
        type: 'mouse_drag',
        fromX: parseInt(dragMatch[1], 10),
        fromY: parseInt(dragMatch[2], 10),
        toX: parseInt(dragMatch[3], 10),
        toY: parseInt(dragMatch[4], 10),
      },
    };
  }

  // 5. type(content='...')
  const typeMatch = actionText.match(/type\(content=['"]([\s\S]*?)['"]\)/i);
  if (typeMatch) {
    return {
      thought,
      action: {
        type: 'send_keys',
        text: typeMatch[1],
      },
    };
  }

  // 6. hotkey(key='ctrl+s')
  const hotkeyMatch = actionText.match(/hotkey\(key=['"]([\s\S]*?)['"]\)/i);
  if (hotkeyMatch) {
    const keys = hotkeyMatch[1].split('+').map((k) => k.trim());
    return {
      thought,
      action: {
        type: 'send_keys',
        keyCombo: keys,
      },
    };
  }

  // 7. scroll(direction='down')
  const scrollMatch = actionText.match(/scroll\(direction=['"](down|up)['"]\)/i);
  if (scrollMatch) {
    return {
      thought,
      action: {
        type: 'mouse_scroll',
        scrollDirection: scrollMatch[1].toLowerCase() as 'down' | 'up',
      },
    };
  }

  // 8. finished()
  if (/finished\(\)|complete\(\)/i.test(actionText)) {
    return {
      thought,
      action: {
        type: 'complete',
        completionSummary: thought || 'Task execution finished successfully.',
      },
    };
  }

  return null;
}

export const computerUseAgent = ComputerUseAgentService.getInstance();

export interface DetectedAutodeskIntent {
  isAutodeskCommand: boolean;
  software: '3dsmax' | 'autocad' | 'revit';
  action: 'viewport_sync' | 'execute_script';
  script?: string;
  description: string;
}

export function detectAutodeskIntent(text: string): DetectedAutodeskIntent | null {
  const t = text.toLowerCase();

  // Strict regex matching for target software names with word boundaries
  // Prevents false positives like "academic", "maximum", "gravity"
  const is3dsMax = /(?:\b3ds\s*max\b|\b3dsmax\b|ماكس|الماكس)/i.test(t);
  const isAutoCAD = /(?:\bautocad\b|\bacad\b|اوتوكاد|أوتوكاد)/i.test(t);
  const isRevit = /(?:\brevit\b|ريفيت|ريفت)/i.test(t);

  // Require EXPLICIT software mention to prevent executing from ordinary architectural chat
  // (e.g. "حلل كتلة 20 متر للمبنى" or "اعمل كتلة 3 طوابق" or "academic research")
  if (!is3dsMax && !isAutoCAD && !isRevit) {
    return null;
  }

  const software = isAutoCAD ? 'autocad' : isRevit ? 'revit' : '3dsmax';

  // Ignore questions and informational queries (e.g. "how do I model...", "شلون اسوي مودل...", "كيف أعمل...")
  const isQuestion = /(?:\bhow\b|\bwhy\b|\bwhat\b|شلون|كيف|هل|لماذا|\?|؟)/i.test(t);
  if (isQuestion) {
    return null;
  }

  // 1. Viewport sync intent (e.g. "سينك الماكس", "sync 3ds max viewport", "اسحب المشهد")
  if (/سينك|مزامنة|اسحب المشهد|\bviewport\b|\bsync viewport\b/i.test(t)) {
    return {
      isAutodeskCommand: true,
      software,
      action: 'viewport_sync',
      description: `Synchronize 3D viewport from ${software} with Anarchy AI`,
    };
  }

  // 2. Explicit Parametric Box / Mass creation with dimensions in 3ds Max (e.g. "افتح الماكس وضع بوكس 5 في 5" or "3ds max create box 5x5")
  if (software === '3dsmax') {
    const isBoxDirective = /(?:انشئ|أنشئ|ضع|اعمل|create|add|make)\s*(?:بوكس|مكعب|box)/i.test(t);
    const boxMatch = t.match(/(?:بوكس|مكعب|box)\s*(\d+(?:\.\d+)?)(?:\s*(?:في|x|\*|by)\s*(\d+(?:\.\d+)?))?(?:\s*(?:في|x|\*|by)\s*(\d+(?:\.\d+)?))?/i);
    if (isBoxDirective && boxMatch) {
      const d1 = Math.max(0.1, Math.min(1000.0, parseFloat(boxMatch[1])));
      const d2 = boxMatch[2] ? Math.max(0.1, Math.min(1000.0, parseFloat(boxMatch[2]))) : d1;
      const d3 = boxMatch[3] ? Math.max(0.1, Math.min(1000.0, parseFloat(boxMatch[3]))) : 3.0;

      const script = [
        `-- Anarchy AI Autonomous CUA Agent - Scaled Parametric Box`,
        `undo "Anarchy AI Create Box" on (`,
        `    try (`,
        `        local unitScale = case units.SystemType of (`,
        `            #millimeters: 1000.0`,
        `            #centimeters: 100.0`,
        `            #meters: 1.0`,
        `            #inches: 39.3701`,
        `            #feet: 3.28084`,
        `            default: 1.0`,
        `        )`,
        `        local b = box length:(${d1} * unitScale) width:(${d2} * unitScale) height:(${d3} * unitScale) pos:[0,0,0]`,
        `        b.name = "ArchVision_Box_${d1}x${d2}"`,
        `        b.wirecolor = (color 220 80 50)`,
        `        select b`,
        `        max zoomext sel`,
        `        try ( sendViewportToAnarchy() ) catch ()`,
        `        format "Created box %x%x% (system units: %)\\n" ${d1} ${d2} ${d3} units.SystemType`,
        `    ) catch ( format "Error: %\\n" (getCurrentException()) )`,
        `)`,
      ].join('\n');

      return {
        isAutodeskCommand: true,
        software: '3dsmax',
        action: 'execute_script',
        script,
        description: `Create ${d1}x${d2}x${d3}m Box in 3ds Max and synchronize viewport`,
      };
    }
  }

  // 3. Explicit Revit Parametric Modeling / BIM intent
  if (software === 'revit') {
    // Villa / Building generation
    if (/(?:انشئ|أنشئ|ابني|ابنِ|سوي|اصنع|create|build|make)\s*(?:فيلا|بيت|منزل|مبنى|villa|house|building)/i.test(t)) {
      return {
        isAutodeskCommand: true,
        software: 'revit',
        action: 'execute_script',
        script: 'create_architectural_villa',
        description: 'Generate parametric architectural villa with levels, walls, and openings in Revit',
      };
    }
    // Wall creation
    if (/(?:انشئ|أنشئ|ابني|ابنِ|ارسم|ضع|create|build|draw)\s*(?:جدران|حائط|جدار|walls|wall)/i.test(t)) {
      return {
        isAutodeskCommand: true,
        software: 'revit',
        action: 'execute_script',
        script: 'create_walls',
        description: 'Create parametric architectural walls in Revit',
      };
    }
    // BIM data extraction
    if (/(?:بيانات|غرف|مساحات|bim|metadata|rooms|areas|جدول)/i.test(t)) {
      return {
        isAutodeskCommand: true,
        software: 'revit',
        action: 'execute_script',
        script: 'extract_bim_data',
        description: 'Extract BIM project metadata, rooms, areas, and element counts from Revit',
      };
    }
    // Camera / 3D Perspective
    if (/(?:كاميرا|كامرا|منظور|camera|perspective|view)/i.test(t)) {
      return {
        isAutodeskCommand: true,
        software: 'revit',
        action: 'execute_script',
        script: 'set_camera',
        description: 'Configure Revit 3D perspective camera at human eye level',
      };
    }
  }

  // 4. Explicit Open / Launch intent (e.g. "افتح الماكس", "open 3ds max", "launch revit")
  if (/افتح|شغل|\bopen\b|\blaunch\b|\bstart\b/i.test(t)) {
    return {
      isAutodeskCommand: true,
      software,
      action: 'viewport_sync',
      description: `Launch and bring ${software} to front`,
    };
  }

  return null;
}

export function formatCuaOutputMessage(output: string | undefined): string | undefined {
  if (!output) return undefined;
  const trimmed = output.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.message) {
        if (parsed.scene_bounds && parsed.total_objects !== undefined) {
          const dims = parsed.scene_bounds?.dimensions_m;
          const dimStr = dims ? ` (Dimensions: ${dims[0]}x${dims[1]}x${dims[2]}m)` : '';
          return `${parsed.message}${dimStr}`;
        }
        return parsed.message;
      }
    } catch {}
  }
  return output;
}



