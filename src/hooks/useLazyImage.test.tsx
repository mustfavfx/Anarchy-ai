import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLazyImage } from './useLazyImage';
import { loadFullImage, revokeObjectUrl } from '../services/history/HistoryService';

// Mock IntersectionObserver
const mockObserve = vi.fn();
const mockDisconnect = vi.fn();

class MockIntersectionObserver {
  observe = mockObserve;
  unobserve = vi.fn();
  disconnect = mockDisconnect;

  constructor(callback: any) {
    (global as any).triggerIntersection = (isIntersecting: boolean) => {
      callback([{ isIntersecting }]);
    };
  }
}

global.IntersectionObserver = MockIntersectionObserver as any;

vi.mock('../services/history/HistoryService', () => ({
  loadFullImage: vi.fn(),
  revokeObjectUrl: vi.fn(),
}));

describe('useLazyImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should lazy load image when intersecting and revoke object URL on unmount', async () => {
    const mockUrl = 'blob:http://localhost/1234';
    vi.mocked(loadFullImage).mockResolvedValueOnce(mockUrl);

    const { result, unmount } = renderHook(() =>
      useLazyImage('entry-123', 'output', null)
    );

    // Initial state: not intersecting, src is empty
    expect(result.current.src).toBe('');

    // Trigger intersection
    await act(async () => {
      (global as any).triggerIntersection(true);
      // Wait for promise resolution
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(loadFullImage).toHaveBeenCalledWith('entry-123', 'output');
    expect(result.current.src).toBe(mockUrl);

    // Unmount hook
    unmount();

    // Verify object URL is revoked on unmount
    expect(revokeObjectUrl).toHaveBeenCalledWith(mockUrl);
  });
});
