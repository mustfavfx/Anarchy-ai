import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computerUseAgent, detectAutodeskIntent, type CUAAction } from './ComputerUseAgentService';
import { canvasBridge } from './CanvasBridgeService';
import * as tauriApi from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('./CanvasBridgeService', () => ({
  canvasBridge: {
    getActiveNode: vi.fn().mockReturnValue({ id: 'node_test_1', prompt: 'Modern Villa' }),
    getCanvasImages: vi.fn().mockReturnValue([{ id: 'node_test_1', prompt: 'Modern Villa' }]),
    executeCanvasAction: vi.fn().mockResolvedValue({ success: true, message: 'Action executed' }),
  },
}));

vi.mock('../../stores/aiConfigStore', () => ({
  useAIConfigStore: {
    getState: vi.fn().mockReturnValue({
      workspacePrompt: 'Modern Villa Exterior',
    }),
  },
}));

vi.mock('../gemini/GeminiAgentService', () => ({
  geminiAgentService: {
    chatWithGemini: vi.fn().mockResolvedValue(
      JSON.stringify({
        thought: 'Capture viewport from 3ds Max',
        action: {
          type: 'autodesk_action',
          autodeskSoftware: '3dsmax',
          autodeskAction: 'viewport_sync',
        },
      })
    ),
  },
}));

