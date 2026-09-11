/**
 * Export Service Types and Constants
 */

export interface ExportImageItem {
  url: string;
  name: string;
  prompt?: string | null;
}

export interface ExportOptions {
  format?: 'png' | 'jpg' | 'webp';
  quality?: number;
}

export interface ZipExportOptions {
  includePrompts?: boolean;
  includeManifest?: boolean;
  zipName?: string;
  format?: 'png' | 'jpg' | 'webp';
}

export interface PDFExportOptions {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  includeMetadata?: boolean;
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface DxfCalibration {
  /** Real-world millimeters per pixel, measured at the image's natural (original) resolution. */
  mmPerPixel: number;
}

export const PROGRAM_IDENTITY = {
  name: 'Anarchy AI',
  version: '0.2.1',
  fileExtension: 'ana',
  fileDescription: 'Anarchy AI Project',
  website: 'https://anarchy-ai.com',
  signature: 'ANARCHY_AI_PROJECT_FILE',
};

export const sanitize = (s: string): string =>
  s.replaceAll(/[^a-z0-9._-]+/gi, '_').slice(0, 80) || 'image';

export const timestamp = (): string =>
  new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-').slice(0, 19);
