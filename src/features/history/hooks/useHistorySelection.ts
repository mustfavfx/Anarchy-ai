import { useHistoryStore } from '../stores/historyStore';
import { loadRawData, loadFullImage } from '../services/HistoryService';
import { exportImagesToPDF } from '../../../utils/pdfExport';
import { logger } from '../../../utils/logger';

export function useHistorySelection() {
  const {
    selectMode,
    selectedIds,
    setSelectMode,
    setSelectedIds,
    toggleSelectId,
    toggleSelectAll,
    deleteSelectedEntries,
    entries
  } = useHistoryStore();

  const handleBulkExportZip = async () => {
    if (selectedIds.size === 0) return;
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const folder = zip.folder('anarchy-export')!;

      const selectedEntries = entries.filter(e => selectedIds.has(e.id));

      for (const e of selectedEntries) {
        // Load the Blob directly from IndexedDB to bypass Base64 encoding/decoding overhead!
        let blob = await loadRawData(`${e.id}_output`) || await loadRawData(`${e.id}_input`);
        
        if (blob && blob instanceof Blob) {
          const safeName = (e.label || e.id).replace(/[^a-zA-Z0-9_\-]/g, '_');
          folder.file(`${safeName}.png`, blob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const blobUrl = URL.createObjectURL(zipBlob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `anarchy-export-${Date.now()}.zip`;
      a.click();

      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      setSelectMode(false);
    } catch (err) {
      logger.error('[HistorySelection] Bulk ZIP export failed:', err);
    }
  };

  const handleBulkExportPDF = async () => {
    if (selectedIds.size === 0) return;
    try {
      const selectedEntries = entries.filter(e => selectedIds.has(e.id));
      
      const images: Array<{ url: string; name: string; prompt?: string }> = [];
      for (const e of selectedEntries) {
        const url = await loadFullImage(e.id, 'output') || await loadFullImage(e.id, 'input');
        if (url) {
          images.push({
            url,
            name: e.label,
            prompt: e.prompt
          });
        }
      }

      if (images.length > 0) {
        await exportImagesToPDF(images, { title: 'Anarchy AI — History Export' });
      }
      setSelectMode(false);
    } catch (err) {
      logger.error('[HistorySelection] Bulk PDF export failed:', err);
    }
  };

  return {
    selectMode,
    selectedIds,
    setSelectMode,
    setSelectedIds,
    toggleSelectId,
    toggleSelectAll,
    handleBulkDelete: deleteSelectedEntries,
    handleBulkExportZip,
    handleBulkExportPDF
  };
}
