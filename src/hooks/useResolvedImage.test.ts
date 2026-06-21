/**
 * useResolvedImage Hook Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResolvedImage } from './useResolvedImage';

// Mock HistoryService
vi.mock('../services/history/HistoryService', () => ({
  getLocalImageAsObjectURL: vi.fn(),
  revokeObjectUrl: vi.fn(),
}));

import { getLocalImageAsObjectURL } from '../services/history/HistoryService';


describe('useResolvedImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return undefined for null/undefined input', () => {
    const { result } = renderHook(() => useResolvedImage(null));
    expect(result.current).toBeUndefined();
  });

  it('should return undefined for empty string', () => {
    const { result } = renderHook(() => useResolvedImage(''));
    expect(result.current).toBeUndefined();
  });

  it('should return the URL directly for http:// images', async () => {
    const url = 'https://example.com/image.png';
    const { result } = renderHook(() => useResolvedImage(url));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(result.current).toBe(url);
  });

  it('should resolve idb:// URLs via HistoryService', async () => {
    const idbKey = 'idb://test-uuid';
    const blobUrl = 'blob:mock-object-url';

    vi.mocked(getLocalImageAsObjectURL).mockResolvedValueOnce(blobUrl);

    const { result } = renderHook(() => useResolvedImage(idbKey));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(getLocalImageAsObjectURL).toHaveBeenCalledWith(idbKey);
    expect(result.current).toBe(blobUrl);
  });

  it('should return undefined when idb:// key not found', async () => {
    const idbKey = 'idb://non-existent';

    vi.mocked(getLocalImageAsObjectURL).mockResolvedValueOnce(null);

    const { result } = renderHook(() => useResolvedImage(idbKey));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    expect(result.current).toBeUndefined();
  });

  it('should return blob: URL directly for non-idb blob images', async () => {
    const blobUrl = 'blob:existing-object-url';
    const { result } = renderHook(() => useResolvedImage(blobUrl));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(result.current).toBe(blobUrl);
  });

  it('should NOT call fetch() for data: URIs (CSP connect-src guard)', async () => {
    // The core invariant: fetch(data:...) violates CSP connect-src and was the
    // root cause of the "Connecting to data:image/... violates CSP" flood.
    // Regardless of whether blob URL creation succeeds in jsdom, fetch MUST
    // never be called for data: scheme URLs.
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    // Use a simple plain-text data URI that atob can handle in all environments
    const plainDataUri = 'data:text/plain;base64,aGVsbG8='; // "hello"

    renderHook(() => useResolvedImage(plainDataUri));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // The critical assertion: fetch must NEVER be called for data: URIs
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('should fall back to raw data URI when atob fails (malformed base64)', async () => {
    const malformed = 'data:image/png;base64,NOT_VALID_BASE64!!!';
    const { result } = renderHook(() => useResolvedImage(malformed));

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // Should fall back to the original string, not crash
    expect(result.current).toBe(malformed);
  });

  it('should update when rawImage changes', async () => {
    const { result, rerender } = renderHook(
      ({ url }: { url: string }) => useResolvedImage(url),
      { initialProps: { url: 'https://example.com/img1.png' } }
    );

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    expect(result.current).toBe('https://example.com/img1.png');

    rerender({ url: 'https://example.com/img2.png' });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    expect(result.current).toBe('https://example.com/img2.png');
  });
});
