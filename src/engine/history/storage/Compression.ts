/**
 * History Engine v3 — Image & Data Compression Utility
 */

export class CompressionUtility {
  /**
   * Compress Base64 image or Blob to WebP at target quality
   */
  static async compressImage(dataUrl: string, quality: number = 0.82): Promise<string> {
    if (!dataUrl.startsWith('data:image')) return dataUrl;
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const webpData = canvas.toDataURL('image/webp', quality);
        resolve(webpData.length < dataUrl.length ? webpData : dataUrl);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }
}
