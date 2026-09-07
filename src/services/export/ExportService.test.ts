import { describe, it, expect, vi } from 'vitest';

// Mock Tauri deps before importing the service
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn().mockResolvedValue('C:\\test\\export.zip'), open: vi.fn() }));
vi.mock('jspdf', () => ({
  default: vi.fn(() => ({
    setProperties: vi.fn(),
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
    addPage: vi.fn(),
    addImage: vi.fn(),
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
    splitTextToSize: vi.fn(() => []),
    output: vi.fn(() => 'data:application/pdf;base64,abc'),
  })),
}));

import {
  PROGRAM_IDENTITY,
  extractImagesFromNodes,
  exportImagesToZipWithDialog,
  exportNodesToZipWithDialog,
} from './ExportService';

// ── PROGRAM_IDENTITY ──────────────────────────────────────────────────────────
describe('PROGRAM_IDENTITY', () => {
  it('has correct name', () => {
    expect(PROGRAM_IDENTITY.name).toBe('Anarchy AI');
  });

  it('has correct file extension', () => {
    expect(PROGRAM_IDENTITY.fileExtension).toBe('ana');
  });

  it('has correct signature', () => {
    expect(PROGRAM_IDENTITY.signature).toBe('ANARCHY_AI_PROJECT_FILE');
  });

  it('has a version string', () => {
    expect(typeof PROGRAM_IDENTITY.version).toBe('string');
    expect(PROGRAM_IDENTITY.version.length).toBeGreaterThan(0);
  });
});

// ── sanitize (via filename behavior) ─────────────────────────────────────────
describe('sanitize helper (indirect via PROGRAM_IDENTITY.name)', () => {
  it('PROGRAM_IDENTITY.name contains no special chars to sanitize', () => {
    expect(PROGRAM_IDENTITY.name).toMatch(/^[a-zA-Z0-9 ]+$/);
  });
});

// ── ExportImageItem shape ─────────────────────────────────────────────────────
describe('ExportImageItem type', () => {
  it('accepts required fields', () => {
    const item = { url: 'http://example.com/img.png', name: 'node_1' };
    expect(item.url).toBeTruthy();
    expect(item.name).toBeTruthy();
  });

  it('allows optional prompt', () => {
    const item = { url: 'http://example.com/img.png', name: 'node_1', prompt: 'a sunset' };
    expect(item.prompt).toBe('a sunset');
  });
});

// ── extractImagesFromNodes (tested via node structure) ────────────────────────
describe('extractImagesFromNodes logic', () => {
  it('ignores nodes without image data', () => {
    const nodes = [
      { id: '1', data: { type: 'source' }, position: { x: 0, y: 0 } },
    ];
    // Simulate the logic directly
    const images = nodes
      .map(n => {
        const data = n.data as any;
        const url = data?.image || data?.outputData?.image;
        if (!url) return null;
        return { url, name: `${data?.type || 'node'}_${n.id}` };
      })
      .filter(Boolean);
    expect(images).toHaveLength(0);
  });

  it('extracts image from node.data.image', () => {
    const nodes = [
      { id: '1', data: { type: 'source', image: 'data:image/png;base64,abc' }, position: { x: 0, y: 0 } },
    ];
    const images = nodes
      .map(n => {
        const data = n.data as any;
        const url = data?.image || data?.outputData?.image;
        if (!url) return null;
        return { url, name: `${data?.type || 'node'}_${n.id}` };
      })
      .filter(Boolean);
    expect(images).toHaveLength(1);
    expect(images[0]?.url).toBe('data:image/png;base64,abc');
  });

  it('extracts image from node.data.outputData.image', () => {
    const nodes = [
      { id: '2', data: { type: 'result', outputData: { image: 'data:image/jpeg;base64,xyz' } }, position: { x: 0, y: 0 } },
    ];
    const images = nodes
      .map(n => {
        const data = n.data as any;
        const url = data?.image || data?.outputData?.image;
        if (!url) return null;
        return { url, name: `${data?.type || 'node'}_${n.id}` };
      })
      .filter(Boolean);
    expect(images).toHaveLength(1);
    expect(images[0]?.name).toBe('result_2');
  });
});

