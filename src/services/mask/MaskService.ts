/**
 * Advanced Mask Processing Service
 * Uses geometry algorithms for better mask quality and performance
 */

export interface MaskOptions {
  threshold?: number;
  blur?: number;
  feather?: number;
  invert?: boolean;
  detectEdges?: boolean;
  detectShapes?: boolean;
}

export interface DetectedShape {
  type: 'rectangle' | 'circle' | 'triangle' | 'polygon' | 'unknown';
  bounds: { x: number; y: number; width: number; height: number };
  confidence: number;
}

export interface MaskResult {
  maskData: string; // base64
  shapes?: DetectedShape[];
  edges?: string; // base64 of edge-detected image
}

class MaskService {
  /**
   * Build a high-quality black/white mask from canvas
   */
  async buildMask(canvas: HTMLCanvasElement, options: MaskOptions = {}): Promise<MaskResult> {
    const {
      threshold = 10,
      blur = 0,
      feather = 0,
      invert = false,
      detectEdges = true,
      detectShapes = true,
    } = options;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    const { width, height } = canvas;
    
    // Create output canvas
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const outCtx = out.getContext('2d');
    if (!outCtx) {
      throw new Error('Failed to get output canvas context');
    }

    // Get image data
    const imgData = ctx.getImageData(0, 0, width, height);
    
    // Apply threshold and create binary mask
    const maskData = this.createBinaryMask(imgData, threshold, invert);
    
    // Apply blur if requested
    if (blur > 0) {
      this.applyBlur(maskData, width, height, blur);
    }
    
    // Apply feathering if requested
    if (feather > 0) {
      this.applyFeathering(maskData, width, height, feather);
    }
    
    // Put mask data back
    outCtx.putImageData(maskData, 0, 0);
    
    let edges: string | undefined;
    let shapes: DetectedShape[] | undefined;

    // Edge detection
    if (detectEdges) {
      const edgeCanvas = this.detectEdges(maskData, width, height);
      edges = edgeCanvas.toDataURL('image/png');
    }

    // Shape detection
    if (detectShapes) {
      shapes = this.detectShapes(maskData, width, height);
    }

    return {
      maskData: out.toDataURL('image/png'),
      shapes,
      edges,
    };
  }

  /**
   * Create binary mask from image data
   */
  private createBinaryMask(imgData: ImageData, threshold: number, invert: boolean): ImageData {
    const mask = new ImageData(imgData.width, imgData.height);
    
    for (let i = 0; i < imgData.data.length; i += 4) {
      const alpha = imgData.data[i + 3];
      const isOpaque = alpha > threshold;
      
      if (invert) {
        if (!isOpaque) {
          mask.data[i] = 255;
          mask.data[i + 1] = 255;
          mask.data[i + 2] = 255;
          mask.data[i + 3] = 255;
        }
      } else {
        if (isOpaque) {
          mask.data[i] = 255;
          mask.data[i + 1] = 255;
          mask.data[i + 2] = 255;
          mask.data[i + 3] = 255;
        }
      }
    }
    
    return mask;
  }

