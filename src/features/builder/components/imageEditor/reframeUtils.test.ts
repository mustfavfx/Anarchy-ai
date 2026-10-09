import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPaddedReframedImage } from './reframeUtils';

vi.mock('../../../../services/export/modules/imageExportUtils', () => ({
  loadImageElement: vi.fn().mockResolvedValue({
    naturalWidth: 1600,
    naturalHeight: 900,
    width: 1600,
    height: 900,
  }),
}));

describe('createPaddedReframedImage', () => {
  beforeEach(() => {
    // Mock HTMLCanvasElement and 2d context for jsdom environment
    const mockContext = {
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      filter: '',
    };

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockContext as any);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,mockReframed');
  });

  it('correctly calculates dimensions when expanding from landscape to portrait (16:9 to 3:4)', async () => {
    const result = await createPaddedReframedImage('https://example.com/test.png', '3:4');
    expect(result.width).toBe(1600);
    // Height should expand to 1600 / (3/4) = ~2134
    expect(result.height).toBeGreaterThan(2000);
    expect(result.isExpanded).toBe(true);
    expect(result.dataUrl).toContain('data:image/png');
  });

  it('correctly calculates dimensions when expanding from square to widescreen (1:1 to 16:9)', async () => {
    const { loadImageElement } = await import('../../../../services/export/modules/imageExportUtils');
    vi.mocked(loadImageElement).mockResolvedValueOnce({
      naturalWidth: 1000,
      naturalHeight: 1000,
      width: 1000,
      height: 1000,
    } as any);

    const result = await createPaddedReframedImage('https://example.com/square.png', '16:9');
    expect(result.height).toBe(1000);
    // Width should expand to 1000 * 16 / 9 = ~1778
    expect(result.width).toBeGreaterThan(1700);
    expect(result.isExpanded).toBe(true);
  });
});
