import { useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../../utils/logger';
import {
  exportImageWithDialog,
  exportImagesBatchWithDialog,
  exportNodesToPDFWithDialog,
  exportImageToDXFWithDialog,
  saveDXFFromServer,
  exportImagesToPDFWithDialog,
} from '../../../services/export';
import { resolveImageUrl } from '../utils/builderHelpers.tsx';
import type { BuilderNode } from '../types';
import { IMAGE2CAD_BASE_URL } from '../../../config/image2cad';

interface UseBuilderExportArgs {
  nodes: BuilderNode[];
  addNotification: (notification: any) => void;
  setCompareSlot: (slot: 'A' | 'B', url: string) => void;
  setConfig: React.Dispatch<React.SetStateAction<any>>;
}

export function useBuilderExport({
  nodes,
  addNotification,
  setCompareSlot,
  setConfig,
}: UseBuilderExportArgs) {
  const isAnalyzingRef = useRef(false);

  const handleContextCompare = (contextNode: BuilderNode | undefined, slot: 'A' | 'B') => {
    const data = contextNode?.data;
    const imageUrl = data?.image ?? data?.outputData?.image;
    if (imageUrl) {
      setCompareSlot(slot, imageUrl);
      setConfig((prev: any) => ({ ...prev }));
    }
  };

  const handleContextSaveNodeImage = (contextNode: BuilderNode | undefined) => {
    if (!contextNode) return;
    const data = contextNode.data;
    const imageUrl = data?.image ?? data?.outputData?.image;
    if (!imageUrl) return;
    const baseName = `${data?.type || 'node'}_${contextNode.id}`;
    exportImageWithDialog(imageUrl, baseName)
      .then(filePath => filePath && addNotification({ type: 'success', title: 'Image Saved', message: `Saved to: ${filePath.split(/[\\/]/).pop()}` }))
      .catch(err => { logger.error('[Save Image] failed:', err); addNotification({ type: 'error', title: 'Save Failed', message: err?.message || 'Failed to save image' }); });
  };

  const handleContextExportDXF = (contextNode: BuilderNode | undefined) => {
    if (!contextNode) return;
    const data = contextNode.data;
    const imageUrl = data?.image ?? data?.outputData?.image;
    if (!imageUrl) return;
    const baseName = `${data?.type || 'node'}_${contextNode.id}`;
    exportImageToDXFWithDialog(imageUrl, baseName)
      .then(filePath => filePath && addNotification({ type: 'success', title: 'CAD File Saved', message: `Saved to: ${filePath.split(/[\\/]/).pop()}` }))
      .catch(err => { logger.error('[Export CAD] failed:', err); addNotification({ type: 'error', title: 'Export Failed', message: err?.message || 'Failed to export CAD file' }); });
  };

  const handleContextAnalyzePlan = async (contextNode: BuilderNode | undefined) => {
    if (!contextNode) return;
    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;

    try {
      const data = contextNode.data;
      const imageUrl = data?.image ?? data?.outputData?.image;
      if (!imageUrl) return;

      addNotification({ type: 'success', title: 'Analyzing Floor Plan...', message: 'Sending to Image2CAD engine, please wait.' });

      const base64Uri = await resolveImageUrl(imageUrl);

      const responseText = await invoke<string>('analyze_floor_plan', { imageBase64: base64Uri });
      const result = JSON.parse(responseText);

      const dxfUrl = `${IMAGE2CAD_BASE_URL}${result.dxf_url}`;
      const baseName = `floor_plan_${contextNode.id}`;
      const filePath = await saveDXFFromServer(dxfUrl, baseName);

      if (!filePath) {
        addNotification({ type: 'info', title: 'Export Cancelled', message: 'CAD export was cancelled.' });
        return;
      }

      const { lines, circles } = result.entities ?? {};
      addNotification({
        type:    'success',
        title:   'Floor Plan → CAD Complete ✓',
        message: `Saved to: ${filePath.split(/[\\/]/).pop()} (Lines: ${lines ?? 0} Circles: ${circles ?? 0})`,
      });

    } catch (err: any) {
      logger.error('[Analyze Plan] failed:', err);
      const errMsg = err?.message || String(err) || 'Unknown error';
      addNotification({
        type:    'error',
        title:   'Analyze Plan Failed',
        message: `${errMsg} (تأكد أن خادم Image2CAD يعمل)`,
      });
    } finally {
      isAnalyzingRef.current = false;
    }
  };

  const handleContextExportAll = () => {
    const items = nodes
      .map(n => {
        const d = n.data;
        const url = d?.image ?? d?.outputData?.image;
        if (!url) return null;
        const item: { url: string; name: string; prompt?: string } = { url: String(url), name: `${d?.type || 'node'}_${n.id}` };
        if (d?.prompt) item.prompt = String(d.prompt);
        return item;
      })
      .filter((x): x is { url: string; name: string; prompt?: string } => x !== null);

    if (items.length === 0) {
      addNotification({ type: 'info', title: 'No Images', message: 'No images found on canvas.' });
      return;
    }
    exportImagesBatchWithDialog(items)
      .then(({ succeeded, failed }) => {
        if (succeeded > 0) addNotification({ type: 'success', title: 'Images Exported', message: `${succeeded} image(s) saved successfully` });
        if (failed > 0)    addNotification({ type: 'error',   title: 'Export Failed',   message: `${failed} image(s) failed to export` });
      })
      .catch(err => { logger.error('[Export All] error:', err); addNotification({ type: 'error', title: 'Export Error', message: String(err) }); });
  };

  const handleContextExportPDF = () => {
    exportNodesToPDFWithDialog(nodes, { title: 'Anarchy AI Canvas Export', author: 'Anarchy AI', subject: 'AI Generated Images from Canvas', includeMetadata: true })
      .then(filePath => filePath && addNotification({ type: 'success', title: 'PDF Exported', message: `Saved to: ${filePath.split(/[\\/]/).pop()}` }))
      .catch((err: any) => { logger.error('[PDF Export] failed:', err); addNotification({ type: 'error', title: 'PDF Export Failed', message: err?.message || 'Failed to export PDF' }); });
  };

  const handleContextOpenImagesFolder = async (contextNode: BuilderNode | undefined) => {
    try {
      if (!contextNode) {
        await invoke('open_images_folder');
        return;
      }
      const data = contextNode.data;
      const imageUrl = data?.image ?? data?.outputData?.image;
      if (!imageUrl) {
        await invoke('open_images_folder');
        return;
      }

      const base64Uri = await resolveImageUrl(imageUrl);
      const ext = base64Uri.split(';')[0].split('/')[1] || 'png';
      const cleanExt = ext === 'jpeg' ? 'jpg' : ext;
      const fileName = `${data?.type || 'node'}_${contextNode.id}.${cleanExt}`;

      const filePath = await invoke<string>('save_image_to_documents', {
        dataUri: base64Uri,
        fileName
      });

      await invoke('show_in_explorer', { path: filePath });

    } catch (err: any) {
      logger.error('[Open Images Folder] failed:', err);
      invoke('open_images_folder').catch(() => {});
    }
  };

  const handleContextExportNodePDF = async (contextNode: BuilderNode | undefined) => {
    if (!contextNode) return;
    const data = contextNode.data;
    const imageUrl = data?.image ?? data?.outputData?.image;
    if (!imageUrl) return;

    addNotification({ type: 'info', title: 'Exporting PDF...', message: 'Preparing PDF document, please wait.' });

    try {
      const base64Uri = await resolveImageUrl(imageUrl);
      const baseName = `${data?.type || 'node'}_${contextNode.id}`;
      const item = {
        url: base64Uri,
        name: baseName,
        prompt: data?.prompt ? String(data.prompt) : undefined
      };

      const filePath = await exportImagesToPDFWithDialog([item], {
        title: `Anarchy AI Export - ${baseName}`,
        author: 'Anarchy AI',
        subject: 'AI Generated Image',
        includeMetadata: true
      });

      if (filePath) {
        addNotification({
          type: 'success',
          title: 'PDF Exported ✓',
          message: `Saved to: ${filePath.split(/[\\/]/).pop()}`
        });
      }
    } catch (err: any) {
      logger.error('[Node PDF Export] failed:', err);
      addNotification({
        type: 'error',
        title: 'PDF Export Failed',
        message: err?.message || String(err) || 'Failed to export PDF'
      });
    }
  };

  return {
    handleContextCompare,
    handleContextSaveNodeImage,
    handleContextExportDXF,
    handleContextAnalyzePlan,
    handleContextExportAll,
    handleContextExportPDF,
    handleContextOpenImagesFolder,
    handleContextExportNodePDF,
    isAnalyzing: isAnalyzingRef,
  };
}
