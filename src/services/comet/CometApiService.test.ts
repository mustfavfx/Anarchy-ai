import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cometApiService } from './CometApiService';
import { supabase } from '../supabase/supabaseClient';

vi.mock('../supabase/supabaseClient', () => ({
  supabaseUrl: 'https://test.supabase.co',
  supabaseAnonKey: 'test-anon-key',
  isSupabaseConfigured: true,
  getCurrentUserId: vi.fn(() => 'user-test-123'),
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'user-test-123/node-1/task-1.png' }, error: null }),
        getPublicUrl: vi.fn(() => ({
          data: { publicUrl: 'https://test.supabase.co/storage/v1/object/public/generated-images/user-test-123/node-1/task-1.png' },
        })),
      })),
    },
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
  },
}));

describe('CometApiService Webhook & Supabase Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds webhook URL with query parameters', () => {
    const url = cometApiService.getWebhookUrl({
      userId: 'user_xyz',
      nodeId: 'node_abc',
      model: 'mj-turbo-upscale',
      prompt: 'luxury architectural facade',
    });

    expect(url).toContain('https://test.supabase.co/functions/v1/comet_webhook');
    expect(url).toContain('user_id=user_xyz');
    expect(url).toContain('node_id=node_abc');
    expect(url).toContain('model=mj-turbo-upscale');
    expect(url).toContain('prompt=luxury+architectural+facade');
  });

  it('archives image to Supabase Storage and returns permanent public URL', async () => {
    // Mock global fetch for downloading image blob
    const fakeBlob = new Blob(['fake image data'], { type: 'image/png' });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(fakeBlob),
    }) as any;

    const permanentUrl = await cometApiService.saveImageToSupabaseStorage(
      'https://api.cometapi.com/mj/image/1790938104991839.png',
      {
        userId: 'user-test-123',
        nodeId: 'node-1',
        taskId: 'task-1',
        model: 'mj-turbo-upscale',
        prompt: 'test prompt',
      }
    );

    expect(supabase.storage.from).toHaveBeenCalledWith('generated-images');
    expect(permanentUrl).toBe(
      'https://test.supabase.co/storage/v1/object/public/generated-images/user-test-123/node-1/task-1.png'
    );
    expect(supabase.from).toHaveBeenCalledWith('replicate_predictions');
  });

  it('skips archiving if image is already a Supabase Storage URL', async () => {
    const existingUrl =
      'https://test.supabase.co/storage/v1/object/public/generated-images/user-test-123/node-1/task-1.png';

    const result = await cometApiService.saveImageToSupabaseStorage(existingUrl, {
      userId: 'user-test-123',
      nodeId: 'node-1',
    });

    expect(result).toBe(existingUrl);
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });

  it('accurately recognizes all architectural Comet models', () => {
    expect(cometApiService.isCometModel('xai/grok-4-1-fast-reasoning')).toBe(true);
    expect(cometApiService.isCometModel('anthropic/claude-sonnet-5-5')).toBe(true);
    expect(cometApiService.isCometModel('google/gemini-3.8-flash-thinking')).toBe(true);
    expect(cometApiService.isCometModel('minimax/minimax-m3-1-flash-preview')).toBe(true);
    expect(cometApiService.isCometModel('openai/gpt-6-1-sol')).toBe(true);
    expect(cometApiService.isCometModel('openai/gpt-6-astra')).toBe(true);
    expect(cometApiService.isCometModel('google/gemini-3.6-flash')).toBe(false);
  });

  it('strictly sends request to only the chosen model without fallback loops', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: 'Architectural analysis result' } }],
      }),
    });
    global.fetch = fetchSpy;

    const res = await cometApiService.chatWithComet({
      model: 'anthropic/claude-sonnet-5-5',
      messages: [{ role: 'user', content: 'Design review' }],
    });

    expect(res).toBe('Architectural analysis result');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const callBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(callBody.model).toBe('claude-sonnet-5-5');
  });
});
