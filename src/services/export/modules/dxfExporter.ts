import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import {
  sanitize,
  timestamp,
  type DxfCalibration
} from './exportTypes';
import { imageToDxfString } from './dxfVectorEngine';

/**
 * Export image to DXF (CAD format) with native save dialog
 */
export async function exportImageToDXFWithDialog(
  url: string,
  name: string,
  calibration?: DxfCalibration
): Promise<string | null> {
  const fileName = `${sanitize(name)}_${timestamp()}.dxf`;
  
  // Show save dialog
  const filePath = await save({
    defaultPath: fileName,
    filters: [
      { name: 'CAD Drawing Exchange Format (*.dxf)', extensions: ['dxf'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  
  if (!filePath) return null; // User cancelled
  
  // Convert image to DXF string via vectorization engine
  const dxfContent = await imageToDxfString(url, calibration);
  
  // Save via Tauri native command
  await invoke('save_file', { 
    path: filePath, 
    contents: dxfContent,
    binary: false 
  });
  
  return filePath;
}

/**
 * Download and save a DXF file from a remote URL (e.g. server-side AI vectorization)
 */
export async function saveDXFFromServer(
  dxfUrl: string,
  name: string
): Promise<string | null> {
  const fileName = `${sanitize(name)}_${timestamp()}.dxf`;
  
  // Show save dialog
  const filePath = await save({
    defaultPath: fileName,
    filters: [
      { name: 'CAD Drawing Exchange Format (*.dxf)', extensions: ['dxf'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  
  if (!filePath) return null;
  
  // Fetch file from the server
  const response = await fetch(dxfUrl);
  if (!response.ok) throw new Error('Failed to download DXF from server');
  const dxfBuffer = await response.arrayBuffer();
  
  // Convert ArrayBuffer to Base64
  let binary = '';
  const bytes = new Uint8Array(dxfBuffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Data = btoa(binary);
  const dataUri = `data:application/octet-stream;base64,${base64Data}`;
  
  // Save via Tauri native command
  await invoke('save_image_to_path', { path: filePath, dataUri });
  
  return filePath;
}