// ── fitImageToPDF logic ───────────────────────────────────────────────────────
describe('fitImageToPDF logic', () => {
  const fit = (w: number, h: number, cw: number, ch: number) => {
    const aspectRatio = w / h;
    let finalWidth = cw;
    let finalHeight = finalWidth / aspectRatio;
    if (finalHeight > ch) {
      finalHeight = ch;
      finalWidth = finalHeight * aspectRatio;
    }
    return { finalWidth, finalHeight };
  };

  it('fits landscape image within content area', () => {
    const { finalWidth, finalHeight } = fit(1920, 1080, 170, 257);
    expect(finalWidth).toBeLessThanOrEqual(170);
    expect(finalHeight).toBeLessThanOrEqual(257);
  });

  it('fits portrait image within content area', () => {
    const { finalWidth, finalHeight } = fit(800, 1200, 170, 257);
    expect(finalWidth).toBeLessThanOrEqual(170);
    expect(finalHeight).toBeLessThanOrEqual(257);
  });

  it('maintains aspect ratio for landscape', () => {
    const { finalWidth, finalHeight } = fit(1920, 1080, 170, 257);
    expect(finalWidth / finalHeight).toBeCloseTo(1920 / 1080, 3);
  });

  it('maintains aspect ratio for portrait', () => {
    const { finalWidth, finalHeight } = fit(800, 1200, 170, 257);
    expect(finalWidth / finalHeight).toBeCloseTo(800 / 1200, 3);
  });

  it('does not upscale small image beyond content width', () => {
    const { finalWidth } = fit(100, 100, 170, 257);
    expect(finalWidth).toBe(170); // fills to contentWidth
  });
});

// ── extractImagesFromNodes function ───────────────────────────────────────────
describe('extractImagesFromNodes implementation', () => {
  it('extracts primary image, variants, and prompts from nodes', () => {
    const nodes: any[] = [
      {
        id: 'node-1',
        data: {
          type: 'source',
          image: 'data:image/png;base64,primary1',
          prompt: 'modern villa with large glass windows',
          images: [
            'data:image/png;base64,primary1',
            'data:image/png;base64,variant2',
          ],
        },
      },
      {
        id: 'node-2',
        data: {
          type: 'upscaler',
          outputData: {
            image: 'data:image/jpeg;base64,upscaled',
            prompt: 'interior living room',
          },
        },
      },
      {
        id: 'node-empty',
        data: {
          type: 'ghost',
        },
      },
    ];

    const extracted = extractImagesFromNodes(nodes);
    expect(extracted).toHaveLength(3);

    expect(extracted[0]).toEqual({
      url: 'data:image/png;base64,primary1',
      name: 'source_node-1',
      prompt: 'modern villa with large glass windows',
    });

    expect(extracted[1]).toEqual({
      url: 'data:image/png;base64,variant2',
      name: 'source_node-1_variant_2',
      prompt: 'modern villa with large glass windows',
    });

    expect(extracted[2]).toEqual({
      url: 'data:image/jpeg;base64,upscaled',
      name: 'upscaler_node-2',
      prompt: 'interior living room',
    });
  });
});

// ── Batch ZIP Export ─────────────────────────────────────────────────────────
describe('Batch ZIP Export', () => {
  it('exportImagesToZipWithDialog packages images, prompts, and manifest', async () => {
    const items = [
      {
        url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        name: 'villa_facade',
        prompt: 'luxury modern villa',
      },
      {
        url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        name: 'villa_interior',
      },
    ];

    const result = await exportImagesToZipWithDialog(items, {
      zipName: 'test_villa_export',
      includePrompts: true,
      includeManifest: true,
    });

    expect(result).toBe('C:\\test\\export.zip');
  });

  it('exportImagesToZipWithDialog throws if items array is empty', async () => {
    await expect(exportImagesToZipWithDialog([])).rejects.toThrow('No images to export in archive');
  });

  it('exportNodesToZipWithDialog filters selected nodes when selectedOnly is true', async () => {
    const nodes: any[] = [
      {
        id: 'n1',
        selected: false,
        data: { type: 'source', image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
      },
      {
        id: 'n2',
        selected: true,
        data: { type: 'result', image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
      },
    ];

    const result = await exportNodesToZipWithDialog(nodes, {}, true);
    expect(result).toBe('C:\\test\\export.zip');
  });

  it('exportNodesToZipWithDialog throws if no images exist in target nodes', async () => {
    const nodes: any[] = [
      { id: 'n1', selected: true, data: { type: 'ghost' } },
    ];
    await expect(exportNodesToZipWithDialog(nodes, {}, true)).rejects.toThrow('No images found in selected nodes');
  });
});
