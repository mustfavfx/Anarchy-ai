/**
 * HistoryService Pure Function Tests
 * Tests non-IDB utility functions that are fully testable in jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  dataURLtoBlob,
  blobToDataURL,
  registerObjectUrl,
  revokeObjectUrl,
  revokeAllObjectUrls,
} from './HistoryService';

// A real minimal PNG data URL (1x1 pixel)
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('HistoryService — pure utility functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure Object URL mocks are set up
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  });

  describe('dataURLtoBlob', () => {
    it('should convert a data URL to a Blob', () => {
      const blob = dataURLtoBlob(TINY_PNG);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/png');
      expect(blob.size).toBeGreaterThan(0);
    });

    it('should produce a Blob with the correct MIME type from the data URL', () => {
      const jpegDataUrl = 'data:image/jpeg;base64,' + TINY_PNG.split(',')[1];
      const blob = dataURLtoBlob(jpegDataUrl);
      expect(blob.type).toBe('image/jpeg');
    });

    it('should produce a blob with the correct size', () => {
      const blob1 = dataURLtoBlob(TINY_PNG);
      // A 1x1 PNG should be small but non-zero
      expect(blob1.size).toBeGreaterThan(0);
      expect(blob1.size).toBeLessThan(1000);
    });
  });

  describe('blobToDataURL', () => {
    it('should convert a Blob back to a data URL', async () => {
      const blob = dataURLtoBlob(TINY_PNG);
      const dataUrl = await blobToDataURL(blob);
      expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('should produce a round-trip compatible data URL', async () => {
      const blob = dataURLtoBlob(TINY_PNG);
      const dataUrl = await blobToDataURL(blob);
      // Should be parseable back to a blob
      const roundTripBlob = dataURLtoBlob(dataUrl);
      expect(roundTripBlob.size).toBe(blob.size);
    });
  });

  describe('registerObjectUrl', () => {
    it('should register and return the URL', () => {
      const url = 'blob:test-url-123';
      const result = registerObjectUrl(url);
      expect(result).toBe(url);
    });

    it('should allow the URL to be revoked later', () => {
      const url = 'blob:test-url-revoke';
      registerObjectUrl(url);
      revokeObjectUrl(url);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
    });
  });

  describe('revokeObjectUrl', () => {
    it('should call URL.revokeObjectURL for registered URLs', () => {
      const url = 'blob:test-revoke-registered';
      registerObjectUrl(url);
      revokeObjectUrl(url);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(url);
    });

    it('should NOT call URL.revokeObjectURL for unregistered URLs', () => {
      revokeObjectUrl('blob:never-registered');
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    });
  });

  describe('revokeAllObjectUrls', () => {
    it('should revoke all registered URLs', () => {
      const url1 = 'blob:bulk-1';
      const url2 = 'blob:bulk-2';
      registerObjectUrl(url1);
      registerObjectUrl(url2);

      revokeAllObjectUrls();

      expect(URL.revokeObjectURL).toHaveBeenCalledWith(url1);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(url2);
    });

    it('should clear all URLs from registry after revoking', () => {
      const url = 'blob:clear-test';
      registerObjectUrl(url);
      revokeAllObjectUrls();

      // After full revoke, trying to revoke again should NOT call revokeObjectURL
      vi.clearAllMocks();
      revokeObjectUrl(url);
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    });
  });
});
