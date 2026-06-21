/**
 * Watermark Service
 * Adds watermarks to images with customizable position and style
 */

import type { WatermarkPosition } from '../../stores/aiConfigStore';
import { logger } from '../../utils/logger';

export interface WatermarkOptions {
  type?: 'text' | 'image';
  text: string;
  watermarkImage?: string;
  watermarkImageSize?: number;
  position: WatermarkPosition;
  opacity: number;
  fontSize: number;
  color?: string;
  fontFamily?: string;
}

class WatermarkService {
  /**
   * Add watermark to image
   */
  async applyWatermark(
    imageUrl: string,
    options: WatermarkOptions
  ): Promise<string> {
    // Load image as bitmap to avoid CORS issues with base64 and external URLs
    const bitmap = await this.loadBitmap(imageUrl);

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    if (options.type === 'image' && options.watermarkImage) {
      await this.drawImageWatermark(ctx, canvas.width, canvas.height, options);
    } else {
      this.drawTextWatermark(ctx, canvas.width, canvas.height, options);
    }

    return canvas.toDataURL('image/jpeg', 0.95);
  }

  private async loadBitmap(imageUrl: string): Promise<ImageBitmap> {
    if (imageUrl.startsWith('data:')) {
      // Convert data URI directly to blob without fetch (fetch on data: is unreliable)
      const [header, base64] = imageUrl.split(',');
      const mime = header.match(/data:([^;]+)/)?.[1] ?? 'image/jpeg';
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      return createImageBitmap(blob);
    }
    // http/https URLs — use fetch
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    return createImageBitmap(blob);
  }

  /**
   * Draw text watermark on canvas
   */
  private drawTextWatermark(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    options: WatermarkOptions
  ): void {
    const {
      text,
      position,
      opacity,
      fontSize,
      color = '#ffffff',
      fontFamily = 'Arial, sans-serif',
    } = options;

    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.globalAlpha = opacity;

    // Shadow for readability on any background
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = color;

    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = fontSize;

    const { x, y } = this.calculatePosition(position, width, height, textWidth, textHeight);
    ctx.fillText(text, x, y);

    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  /**
   * Draw image watermark on canvas
   */
  private async drawImageWatermark(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    options: WatermarkOptions
  ): Promise<void> {
    const { watermarkImage, watermarkImageSize = 80, position, opacity } = options;
    if (!watermarkImage) return;

    return new Promise((resolve) => {
      const wmImg = new Image();
      wmImg.onload = () => {
        const aspect = wmImg.naturalWidth / wmImg.naturalHeight;
        // watermarkImageSize is treated as a % of image width (clamped 5–80%)
        const sizePercent = Math.min(80, Math.max(5, watermarkImageSize)) / 100;
        const wmW = Math.round(width * sizePercent);
        const wmH = Math.round(wmW / aspect);

        const { x, y } = this.calculatePosition(position, width, height, wmW, wmH, true);
        ctx.globalAlpha = opacity;
        ctx.drawImage(wmImg, x, y, wmW, wmH);
        ctx.globalAlpha = 1;
        resolve();
      };
      wmImg.onerror = () => resolve();
      wmImg.src = watermarkImage;
    });
  }

  /**
   * Calculate position for both text and image watermarks.
   *
   * For TEXT:  (x, y) is the baseline anchor used by fillText — so top rows
   *            need  y = padding + elementHeight  and bottom rows  y = imageHeight - padding.
   *
   * For IMAGE: (x, y) is the top-left corner used by drawImage — so top rows
   *            need  y = padding  and bottom rows  y = imageHeight - elementHeight - padding.
   *
   * The caller passes `isImage = true` when computing coordinates for an image
   * watermark so the correct formula is applied.
   */
  private calculatePosition(
    position: WatermarkPosition,
    imageWidth: number,
    imageHeight: number,
    elementWidth: number,
    elementHeight: number,
    isImage = false
  ): { x: number; y: number } {
    const padding = Math.round(Math.min(imageWidth, imageHeight) * 0.03);

    if (isImage) {
      // All coords are top-left anchors for ctx.drawImage()
      switch (position) {
        case 'top-left':
          return { x: padding, y: padding };
        case 'top-center':
          return { x: Math.round((imageWidth - elementWidth) / 2), y: padding };
        case 'top-right':
          return { x: imageWidth - elementWidth - padding, y: padding };
        case 'center':
          return {
            x: Math.round((imageWidth - elementWidth) / 2),
            y: Math.round((imageHeight - elementHeight) / 2),
          };
        case 'bottom-left':
          return { x: padding, y: imageHeight - elementHeight - padding };
        case 'bottom-center':
          return {
            x: Math.round((imageWidth - elementWidth) / 2),
            y: imageHeight - elementHeight - padding,
          };
        case 'bottom-right':
          return { x: imageWidth - elementWidth - padding, y: imageHeight - elementHeight - padding };
        default:
          return { x: imageWidth - elementWidth - padding, y: imageHeight - elementHeight - padding };
      }
    }

    // TEXT: (x, y) is the baseline anchor for ctx.fillText()
    switch (position) {
      case 'top-left':
        return { x: padding, y: padding + elementHeight };
      case 'top-center':
        return { x: Math.round((imageWidth - elementWidth) / 2), y: padding + elementHeight };
      case 'top-right':
        return { x: imageWidth - elementWidth - padding, y: padding + elementHeight };
      case 'center':
        return {
          x: Math.round((imageWidth - elementWidth) / 2),
          y: Math.round((imageHeight + elementHeight) / 2),
        };
      case 'bottom-left':
        return { x: padding, y: imageHeight - padding };
      case 'bottom-center':
        return { x: Math.round((imageWidth - elementWidth) / 2), y: imageHeight - padding };
      case 'bottom-right':
        return { x: imageWidth - elementWidth - padding, y: imageHeight - padding };
      default:
        return { x: imageWidth - elementWidth - padding, y: imageHeight - padding };
    }
  }

  /**
   * Add watermark to multiple images (batch processing)
   */
  async applyWatermarkBatch(
    imageUrls: string[],
    options: WatermarkOptions
  ): Promise<string[]> {
    const results = await Promise.allSettled(
      imageUrls.map(url => this.applyWatermark(url, options))
    );
    return results.map((res, idx) => {
      if (res.status === 'fulfilled') {
        return res.value;
      } else {
        logger.error('Failed to apply watermark to image in batch:', res.reason);
        return imageUrls[idx];
      }
    });
  }

  /**
   * Remove watermark from image (experimental)
   * Note: This is difficult and may not work perfectly
   */
  async removeWatermark(imageUrl: string): Promise<string> {
    // This is a placeholder - actual watermark removal requires ML
    // For now, just return the original image
    logger.warn('Watermark removal is not fully implemented yet');
    return imageUrl;
  }

  /**
   * Preview watermark without applying it
   */
  async previewWatermark(
    imageUrl: string,
    options: WatermarkOptions
  ): Promise<string> {
    return this.applyWatermark(imageUrl, options);
  }
}

export const watermarkService = new WatermarkService();
