import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computerUseAgent, type CUAAction } from './ComputerUseAgentService';
import * as tauriApi from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('./CanvasBridgeService', () => ({
  canvasBridge: {
    getActiveNode: vi.fn().mockReturnValue(null),
    getCanvasImages: vi.fn().mockReturnValue([]),
    executeCanvasAction: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
  },
}));
vi.mock('../../stores/aiConfigStore', () => ({
  useAIConfigStore: { getState: vi.fn().mockReturnValue({ workspacePrompt: '' }) },
}));
vi.mock('../gemini/GeminiAgentService', () => ({
  geminiAgentService: { chatWithGemini: vi.fn() },
}));

const invoke = tauriApi.invoke as unknown as ReturnType<typeof vi.fn>;

async function plannerReturns(action: CUAAction) {
  const { geminiAgentService } = await import('../gemini/GeminiAgentService');
  (geminiAgentService.chatWithGemini as any).mockResolvedValue(JSON.stringify({ thought: 't', action }));
}

/** Screen capture mock: constant image (=> "nothing changed") or a new image per call. */
function mockDesktop(changing: boolean) {
  let n = 0;
  invoke.mockImplementation(async (cmd: string) => {
    if (cmd === 'cua_get_active_windows') return [];
    if (cmd === 'cua_capture_screen') {
      n += 1;
      return { image: `data:image/jpeg;base64,${changing ? `frame${n}` : 'same'}`, width: 1920, height: 1080 };
    }
    return { success: true };
  });
}

const sentKeys = () => invoke.mock.calls.filter((c) => c[0] === 'cua_send_keys').length;

beforeEach(() => {
  vi.clearAllMocks();
  computerUseAgent.setApprovalPolicy('prompt');
  computerUseAgent.setApprovalHandler(null);
});

describe('CUA risk classification', () => {
  const cases: Array<[string, CUAAction, 'safe' | 'approval' | 'blocked']> = [
    ['typing text', { type: 'send_keys', text: 'rm -rf /' }, 'approval'],
    ['ctrl+s', { type: 'send_keys', keyCombo: ['ctrl', 's'] }, 'approval'],
    ['undo', { type: 'send_keys', keyCombo: ['ctrl', 'z'] }, 'safe'],
    ['escape', { type: 'send_keys', keyCombo: ['escape'] }, 'safe'],
    ['win+r (run dialog)', { type: 'send_keys', keyCombo: ['win', 'r'] }, 'blocked'],
    ['ctrl+alt+del', { type: 'send_keys', keyCombo: ['ctrl', 'alt', 'delete'] }, 'blocked'],
    ['launch app', { type: 'launch_app', appName: 'cmd' }, 'approval'],
    ['backend skill', { type: 'execute_arch_skill' }, 'approval'],
    ['memory write', { type: 'manage_memory', memoryParams: { action: 'add', content: 'x' } }, 'approval'],
    ['memory read', { type: 'manage_memory', memoryParams: { action: 'get', query: 'x' } }, 'safe'],
    ['raw autodesk script', { type: 'autodesk_action', autodeskAction: 'execute_script', autodeskScript: 'box()' }, 'approval'],
    ['structured tool call', { type: 'tool_call', toolName: 'create_box' }, 'safe'],
    ['viewport sync', { type: 'autodesk_action', autodeskAction: 'viewport_sync' }, 'safe'],
    ['wait', { type: 'wait', durationMs: 10 }, 'safe'],
  ];
  it.each(cases)('%s => %s', (_label, action, level) => {
    expect(computerUseAgent.classifyActionRisk(action).level).toBe(level);
  });
});

