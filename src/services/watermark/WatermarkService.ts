/**
 * Watermark Service
 * Adds watermarks to images with customizable position and style
 */

import type { WatermarkPosition } from '../../stores/aiConfigStore';

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
    // fetch works for both data: URIs and http URLs — avoids CORS canvas taint
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

    ctx.globalAlpha = 1.0;
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
        const wmW = watermarkImageSize;
        const wmH = wmW / aspect;

        const { x, y } = this.calculatePosition(position, width, height, wmW, wmH);
        ctx.globalAlpha = opacity;
        ctx.drawImage(wmImg, x, y, wmW, wmH);
        ctx.globalAlpha = 1.0;
        resolve();
      };
      wmImg.onerror = () => resolve();
      wmImg.src = watermarkImage;
    });
  }

  /**
   * Calculate text position based on watermark position
   */
  private calculatePosition(
    position: WatermarkPosition,
    imageWidth: number,
    imageHeight: number,
    textWidth: number,
    textHeight: number
  ): { x: number; y: number } {
    const padding = 20;
    
    switch (position) {
      case 'top-left':
        return { x: padding, y: padding + textHeight };
      
      case 'top-center':
        return { x: (imageWidth - textWidth) / 2, y: padding + textHeight };
      
      case 'top-right':
        return { x: imageWidth - textWidth - padding, y: padding + textHeight };
      
      case 'center':
        return { x: (imageWidth - textWidth) / 2, y: (imageHeight + textHeight) / 2 };
      
      case 'bottom-left':
        return { x: padding, y: imageHeight - padding };
      
      case 'bottom-center':
        return { x: (imageWidth - textWidth) / 2, y: imageHeight - padding };
      
      case 'bottom-right':
        return { x: imageWidth - textWidth - padding, y: imageHeight - padding };
      
      default:
        return { x: imageWidth - textWidth - padding, y: imageHeight - padding };
    }
  }

  /**
   * Add watermark to multiple images (batch processing)
   */
  async applyWatermarkBatch(
    imageUrls: string[],
    options: WatermarkOptions
  ): Promise<string[]> {
    const promises = imageUrls.map(url => this.applyWatermark(url, options));
    return Promise.all(promises);
  }

  /**
   * Remove watermark from image (experimental)
   * Note: This is difficult and may not work perfectly
   */
  async removeWatermark(imageUrl: string): Promise<string> {
    // This is a placeholder - actual watermark removal requires ML
    // For now, just return the original image
    console.warn('Watermark removal is not fully implemented yet');
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
