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
