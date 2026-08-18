/**
 * Watermark Service
 * Adds watermarks (single or multiple) to images with customizable position and style
 */

import type { WatermarkPosition } from '../../stores/aiConfigStore';
import { logger } from '../../utils/logger';

export interface WatermarkItem {
  type?: 'text' | 'image';
  text?: string;
  watermarkImage?: string;
  watermarkImageSize?: number;
  position: WatermarkPosition;
  opacity: number;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
}

export interface WatermarkOptions extends WatermarkItem {
  items?: WatermarkItem[];
}

class WatermarkService {
  /**
   * Add watermark(s) to image
   */
  async applyWatermark(
    imageUrl: string,
    options: WatermarkOptions | WatermarkItem[]
  ): Promise<string> {
    // Load image as bitmap to avoid CORS issues with base64 and external URLs
    const bitmap = await this.loadBitmap(imageUrl);

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const items: WatermarkItem[] = Array.isArray(options)
      ? options
      : options.items && options.items.length > 0
        ? options.items
        : [options];

    for (const item of items) {
      if (item.type === 'image' && item.watermarkImage) {
        await this.drawImageWatermark(ctx, canvas.width, canvas.height, item);
      } else if (item.text && item.text.trim().length > 0) {
        this.drawTextWatermark(ctx, canvas.width, canvas.height, item);
      }
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
    options: WatermarkItem
  ): void {
    const {
      text = '',
      position,
      opacity,
      fontSize = 24,
      color = '#ffffff',
      fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    } = options;

    const lines = text.split(/\r?\n/).map(l => l.trimEnd()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    ctx.save();
    ctx.font = `bold ${fontSize}px ${fontFamily}`;
    ctx.globalAlpha = opacity;

    // Shadow for high readability on any background
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = Math.max(4, Math.round(fontSize * 0.2));
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = color;

    const lineHeight = Math.round(fontSize * 1.25);
    const totalBlockHeight = (lines.length - 1) * lineHeight + fontSize;

    let maxLineWidth = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > maxLineWidth) maxLineWidth = w;
    }

    const { x, y } = this.calculatePosition(position, width, height, maxLineWidth, totalBlockHeight);

    lines.forEach((line, index) => {
      let lineX = x;
      if (position.includes('right')) {
        const lw = ctx.measureText(line).width;
        lineX = x + (maxLineWidth - lw);
      } else if (position.includes('center')) {
        const lw = ctx.measureText(line).width;
        lineX = x + (maxLineWidth - lw) / 2;
      }
      const lineY = y + index * lineHeight;
      ctx.fillText(line, lineX, lineY);
    });

    ctx.restore();
  }

  /**
   * Draw image watermark on canvas
   */
  private async drawImageWatermark(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    options: WatermarkItem
  ): Promise<void> {
    const { watermarkImage, watermarkImageSize = 20, position, opacity } = options;
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
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 6;
        ctx.drawImage(wmImg, x, y, wmW, wmH);
        ctx.restore();
        resolve();
      };
      wmImg.onerror = () => resolve();
      wmImg.src = watermarkImage;
    });
  }

  /**
   * Calculate position for both text and image watermarks.
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
      default:
        return { x: imageWidth - elementWidth - padding, y: imageHeight - padding };
    }
  }

  /**
   * Add watermark to multiple images (batch processing)
   */
  async applyWatermarkBatch(
    imageUrls: string[],
    options: WatermarkOptions | WatermarkItem[]
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
   * Preview watermark without applying it
   */
  async previewWatermark(
    imageUrl: string,
    options: WatermarkOptions | WatermarkItem[]
  ): Promise<string> {
    return this.applyWatermark(imageUrl, options);
  }
}

export const watermarkService = new WatermarkService();

/**
 * Helper to extract all currently active watermark items from AIConfig
 */
export function getActiveWatermarkItems(aiConfig: any): WatermarkItem[] {
  if (!aiConfig) return [];
  const items: WatermarkItem[] = [];

  // Slot 1 (Primary)
  if (aiConfig.enableWatermark) {
    const isImg = aiConfig.watermarkType === 'image';
    const hasContent = isImg ? !!aiConfig.watermarkImage : (aiConfig.watermarkText?.trim().length ?? 0) > 0;
    if (hasContent) {
      items.push({
        type: aiConfig.watermarkType || 'text',
        text: aiConfig.watermarkText || 'Anarchy AI',
        watermarkImage: aiConfig.watermarkImage,
        watermarkImageSize: aiConfig.watermarkImageSize ?? 20,
        position: aiConfig.watermarkPosition ?? 'bottom-right',
        opacity: aiConfig.watermarkOpacity ?? 0.5,
        fontSize: aiConfig.watermarkFontSize ?? 24,
      });
    }
  }

  // Slot 2 (Secondary)
  if (aiConfig.enableWatermark2) {
    const isImg2 = aiConfig.watermark2Type === 'image';
    const hasContent2 = isImg2 ? !!aiConfig.watermark2Image : (aiConfig.watermark2Text?.trim().length ?? 0) > 0;
    if (hasContent2) {
      items.push({
        type: aiConfig.watermark2Type || 'text',
        text: aiConfig.watermark2Text || '',
        watermarkImage: aiConfig.watermark2Image,
        watermarkImageSize: aiConfig.watermark2ImageSize ?? 20,
        position: aiConfig.watermark2Position ?? 'top-left',
        opacity: aiConfig.watermark2Opacity ?? 0.5,
        fontSize: aiConfig.watermark2FontSize ?? 24,
      });
    }
  }

  return items;
}