  /**
   * Apply Gaussian blur to mask
   */
  private applyBlur(imgData: ImageData, width: number, height: number, radius: number): void {
    if (radius <= 0) return;
    
    const data = imgData.data;
    const temp = new Uint8ClampedArray(data);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;
        
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const idx = (ny * width + nx) * 4;
              sum += temp[idx + 3];
              count++;
            }
          }
        }
        
        const idx = (y * width + x) * 4;
        const avg = sum / count;
        data[idx + 3] = avg;
      }
    }
  }

  /**
   * Apply feathering (soft edges) to mask
   */
  private applyFeathering(imgData: ImageData, width: number, height: number, featherSize: number): void {
    const data = imgData.data;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        
        // Check if pixel is near edge
        const isEdge = this.isNearEdge(data, x, y, width, height);
        
        if (isEdge && data[idx + 3] > 0) {
          // Apply feathering
          const factor = this.getFeatherFactor(x, y, width, height, featherSize);
          data[idx + 3] = Math.floor(data[idx + 3] * factor);
        }
      }
    }
  }

  /**
   * Check if pixel is near edge
   */
  private isNearEdge(data: Uint8ClampedArray, x: number, y: number, width: number, height: number): boolean {
    const idx = (y * width + x) * 4;
    const current = data[idx + 3];
    
    // Check neighbors
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = (ny * width + nx) * 4;
          if (data[nIdx + 3] !== current) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Get feathering factor based on distance from edge
   */
  private getFeatherFactor(x: number, y: number, width: number, height: number, featherSize: number): number {
    const distToEdge = Math.min(x, y, width - x - 1, height - y - 1);
    return Math.min(1, distToEdge / featherSize);
  }

  /**
   * Detect edges using Sobel operator
   */
  private detectEdges(imgData: ImageData, width: number, height: number): HTMLCanvasElement {
    const edgeCanvas = document.createElement('canvas');
    edgeCanvas.width = width;
    edgeCanvas.height = height;
    const edgeCtx = edgeCanvas.getContext('2d');
    if (!edgeCtx) {
      throw new Error('Failed to get edge canvas context');
    }

    const data = imgData.data;
    const edgeData = edgeCtx.createImageData(width, height);
    
    // Sobel kernels
    const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0;
        let gy = 0;
        
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const val = data[idx + 3];
            gx += val * sobelX[ky + 1][kx + 1];
            gy += val * sobelY[ky + 1][kx + 1];
          }
        }
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        const idx = (y * width + x) * 4;
        edgeData.data[idx] = magnitude;
        edgeData.data[idx + 1] = magnitude;
        edgeData.data[idx + 2] = magnitude;
        edgeData.data[idx + 3] = 255;
      }
    }
    
    edgeCtx.putImageData(edgeData, 0, 0);
    return edgeCanvas;
  }

  /**
   * Detect shapes in mask
   */
  private detectShapes(imgData: ImageData, width: number, height: number): DetectedShape[] {
    const shapes: DetectedShape[] = [];
    const data = imgData.data;
    
    // Find connected components
    const visited = new Set<string>();
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const key = `${x},${y}`;
        
        if (data[idx + 3] > 0 && !visited.has(key)) {
          // Found a new component
          const component = this.floodFill(data, x, y, width, height, visited);
          const shape = this.classifyShape(component, width, height);
          shapes.push(shape);
        }
      }
    }
    
    return shapes;
  }

  /**
   * Flood fill to find connected component
   */
  private floodFill(
    data: Uint8ClampedArray,
    startX: number,
    startY: number,
    width: number,
    height: number,
    visited: Set<string>
  ): { x: number; y: number }[] {
    const component: { x: number; y: number }[] = [];
    const stack = [{ x: startX, y: startY }];
    
    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const key = `${x},${y}`;
      
      if (visited.has(key)) continue;
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      
      const idx = (y * width + x) * 4;
      if (data[idx + 3] === 0) continue;
      
      visited.add(key);
      component.push({ x, y });
      
      // Add neighbors
      stack.push({ x: x + 1, y });
      stack.push({ x: x - 1, y });
      stack.push({ x, y: y + 1 });
      stack.push({ x, y: y - 1 });
    }
    
    return component;
  }

  /**
   * Classify shape based on component
   */
  private classifyShape(component: { x: number; y: number }[], _width: number, _height: number): DetectedShape {
    if (component.length === 0) {
      return { type: 'unknown', bounds: { x: 0, y: 0, width: 0, height: 0 }, confidence: 0 };
    }
    
    // Calculate bounding box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const { x, y } of component) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    
    const bounds = {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
    
    // Calculate aspect ratio and fill ratio
    const aspectRatio = bounds.width / bounds.height;
    const fillRatio = component.length / (bounds.width * bounds.height);
    
    // Classify based on properties
    let type: DetectedShape['type'] = 'unknown';
    let confidence = 0.5;
    
    // Rectangle check
    if (fillRatio > 0.8) {
      type = 'rectangle';
      confidence = 0.8;
    }
    
    // Circle check
    if (Math.abs(aspectRatio - 1) < 0.2 && fillRatio > 0.7) {
      type = 'circle';
      confidence = 0.7;
    }
    
    // Triangle check
    if (fillRatio > 0.4 && fillRatio < 0.6) {
      type = 'triangle';
      confidence = 0.6;
    }
    
    return { type, bounds, confidence };
  }

  /**
   * Smart crop based on mask content
   */
  smartCrop(canvas: HTMLCanvasElement, maskData: ImageData): { x: number; y: number; width: number; height: number } {
    const width = canvas.width;
    const height = canvas.height;
    const data = maskData.data;
    
    let minX = width, minY = height, maxX = 0, maxY = 0;
    
    // Find bounding box of non-transparent pixels
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (data[idx + 3] > 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    // Add padding
    const padding = 10;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(width - 1, maxX + padding);
    maxY = Math.min(height - 1, maxY + padding);
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }
}

export const maskService = new MaskService();
