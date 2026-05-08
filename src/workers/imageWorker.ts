/**
 * Image Processing Web Worker
 * Handles image processing in background thread
 */

export interface ImageProcessMessage {
  type: 'resize' | 'crop' | 'filter' | 'compress';
  imageData: string; // base64 or blob URL
  options?: {
    width?: number;
    height?: number;
    quality?: number;
    crop?: { x: number; y: number; width: number; height: number };
    filter?: 'grayscale' | 'sepia' | 'blur' | 'brightness' | 'contrast';
  };
}

export interface ImageProcessResult {
  success: boolean;
  data?: string;
  error?: string;
}

self.onmessage = async (e: MessageEvent<ImageProcessMessage>) => {
  const { type, imageData, options } = e.data;

  try {
    let result: string;

    switch (type) {
      case 'resize':
        result = await resizeImage(imageData, options);
        break;
      case 'crop':
        result = await cropImage(imageData, options?.crop);
        break;
      case 'filter':
        result = await applyFilter(imageData, options?.filter);
        break;
      case 'compress':
        result = await compressImage(imageData, options?.quality);
        break;
      default:
        throw new Error(`Unknown operation: ${type}`);
    }

    self.postMessage({ success: true, data: result } as ImageProcessResult);
  } catch (error) {
    self.postMessage({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    } as ImageProcessResult);
  }
};

async function resizeImage(imageData: string, options?: { width?: number; height?: number }): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      const targetWidth = options?.width || img.width;
      const targetHeight = options?.height || img.height;
      
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageData;
  });
}

async function cropImage(imageData: string, crop?: { x: number; y: number; width: number; height: number }): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx || !crop) {
        reject(new Error('Failed to get canvas context or crop options'));
        return;
      }

      canvas.width = crop.width;
      canvas.height = crop.height;
      
      ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
      
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageData;
  });
}

async function applyFilter(imageData: string, filter?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      
      ctx.drawImage(img, 0, 0);
      
      if (ctx.filter !== undefined) {
        switch (filter) {
          case 'grayscale':
            ctx.filter = 'grayscale(100%)';
            break;
          case 'sepia':
            ctx.filter = 'sepia(100%)';
            break;
          case 'blur':
            ctx.filter = 'blur(5px)';
            break;
          case 'brightness':
            ctx.filter = 'brightness(1.2)';
            break;
          case 'contrast':
            ctx.filter = 'contrast(1.2)';
            break;
        }
        ctx.drawImage(img, 0, 0);
      }
      
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageData;
  });
}

async function compressImage(imageData: string, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      
      ctx.drawImage(img, 0, 0);
      
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageData;
  });
}