describe('CUA approval gate in the autonomous loop', () => {
  it('denies risky actions by default when nobody can approve (fail closed)', async () => {
    mockDesktop(true);
    await plannerReturns({ type: 'send_keys', text: 'hello' });
    const res = await computerUseAgent.executeAutonomousTask('type something', { maxSteps: 5 });
    expect(res.success).toBe(false);
    expect(res.message).toContain('blocked or not approved');
    expect(sentKeys()).toBe(0);
  });

  it('runs the action once the registered handler approves', async () => {
    mockDesktop(true);
    const handler = vi.fn().mockResolvedValue(true);
    computerUseAgent.setApprovalHandler(handler);
    await plannerReturns({ type: 'send_keys', text: 'hello' });
    await computerUseAgent.executeAutonomousTask('type something', { maxSteps: 1 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].reason).toContain('types text');
    expect(sentKeys()).toBe(1);
  });

  it('does not run the action when the user rejects', async () => {
    mockDesktop(true);
    computerUseAgent.setApprovalHandler(async () => false);
    await plannerReturns({ type: 'launch_app', appName: 'notepad' });
    await computerUseAgent.executeAutonomousTask('open notepad', { maxSteps: 3 });
    expect(invoke.mock.calls.some((c) => c[0] === 'cua_launch_app')).toBe(false);
  });

  it('treats an unanswered approval request as denied (timeout)', async () => {
    mockDesktop(true);
    computerUseAgent.setApprovalTimeoutMs(50);
    computerUseAgent.setApprovalHandler(() => new Promise<boolean>(() => {})); // user never answers
    await plannerReturns({ type: 'send_keys', text: 'x' });
    await computerUseAgent.executeAutonomousTask('t', { maxSteps: 2 });
    computerUseAgent.setApprovalTimeoutMs(120_000);
    expect(sentKeys()).toBe(0);
  });

  it('fails closed if the approval UI throws', async () => {
    mockDesktop(true);
    computerUseAgent.setApprovalHandler(async () => { throw new Error('modal crashed'); });
    await plannerReturns({ type: 'send_keys', text: 'x' });
    await computerUseAgent.executeAutonomousTask('t', { maxSteps: 2 });
    expect(sentKeys()).toBe(0);
  });

  it("'auto' policy skips the prompt but still refuses blocked key combos", async () => {
    mockDesktop(true);
    computerUseAgent.setApprovalPolicy('auto');
    await plannerReturns({ type: 'send_keys', keyCombo: ['win', 'r'] });
    await computerUseAgent.executeAutonomousTask('open run dialog', { maxSteps: 3 });
    expect(sentKeys()).toBe(0);

    await plannerReturns({ type: 'send_keys', text: 'ok' });
    await computerUseAgent.executeAutonomousTask('type', { maxSteps: 1 });
    expect(sentKeys()).toBe(1);
  });

  it('safe actions need no approval', async () => {
    mockDesktop(true);
    await plannerReturns({ type: 'send_keys', keyCombo: ['ctrl', 'z'] });
    await computerUseAgent.executeAutonomousTask('undo', { maxSteps: 1 });
    expect(sentKeys()).toBe(1);
  });
});

describe('CUA verification is evidence-based', () => {
  it('flags a click as UNVERIFIED when the screen is identical afterwards', async () => {
    mockDesktop(false);
    await plannerReturns({ type: 'mouse_click', x: 500, y: 500 });
    const steps: any[] = [];
    await computerUseAgent.executeAutonomousTask('click the button', { maxSteps: 1, onStep: (s) => steps.push(s) });
    expect(steps[0].result.success).toBe(false);
    expect(steps[0].result.message).toContain('UNVERIFIED');
  });

  it('accepts the click when the screen changed', async () => {
    mockDesktop(true);
    await plannerReturns({ type: 'mouse_click', x: 500, y: 500 });
    const steps: any[] = [];
    await computerUseAgent.executeAutonomousTask('click the button', { maxSteps: 1, onStep: (s) => steps.push(s) });
    expect(steps[0].result.success).toBe(true);
  });

  it('does not accept "complete" right after a failed step', async () => {
    mockDesktop(false);
    const { geminiAgentService } = await import('../gemini/GeminiAgentService');
    (geminiAgentService.chatWithGemini as any)
      .mockResolvedValueOnce(JSON.stringify({ thought: 'plan', action: { type: 'wait', durationMs: 1 } })) // plan creation (ignored/parsed leniently)
      .mockResolvedValueOnce(JSON.stringify({ thought: 'click', action: { type: 'mouse_click', x: 1, y: 1 } }))
      .mockResolvedValue(JSON.stringify({ thought: 'done?', action: { type: 'complete', completionSummary: 'all good' } }));
    const res = await computerUseAgent.executeAutonomousTask('click then finish', { maxSteps: 4 });
    expect(res.success).toBe(false);
    expect(res.message).toBe('all good'); // returned by the *rejection* branch, not by hitting the step limit
  });

  it('default completion message no longer claims visual verification', async () => {
    mockDesktop(true);
    await plannerReturns({ type: 'complete' });
    const res = await computerUseAgent.executeAutonomousTask('nothing to do', { maxSteps: 2 });
    expect(res.success).toBe(true);
    expect(res.message).not.toContain('visually verified');
  });
});

describe('CUA target window bounds enforcement', () => {
  it('clamps coordinates strictly inside target window boundaries', async () => {
    mockDesktop(true);
    const targetScreen = {
      image: 'data:image/jpeg;base64,mock',
      width: 1000,
      height: 800,
      original_width: 1000,
      original_height: 800,
      origin_x: 200,
      origin_y: 100,
      window_title: 'Autodesk 3ds Max 2026',
    };
    (tauriApi.invoke as any).mockImplementation((cmd: string) => {
      if (cmd === 'cua_capture_screen') return Promise.resolve(targetScreen);
      if (cmd === 'cua_get_active_windows') return Promise.resolve([]);
      return Promise.resolve(undefined);
    });

    await computerUseAgent.observe('3ds max');

    await computerUseAgent.executeAction({
      type: 'mouse_click',
      x: 5000,
      y: 5000,
      isNormalized: false,
    });

    expect(tauriApi.invoke).toHaveBeenCalledWith('cua_mouse_click', expect.objectContaining({
      x: 1198,
      y: 898,
      targetWindow: 'Autodesk 3ds Max 2026',
    }));
  });
});