describe('ComputerUseAgentService (CUA Engine)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('observes environment by querying active windows and screen metrics', async () => {
    (tauriApi.invoke as any).mockImplementation((cmd: string) => {
      if (cmd === 'cua_get_active_windows') {
        return Promise.resolve([
          {
            id: 1234,
            title: 'Autodesk 3ds Max 2027',
            process_id: 77412,
            rect: { x: 0, y: 0, width: 1920, height: 1080 },
            is_autodesk: true,
            is_minimized: false,
          },
        ]);
      }
      if (cmd === 'cua_capture_screen') {
        return Promise.resolve({
          image: 'data:image/jpeg;base64,mock',
          width: 1280,
          height: 720,
        });
      }
      return Promise.resolve();
    });

    const obs = await computerUseAgent.observe();
    expect(obs.autodesk.is3dsMaxRunning).toBe(true);
    expect(obs.windows.length).toBe(1);
    expect(obs.screen?.width).toBe(1280);
    expect(obs.canvasNode?.id).toBe('node_test_1');
  });

  it('executes canvas actions via CanvasBridgeService', async () => {
    const action: CUAAction = {
      type: 'canvas_action',
      canvasAction: {
        type: 'fork_node',
        label: 'Night Villa',
        prompt: 'Luxury lighting at dusk',
      },
    };

    const res = await computerUseAgent.executeAction(action);
    expect(res.success).toBe(true);
    expect(canvasBridge.executeCanvasAction).toHaveBeenCalledWith(action.canvasAction);
  });

  it('executes precision autodesk actions via Tauri command dispatch', async () => {
    (tauriApi.invoke as any).mockResolvedValue({
      id: 'cmd_123',
      success: true,
      output: 'Viewport synchronized to Anarchy AI',
    });

    const action: CUAAction = {
      type: 'autodesk_action',
      autodeskSoftware: '3dsmax',
      autodeskAction: 'viewport_sync',
    };

    const res = await computerUseAgent.executeAction(action);
    expect(res.success).toBe(true);
    expect(tauriApi.invoke).toHaveBeenCalledWith('cua_dispatch_autodesk_command', expect.objectContaining({
      software: '3dsmax',
      action: 'viewport_sync',
    }));
  });

  it('transforms coordinates accurately across resolutions and offsets', () => {
    // 1. Normalized [0, 1000] coordinates on 1280x720 capture of 1920x1080 screen with offset
    const screen = {
      image: 'mock',
      width: 1280,
      height: 720,
      original_width: 1920,
      original_height: 1080,
      origin_x: 100,
      origin_y: 50,
      scale_factor: 1280 / 1920,
    };

    const resNorm = computerUseAgent.transformCoordinates(500, 500, screen, true);
    // x: 100 + (500/1000)*1920 = 100 + 960 = 1060
    // y: 50 + (500/1000)*1080 = 50 + 540 = 590
    expect(resNorm.x).toBe(1060);
    expect(resNorm.y).toBe(590);

    // 2. Direct captured pixel coordinate (640, 360) on 1280x720 capture of 1920x1080 screen (offset 0,0)
    const screenDirect = {
      image: 'mock',
      width: 1280,
      height: 720,
      original_width: 1920,
      original_height: 1080,
      origin_x: 0,
      origin_y: 0,
      scale_factor: 1280 / 1920,
    };

    const resPixel = computerUseAgent.transformCoordinates(640, 360, screenDirect, false);
    // x: 640 * (1920 / 1280) = 640 * 1.5 = 960
    // y: 360 * (1080 / 720) = 360 * 1.5 = 540
    expect(resPixel.x).toBe(960);
    expect(resPixel.y).toBe(540);
  });

  it('verifies that prompt text with user goal is passed in parts alongside screenshot', async () => {
    (tauriApi.invoke as any).mockResolvedValue({ success: true });
    const { geminiAgentService } = await import('../gemini/GeminiAgentService');
    let capturedParams: any = null;
    (geminiAgentService.chatWithGemini as any).mockImplementation((params: any) => {
      capturedParams = params;
      return Promise.resolve(JSON.stringify({
        thought: 'Plan confirmed',
        action: { type: 'complete', completionSummary: 'Done' }
      }));
    });

    await computerUseAgent.executeAutonomousTask('Design modern parametric facade', { maxSteps: 1 });

    expect(capturedParams).not.toBeNull();
    const parts = capturedParams.messages[0].parts;
    const textPart = parts.find((p: any) => p.text && p.text.includes('USER GOAL:'));
    expect(textPart).toBeDefined();
    expect(textPart.text).toContain('Design modern parametric facade');
    expect(textPart.text).toContain('Output normalized coordinates strictly in range [0, 1000]');
    expect(textPart.text).toContain('get_scene_info');
    expect(textPart.text).toContain('render_preview');
  });

  it('aborts immediately and returns success: false', async () => {
    (tauriApi.invoke as any).mockResolvedValue({ success: true });
    const { geminiAgentService } = await import('../gemini/GeminiAgentService');
    (geminiAgentService.chatWithGemini as any).mockImplementation(async () => {
      // Simulate user abort during reasoning phase
      computerUseAgent.abort();
      return JSON.stringify({
        thought: 'Thinking...',
        action: { type: 'wait', durationMs: 500 }
      });
    });

    const res = await computerUseAgent.executeAutonomousTask('Task to be aborted', { maxSteps: 3 });
    expect(res.success).toBe(false);
    expect(res.message).toContain('aborted');
  });

  it('rejects ordinary architectural discourse without explicit software invocation in detectAutodeskIntent', async () => {
    const { detectAutodeskIntent } = await import('./ComputerUseAgentService');

    // Negative tests: ordinary architectural terms should NOT trigger 3ds Max box creation!
    expect(detectAutodeskIntent('حلل كتلة 20 متر للمبنى')).toBeNull();
    expect(detectAutodeskIntent('اعمل كتلة 3 طوابق بواجهة ترافرتين')).toBeNull();
    expect(detectAutodeskIntent('شنو رايك بالمكعب 2 متر')).toBeNull();
    expect(detectAutodeskIntent('open academic papers regarding parametric design')).toBeNull();

    // Negative tests: questions, render queries, and unsupported commands must NEVER trigger blind script execution!
    expect(detectAutodeskIntent('اعمل رندر بالماكس')).toBeNull();
    expect(detectAutodeskIntent('شلون اسوي مودل لمبنى بالماكس؟')).toBeNull();
    expect(detectAutodeskIntent('how do I model a building in 3ds max')).toBeNull();
    expect(detectAutodeskIntent('نفذ لي مقطع في ريفيت')).toBeNull();
    expect(detectAutodeskIntent('make this facade with 3ds max')).toBeNull();

    // Positive test 1: explicit 3ds Max instruction with dimensions
    const positive = detectAutodeskIntent('افتح الماكس وضع بوكس 5 في 5');
    expect(positive).not.toBeNull();
    expect(positive?.software).toBe('3dsmax');
    expect(positive?.action).toBe('execute_script');
    expect(positive?.script).toContain('unitScale');
    expect(positive?.script).toContain('undo "Anarchy AI Create Box"');

    // Positive test 2: explicit viewport sync
    const syncPositive = detectAutodeskIntent('سينك الماكس');
    expect(syncPositive).not.toBeNull();
    expect(syncPositive?.software).toBe('3dsmax');
    expect(syncPositive?.action).toBe('viewport_sync');
  });

  it('dispatches mouse and keyboard events cleanly', async () => {
    (tauriApi.invoke as any).mockResolvedValue(undefined);

    await computerUseAgent.executeAction({
      type: 'mouse_click',
      x: 500,
      y: 300,
      button: 'left',
    });

    expect(tauriApi.invoke).toHaveBeenCalledWith('cua_mouse_click', expect.objectContaining({
      button: 'left',
      doubleClick: false,
    }));

    await computerUseAgent.executeAction({
      type: 'mouse_scroll',
      scrollDirection: 'down',
      scrollAmount: 3,
    });

    expect(tauriApi.invoke).toHaveBeenCalledWith('cua_mouse_scroll', {
      direction: 'down',
      amount: 3,
    });

    await computerUseAgent.executeAction({
      type: 'send_keys',
      text: 'Render Scene',
      keyCombo: ['ctrl', 's'],
    });

    expect(tauriApi.invoke).toHaveBeenCalledWith('cua_send_keys', {
      text: 'Render Scene',
      keyCombo: ['ctrl', 's'],
    });
  });

  it('correctly parses UI-TARS action syntax (Grounding Protocol)', async () => {
    const { parseUITARSAction } = await import('./ComputerUseAgentService');

    const clickRes = parseUITARSAction("Thought: Click the render button\nAction: click(point='[640, 480]')");
    expect(clickRes).not.toBeNull();
    expect(clickRes?.action?.type).toBe('mouse_click');
    expect(clickRes?.action?.x).toBe(640);
    expect(clickRes?.action?.y).toBe(480);

    const dragRes = parseUITARSAction("Thought: Drag slider\nAction: drag(start_point='[100, 200]', end_point='[300, 200]')");
    expect(dragRes?.action?.type).toBe('mouse_drag');
    expect(dragRes?.action?.fromX).toBe(100);
    expect(dragRes?.action?.toX).toBe(300);

    const hotkeyRes = parseUITARSAction("Action: hotkey(key='ctrl+s')");
    expect(hotkeyRes?.action?.type).toBe('send_keys');
    expect(hotkeyRes?.action?.keyCombo).toEqual(['ctrl', 's']);

    const scrollRes = parseUITARSAction("Action: scroll(direction='down')");
    expect(scrollRes?.action?.type).toBe('mouse_scroll');
    expect(scrollRes?.action?.scrollDirection).toBe('down');
  });

  it('runs an autonomous task loop with step notifications and completion', async () => {
    (tauriApi.invoke as any).mockResolvedValue({ success: true, message: 'OK' });
    const { geminiAgentService } = await import('../gemini/GeminiAgentService');
    (geminiAgentService.chatWithGemini as any)
      .mockResolvedValueOnce(
        JSON.stringify({
          thought: 'Sync 3ds max viewport',
          action: { type: 'autodesk_action', autodeskSoftware: '3dsmax', autodeskAction: 'viewport_sync' },
        })
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          thought: 'Finish task after visual confirmation',
          action: { type: 'complete', completionSummary: 'Viewport synchronized and verified.' },
        })
      );

    const stepEvents: any[] = [];
    const result = await computerUseAgent.executeAutonomousTask('Enhance 3ds Max viewport with dusk lighting', {
      maxSteps: 3,
      onStep: (step) => stepEvents.push(step),
    });

    expect(result.success).toBe(true);
    expect(stepEvents.length).toBe(2);
    expect(result.message).toContain('verified');
  });

  it('fails honestly when reaching maximum steps without reaching complete action', async () => {
    (tauriApi.invoke as any).mockResolvedValue({ success: true, message: 'OK' });
    const { geminiAgentService } = await import('../gemini/GeminiAgentService');
    (geminiAgentService.chatWithGemini as any).mockResolvedValue(
      JSON.stringify({
        thought: 'Taking another action',
        action: { type: 'wait', durationMs: 10 },
      })
    );

    const result = await computerUseAgent.executeAutonomousTask('Long running task', {
      maxSteps: 2,
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('maximum execution limit');
  });

  it('executes direct Autodesk command with auto-launch and script dispatch', async () => {
    (tauriApi.invoke as any).mockImplementation(async (cmd: string, _args: any) => {
      if (cmd === 'cua_launch_app') return '3ds Max launched successfully';
      if (cmd === 'cua_dispatch_autodesk_command') {
        return {
          id: 'cmd_test',
          success: true,
          output: 'Box created and centered successfully',
        };
      }
      return { success: true };
    });

    const res = await computerUseAgent.executeAutodeskCommand({
      software: '3dsmax',
      action: 'execute_script',
      script: 'box length:5 width:5 height:5 pos:[0,0,0]',
      autoLaunch: true,
    });

    expect(res.success).toBe(true);
    expect(tauriApi.invoke).toHaveBeenCalledWith('cua_launch_app', { appName: '3dsmax' });
    expect(tauriApi.invoke).toHaveBeenCalledWith('cua_dispatch_autodesk_command', expect.objectContaining({
      software: '3dsmax',
      action: 'execute_script',
    }));
  });

  it('switches planner provider and dispatches structured tool_call', async () => {
    (tauriApi.invoke as any).mockResolvedValue({
      id: 'tool_test',
      success: true,
      output: 'Pymxs tool executed',
    });

    expect(computerUseAgent.getPlannerProvider()).toBe('gemini');
    computerUseAgent.setPlannerProvider('openai', 'sk-test-key');
    expect(computerUseAgent.getPlannerProvider()).toBe('openai');

    const res = await computerUseAgent.executeAction({
      type: 'tool_call',
      autodeskSoftware: '3dsmax',
      toolName: 'create_box',
      params: { length: 10, width: 8, height: 3.2, name: 'MainFacadeBlock' },
    });

    expect(res.success).toBe(true);
    expect(tauriApi.invoke).toHaveBeenCalledWith('cua_dispatch_autodesk_command', expect.objectContaining({
      software: '3dsmax',
      action: 'tool_call',
      script: 'create_box',
      params: expect.objectContaining({
        tool_name: 'create_box',
        length: 10,
        width: 8,
        height: 3.2,
        name: 'MainFacadeBlock',
      }),
    }));

    // Reset back to gemini
    computerUseAgent.setPlannerProvider('gemini');
    expect(computerUseAgent.getPlannerProvider()).toBe('gemini');
  });

  it('plans action via OpenAI when provider is set to openai', async () => {
    computerUseAgent.setPlannerProvider('openai', 'sk-openai-key');
    (tauriApi.invoke as any).mockResolvedValue({ success: true });

    // Mock global fetch for OpenAI completion
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                thought: 'Creating physical camera in 3ds Max',
                action: {
                  type: 'tool_call',
                  autodeskSoftware: '3dsmax',
                  toolName: 'set_camera',
                  params: { pos_x: 20, pos_y: -25, pos_z: 15, target_x: 0, target_y: 0, target_z: 2 },
                },
              }),
            },
          },
        ],
      }),
    } as any);

    try {
      const plan = await (computerUseAgent as any).planNextAction(
        'Set eye-level camera for facade perspective',
        [],
        {
          windows: [],
          autodesk: { is3dsMaxRunning: true, isAutoCADRunning: false, isRevitRunning: false },
        }
      );

      expect(plan.thought).toContain('camera');
      expect(plan.action.type).toBe('tool_call');
      expect((plan.action as any).toolName).toBe('set_camera');
    } finally {
      global.fetch = originalFetch;
      computerUseAgent.setPlannerProvider('gemini');
    }
  });

  it('fails explicitly without silent fallback to Gemini when OpenAI API fails', async () => {
    computerUseAgent.setPlannerProvider('openai', 'sk-failing-key');
    const { geminiAgentService } = await import('../gemini/GeminiAgentService');
    (geminiAgentService.chatWithGemini as any).mockClear();

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized API key',
    } as any);

    try {
      const plan = await (computerUseAgent as any).planNextAction(
        'Set lighting in 3ds Max',
        [],
        {
          windows: [],
          autodesk: { is3dsMaxRunning: true, isAutoCADRunning: false, isRevitRunning: false },
        }
      );

      expect(plan.action.type).toBe('fail');
      expect(plan.action.failureReason).toContain('401');
      // Assert that Gemini was NOT silently invoked to disguise OpenAI failure!
      expect(geminiAgentService.chatWithGemini).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
      computerUseAgent.setPlannerProvider('gemini');
    }
  });

  it('fails explicitly when OpenAI key is missing from secure storage', async () => {
    computerUseAgent.setPlannerProvider('openai', '');
    (tauriApi.invoke as any).mockImplementation((cmd: string) => {
      if (cmd === 'load_secure_key') return Promise.resolve('');
      return Promise.resolve({ success: true });
    });

    const { geminiAgentService } = await import('../gemini/GeminiAgentService');
    (geminiAgentService.chatWithGemini as any).mockClear();

    const plan = await (computerUseAgent as any).planNextAction(
      'Test missing key',
      [],
      { windows: [], autodesk: { is3dsMaxRunning: true, isAutoCADRunning: false, isRevitRunning: false } }
    );

    expect(plan.action.type).toBe('fail');
    expect(plan.action.failureReason).toContain('مفتاح OpenAI API غير متوفر');
    expect(geminiAgentService.chatWithGemini).not.toHaveBeenCalled();

    computerUseAgent.setPlannerProvider('gemini');
  });

  it('compacts large JSON tool results in historySummary to avoid prompt ballooning', async () => {
    const { geminiAgentService } = await import('../gemini/GeminiAgentService');
    (geminiAgentService.chatWithGemini as any).mockClear();

    const largeJsonResult = JSON.stringify({
      success: true,
      total_objects: 50,
      total_geometry_objects: 42,
      scene_bounds: {
        min: [-20, -15, 0],
        max: [20, 15, 12],
        dimensions_m: [40, 30, 12],
      },
      objects: Array.from({ length: 50 }, (_, i) => ({
        name: `Box_${i}`,
        class: 'Box',
        position_m: [i, i, 0],
        bbox_m: { min: [i, i, 0], max: [i + 2, i + 2, 3], dimensions: [2, 2, 3] },
        has_material: true,
      })),
      active_camera: 'Anarchy_Architectural_Camera',
      message: 'Scene inspection: 50 total objects (42 geometry), camera: Anarchy_Architectural_Camera',
    });

    await (computerUseAgent as any).planNextAction(
      'Continue architectural modeling',
      [
        {
          step: 1,
          thought: 'Inspect 3ds Max scene objects',
          action: { type: 'tool_call', autodeskSoftware: '3dsmax', toolName: 'get_scene_info', toolParameters: {} },
          observation: {} as any,
          result: { success: true, message: largeJsonResult },
        },
      ],
      { windows: [], autodesk: { is3dsMaxRunning: true, isAutoCADRunning: false, isRevitRunning: false } }
    );

    expect(geminiAgentService.chatWithGemini).toHaveBeenCalled();
    const callArgs = (geminiAgentService.chatWithGemini as any).mock.calls[0][0];
    const promptPassed = callArgs.messages?.[0]?.parts?.find((p: any) => p.text)?.text || '';
    // Check that prompt contains the compacted summary with bounds
    expect(promptPassed).toContain('Scene inspection: 50 total objects (42 geometry)');
    expect(promptPassed).toContain('[Bounds: 40x30x12m]');
    // Assert that the prompt does NOT contain giant repetitive object array dumps
    expect(promptPassed).not.toContain('Box_49');
  });

  it('waits for Autodesk connector heartbeat when launching before dispatching commands', async () => {
    const callOrder: string[] = [];
    (tauriApi.invoke as any).mockImplementation(async (cmd: string, _args: any) => {
      callOrder.push(cmd);
      if (cmd === 'cua_launch_app') return '3ds Max launched';
      if (cmd === 'cua_is_connector_online') return false; // initially offline while loading
      if (cmd === 'cua_wait_for_connector') return true; // comes online after waiting
      if (cmd === 'cua_dispatch_autodesk_command') {
        return { id: 'cmd_1', success: true, output: 'Box created' };
      }
      return { success: true };
    });

    const res = await computerUseAgent.executeAutodeskCommand({
      software: '3dsmax',
      action: 'execute_script',
      script: 'box()',
      autoLaunch: true,
    });

    expect(res.success).toBe(true);
    expect(callOrder).toContain('cua_launch_app');
    expect(callOrder).toContain('cua_is_connector_online');
    expect(callOrder).toContain('cua_wait_for_connector');
    expect(callOrder).toContain('cua_dispatch_autodesk_command');

    // cua_wait_for_connector must be called BEFORE cua_dispatch_autodesk_command
    const waitIdx = callOrder.indexOf('cua_wait_for_connector');
    const dispatchIdx = callOrder.indexOf('cua_dispatch_autodesk_command');
    expect(waitIdx).toBeLessThan(dispatchIdx);
  });

  it('formats raw JSON CUA outputs into pristine architectural status summaries for the UI', async () => {
    const { formatCuaOutputMessage } = await import('./ComputerUseAgentService');

    const jsonSceneInfo = JSON.stringify({
      success: true,
      total_objects: 14,
      total_geometry_objects: 8,
      active_camera: 'PhysicalCamera001',
      scene_bounds: {
        dimensions_m: [45.2, 30.0, 18.5],
      },
      message: 'Scene inspection: 14 total objects (8 geometry), camera: PhysicalCamera001',
    });

    const formatted = formatCuaOutputMessage(jsonSceneInfo);
    expect(formatted).toBe('Scene inspection: 14 total objects (8 geometry), camera: PhysicalCamera001 (Dimensions: 45.2x30x18.5m)');

    // Ordinary string returns unmodified
    expect(formatCuaOutputMessage('Created box "Massing_01"')).toBe('Created box "Massing_01"');
    expect(formatCuaOutputMessage(undefined)).toBeUndefined();
  });

  it('generates Set-of-Marks (SoM) anchors for windows, viewports, and canvas nodes', () => {
    const windows = [
      {
        id: 1,
        title: 'Autodesk 3ds Max 2026',
        process_id: 100,
        rect: { x: 100, y: 100, width: 1000, height: 800 },
        is_autodesk: true,
        is_minimized: false,
      },
    ];
    const screen = {
      image: 'mock',
      width: 1280,
      height: 720,
      original_width: 1920,
      original_height: 1080,
      origin_x: 0,
      origin_y: 0,
    };
    const node = { id: 'node_42', prompt: 'Glass Villa' } as any;

    const marks = computerUseAgent.generateSetOfMarks(windows, screen, node);
    expect(marks.length).toBeGreaterThanOrEqual(3);
    expect(marks[0].id).toBe('#1');
    expect(marks[0].label).toContain('3ds Max');
    expect(marks.some((m) => m.type === 'viewport_control')).toBe(true);
    expect(marks.some((m) => m.type === 'canvas_node')).toBe(true);
  });

  it('clicks directly using Set-of-Marks targetId with absolute screen coordinates', async () => {
    (tauriApi.invoke as any).mockImplementation((cmd: string) => {
      if (cmd === 'cua_get_active_windows') {
        return Promise.resolve([
          {
            id: 1,
            title: 'Autodesk 3ds Max',
            process_id: 100,
            rect: { x: 200, y: 200, width: 800, height: 600 },
            is_autodesk: true,
            is_minimized: false,
          },
        ]);
      }
      return Promise.resolve({ success: true });
    });

    await computerUseAgent.observe();
    const res = await computerUseAgent.executeAction({
      type: 'mouse_click',
      targetId: '#1',
    });

    expect(res.success).toBe(true);
    expect(res.message).toContain('Clicked SoM Mark [#1]');
    expect(tauriApi.invoke).toHaveBeenCalledWith('cua_mouse_click', expect.objectContaining({
      x: 600, // 200 + 800/2
      y: 500, // 200 + 600/2
      button: 'left',
    }));
  });

  it('decomposes comprehensive architectural tasks into hierarchical sub-goals', async () => {
    const obs = await computerUseAgent.observe();
    const plan = await computerUseAgent.createHierarchicalPlan(
      'دراسة قطعة أرض 500م وحساب الارتدادات والتشميس ومخطط كاد ومودل 3D وجدول كميات وعرض تقديمي',
      obs
    );

    expect(plan.subGoals.length).toBeGreaterThanOrEqual(6);
    expect(plan.subGoals.some((sg) => sg.targetTool === 'calculate_zoning')).toBe(true);
    expect(plan.subGoals.some((sg) => sg.targetTool === 'analyze_solar')).toBe(true);
    expect(plan.subGoals.some((sg) => sg.targetTool === 'export_cad')).toBe(true);
    expect(plan.subGoals.some((sg) => sg.targetTool === 'export_bim')).toBe(true);
    expect(plan.subGoals.some((sg) => sg.targetTool === 'export_boq')).toBe(true);
    expect(plan.subGoals.some((sg) => sg.targetTool === 'create_presentation')).toBe(true);
  });

  it('parses UI-TARS Set-of-Marks and architectural tool actions', async () => {
    const { parseUITARSAction } = await import('./ComputerUseAgentService');

    const clickTarget = parseUITARSAction("Thought: Click the viewport anchor\nAction: click(target='#2')");
    expect(clickTarget?.action?.type).toBe('mouse_click');
    expect(clickTarget?.action?.targetId).toBe('#2');

    const clickShort = parseUITARSAction("Action: click('#1')");
    expect(clickShort?.action?.targetId).toBe('#1');

    const boqCall = parseUITARSAction("Action: export_boq()");
    expect(boqCall?.action?.type).toBe('export_boq');

    const cadCall = parseUITARSAction("Action: export_cad()");
    expect(cadCall?.action?.type).toBe('export_cad');

    const solarCall = parseUITARSAction("Action: analyze_solar()");
    expect(solarCall?.action?.type).toBe('analyze_solar');
  });

  it('detects visual CUA intent for Revit when user mentions mouse/keyboard/menus/drawing', () => {
    const visualQuery = 'اريد تحكما بصريا بالماوس ولوحة المفاتيح في واجهة ريفيت وارسم جدران';
    const detected = detectAutodeskIntent(visualQuery);

    expect(detected).not.toBeNull();
    expect(detected?.software).toBe('revit');
    expect(detected?.action).toBe('cua_task');
    expect(detected?.isVisualCua).toBe(true);
    expect(detected?.description).toContain('Revit');
  });

  it('generates Revit-specific Set-of-Marks anchors when Autodesk Revit window is active', () => {
    const windows = [
      {
        id: 42,
        title: 'Autodesk Revit 2026 - Modern Villa.rvt - Floor Plan: Level 1',
        process_id: 8840,
        rect: { x: 0, y: 0, width: 1920, height: 1080 },
        is_autodesk: true,
        is_minimized: false,
      },
    ];
    const screen = {
      image: 'mock',
      width: 1920,
      height: 1080,
    };

    const marks = computerUseAgent.generateSetOfMarks(windows, screen, undefined);
    expect(marks.some((m) => m.label.includes('Wall Tool (WA)'))).toBe(true);
    expect(marks.some((m) => m.label.includes('Door Tool (DR)'))).toBe(true);
    expect(marks.some((m) => m.label.includes('Window Tool (WN)'))).toBe(true);
    expect(marks.some((m) => m.label.includes('Default 3D View (House)'))).toBe(true);
    expect(marks.some((m) => m.label.includes('Drawing Canvas Point 1 (NW)'))).toBe(true);
    expect(marks.some((m) => m.label.includes('Drawing Canvas Point 3 (SE)'))).toBe(true);
  });

  it('executes mouse_drag CUA action via Tauri cua_mouse_drag', async () => {
    (tauriApi.invoke as any).mockResolvedValue(undefined);

    const dragAction: CUAAction = {
      type: 'mouse_drag',
      x: 200,
      y: 300,
      endX: 600,
      endY: 700,
      isNormalized: false,
      button: 'left',
    };

    const res = await computerUseAgent.executeAction(dragAction);
    expect(res.success).toBe(true);
    expect(tauriApi.invoke).toHaveBeenCalledWith('cua_mouse_drag', expect.objectContaining({
      fromX: 200,
      fromY: 300,
      toX: 600,
      toY: 700,
      steps: 25,
    }));
  });
});



