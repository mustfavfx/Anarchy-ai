import { useHistoryStore } from '@/stores/historyStore';
import { logger } from '../../../utils/logger';

export function useHistorySelection() {
  const {
    selectMode,
    selectedIds,
    setSelectMode,
    setSelectedIds,
    toggleSelectId,
    toggleSelectAll,
    deleteSelectedEntries
  } = useHistoryStore();

  const handleBulkExportZip = async () => {
    if (selectedIds.size === 0) return;
    try {
      const { exportQueue } = await import('@/services/export/ExportQueueService');
      await exportQueue.startExportJob({
        type: 'zip',
        entryIds: Array.from(selectedIds)
      });
      setSelectMode(false);
    } catch (err) {
      logger.error('[HistorySelection] Bulk ZIP export failed:', err);
    }
  };

  const handleBulkExportPDF = async () => {
    if (selectedIds.size === 0) return;
    try {
      const { exportQueue } = await import('@/services/export/ExportQueueService');
      await exportQueue.startExportJob({
        type: 'pdf',
        entryIds: Array.from(selectedIds),
        options: { title: 'Anarchy AI — Selected History Export' }
      });
      setSelectMode(false);
    } catch (err) {
      logger.error('[HistorySelection] Bulk PDF export failed:', err);
    }
  };

    const handleExportAllPDF = async (customEntries?: any[]) => {
    const { useNotificationStore } = await import('@/stores/notificationStore');
    const { loadEntries, loadFullImage, loadThumbnail } = await import('@/services/history/HistoryService');
    const { exportImagesToPDF } = await import('@/utils/pdfExport');

    try {
      const allEntries = customEntries && customEntries.length > 0 ? customEntries : loadEntries();
      if (!allEntries || allEntries.length === 0) {
        useNotificationStore.getState().addNotification({
          type: 'info',
          title: 'History Empty',
          message: 'No history entries found to export.'
        });
        return;
      }

      useNotificationStore.getState().addNotification({
        type: 'info',
        title: 'Preparing PDF Export',
        message: `Gathering ${allEntries.length} images for PDF presentation...`
      });

      const items: Array<{ url: string; name: string; prompt?: string }> = [];

      for (let i = 0; i < allEntries.length; i++) {
        const entry = allEntries[i];
        let url = await loadFullImage(entry.id, 'output')
               || await loadFullImage(entry.id, 'input')
               || await loadFullImage(entry.id, 'root_source')
               || await loadThumbnail(entry.id, 'output')
               || await loadThumbnail(entry.id, 'input')
               || (entry as any).outputImage 
               || (entry as any).inputImage;

        if (!url && (entry as any).sourceImageId) {
          url = await loadFullImage((entry as any).sourceImageId, 'root_source')
             || await loadThumbnail((entry as any).sourceImageId, 'root_source');
        }

        if (url) {
          items.push({
            url,
            name: entry.label || `Image ${i + 1}`,
            prompt: entry.prompt || (entry as any).positivePrompt || undefined
          });
        }
      }

      if (items.length === 0) {
        useNotificationStore.getState().addNotification({
          type: 'error',
          title: 'Export Failed',
          message: 'No valid image data could be found to export.'
        });
        return;
      }

      const savedPath = await exportImagesToPDF(items, { title: 'Anarchy AI History Portfolio' });

      if (savedPath) {
        useNotificationStore.getState().addNotification({
          type: 'success',
          title: 'PDF Export Complete',
          message: `Saved ${items.length} images to PDF successfully.`
        });
      }
    } catch (err: any) {
      logger.error('[HistorySelection] Full PDF export failed:', err);
      useNotificationStore.getState().addNotification({
        type: 'error',
        title: 'Export Error',
        message: err?.message || 'Failed to export history to PDF.'
      });
    }
  };

  const handleBulkExportFolder = async () => {
    if (selectedIds.size === 0) return;
    try {
      const { loadFullImage, loadEntries } = await import('@/services/history/HistoryService');
      const { exportImagesBatchWithDialog } = await import('@/services/export/ExportService');
      const { useNotificationStore } = await import('@/stores/notificationStore');
      
      const entries = loadEntries();
      const selectedEntries = entries.filter(e => selectedIds.has(e.id));
      
      const items: Array<{ url: string; name: string }> = [];
      for (const entry of selectedEntries) {
        const url = await loadFullImage(entry.id, 'output') || await loadFullImage(entry.id, 'input');
        if (url) {
          items.push({
            url,
            name: entry.label || entry.id
          });
        }
      }
      
      if (items.length === 0) {
        useNotificationStore.getState().addNotification({
          type: 'info',
          title: 'No Images',
          message: 'No images found in selected history entries.'
        });
        return;
      }
      
      const { succeeded, failed } = await exportImagesBatchWithDialog(items);
      
      if (succeeded > 0) {
        useNotificationStore.getState().addNotification({
          type: 'success',
          title: 'Export Succeeded',
          message: `Successfully exported ${succeeded} items to folder.`
        });
      }
      if (failed > 0) {
        useNotificationStore.getState().addNotification({
          type: 'error',
          title: 'Export Failed',
          message: `Failed to export ${failed} items.`
        });
      }
      setSelectMode(false);
    } catch (err) {
      logger.error('[HistorySelection] Bulk Folder export failed:', err);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      await deleteSelectedEntries();
    } catch (err) {
      logger.error('[HistorySelection] Bulk delete failed:', err);
    }
  };

  return {
    selectMode,
    selectedIds,
    setSelectMode,
    setSelectedIds,
    toggleSelectId,
    toggleSelectAll,
    handleBulkDelete,
    handleBulkExportZip,
    handleBulkExportPDF,
    handleExportAllPDF,
    handleBulkExportFolder
  };
}
