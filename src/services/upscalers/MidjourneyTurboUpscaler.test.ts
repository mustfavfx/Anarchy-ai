import { describe, it, expect, vi } from 'vitest';
import { UpscalerFactory } from './UpscalerFactory';
import { MidjourneyTurboUpscaler } from './MidjourneyTurboUpscaler';
import { cometApiService } from '../comet/CometApiService';

vi.mock('../comet/CometApiService', () => ({
  cometApiService: {
    upscaleImageWithMidjourney: vi.fn(),
  },
}));

describe('MidjourneyTurboUpscaler & UpscalerFactory', () => {
  it('instantiates MidjourneyTurboUpscaler via UpscalerFactory with various aliases', () => {
    const u1 = UpscalerFactory.create('midjourney/mj-turbo-upscale');
    expect(u1).toBeInstanceOf(MidjourneyTurboUpscaler);

    const u2 = UpscalerFactory.create('mj-turbo');
    expect(u2).toBeInstanceOf(MidjourneyTurboUpscaler);

    const u3 = UpscalerFactory.create('mj_turbo_upscale');
    expect(u3).toBeInstanceOf(MidjourneyTurboUpscaler);

    const u4 = UpscalerFactory.create('midjourney/mj-fast-upscale');
    expect(u4).toBeInstanceOf(MidjourneyTurboUpscaler);

    const u5 = UpscalerFactory.create('midjourney/mj-fast-upscale-creative');
    expect(u5).toBeInstanceOf(MidjourneyTurboUpscaler);

    const u6 = UpscalerFactory.create('midjourney/mj-fast-upscale-subtle');
    expect(u6).toBeInstanceOf(MidjourneyTurboUpscaler);
  });

  it('builds payload and calls cometApiService.upscaleImageWithMidjourney on execute', async () => {
    const upscaler = new MidjourneyTurboUpscaler();
    (cometApiService.upscaleImageWithMidjourney as any).mockResolvedValueOnce({
      imageUrl: 'https://api.cometapi.com/mj/image/upscaled_result_123.png',
      width: 2048,
      height: 2048,
    });

    const config: any = {
      model: 'midjourney/mj-turbo-upscale',
      midjourneyTaskId: 'task_abc',
      midjourneyCustomId: 'MJ::JOB::upsample::1::abc',
    };

    const payload = upscaler.buildPayload(config, 'https://example.com/source.png');
    expect(payload).toEqual({
      image: 'https://example.com/source.png',
      taskId: 'task_abc',
      customId: 'MJ::JOB::upsample::1::abc',
      imageIndex: undefined,
    });

    const result = await upscaler.execute(config, 'https://example.com/source.png');
    expect(cometApiService.upscaleImageWithMidjourney).toHaveBeenCalledWith(
      'https://example.com/source.png',
      expect.objectContaining({
        taskId: 'task_abc',
        customId: 'MJ::JOB::upsample::1::abc',
      })
    );
    expect(result.imageUrl).toBe('https://api.cometapi.com/mj/image/upscaled_result_123.png');
    expect(result.model).toBe('midjourney/mj-turbo-upscale');
  });

  it('parses result object correctly', () => {
    const upscaler = new MidjourneyTurboUpscaler();
    const parsed = upscaler.parseResult({ imageUrl: 'https://api.cometapi.com/mj/result.png' });
    expect(parsed.imageUrl).toBe('https://api.cometapi.com/mj/result.png');
    expect(parsed.model).toBe('midjourney/mj-turbo-upscale');
  });
});
