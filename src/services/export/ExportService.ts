/**
 * Export Service
 * Modular architecture with native save dialogs
 * Exports images, PDFs, ZIPs, DXF vectors, and project files with program identity
 */

// ── Types and Identity ─────────────────────────────────────────────────────────
export type {
  ExportImageItem,
  ExportOptions,
  ZipExportOptions,
  PDFExportOptions,
  DxfCalibration,
} from './modules/exportTypes';
export { PROGRAM_IDENTITY } from './modules/exportTypes';

// ── Image Conversion and Batch Utilities ──────────────────────────────────────
export {
  urlToDataUri,
  saveDataUriWithDialog,
  exportImageWithDialog,
  exportImagesBatchWithDialog,
  extractImagesFromNodes,
  loadImageElement,
  stripCallbacks,
} from './modules/imageExportUtils';

// ── PDF Exporter ──────────────────────────────────────────────────────────────
export {
  exportImagesToPDFWithDialog,
  exportNodesToPDFWithDialog,
} from './modules/pdfExporter';

// ── ZIP Archive Exporter ──────────────────────────────────────────────────────
export {
  exportImagesToZipWithDialog,
  exportNodesToZipWithDialog,
} from './modules/zipExporter';

// ── DXF CAD Vectorization Engine & Exporter ───────────────────────────────────
export {
  imageToDxfString,
} from './modules/dxfVectorEngine';
export {
  exportImageToDXFWithDialog,
  saveDXFFromServer,
} from './modules/dxfExporter';

// ── Project File Manager (.ana) ───────────────────────────────────────────────
export {
  exportProjectWithIdentity,
  loadProjectWithIdentity,
} from './modules/projectFileManager';
