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
        options: { title: 'Anarchy AI — History Export' }
      });
      setSelectMode(false);
    } catch (err) {
      logger.error('[HistorySelection] Bulk PDF export failed:', err);
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

  return {
    selectMode,
    selectedIds,
    setSelectMode,
    setSelectedIds,
    toggleSelectId,
    toggleSelectAll,
    handleBulkDelete: deleteSelectedEntries,
    handleBulkExportZip,
    handleBulkExportPDF,
    handleBulkExportFolder
  };
}
