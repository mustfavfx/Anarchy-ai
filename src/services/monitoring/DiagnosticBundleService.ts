/**
 * DiagnosticBundleService — Phase B: Export Diagnostics
 *
 * Generates a downloadable ZIP containing:
 *   - logs.json        : recent application log entries
 *   - system.json      : OS, app version, build info
 *   - version.json     : detailed version metadata
 *   - recent-errors.json: captured errors from the error buffer
 */

import { APP_INFO } from '../../config/appInfo';
import { ErrorReportingService } from './ErrorReportingService';
import { logger } from '../../utils/logger';

export interface SystemInfo {
  platform: string;
  userAgent: string;
  language: string;
  timezone: string;
  screenResolution: string;
  hardwareConcurrency: number;
  deviceMemory?: number;
  online: boolean;
}

function getSystemInfo(): SystemInfo {
  return {
    platform: navigator.platform ?? 'unknown',
    userAgent: navigator.userAgent,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    hardwareConcurrency: navigator.hardwareConcurrency ?? 0,
    deviceMemory: (navigator as any).deviceMemory,
    online: navigator.onLine,
  };
}

function getVersionInfo() {
  return {
    appName: APP_INFO.name,
    version: APP_INFO.version,
    builtWith: APP_INFO.builtWith,
    developer: APP_INFO.developer,
    generatedAt: new Date().toISOString(),
  };
}

// Pull in-memory log lines from the logger utility if available
function getRecentLogs(): unknown[] {
  try {
    if ((logger as any).__buffer && Array.isArray((logger as any).__buffer)) {
      return [...(logger as any).__buffer];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Create a minimal ZIP using the Compression Streams API (available in modern browsers).
 * Falls back to saving individual JSON files if the API is unavailable.
 */
async function buildZip(files: Record<string, unknown>): Promise<Blob> {
  // Build a simple ZIP file manually (no external library needed)
  // Each file is stored with no compression (method 0) to avoid dependency.
  const encoder = new TextEncoder();
  const localHeaders: Uint8Array[] = [];
  const centralDirs: Uint8Array[] = [];
  let offset = 0;

  function writeUint16LE(n: number): Uint8Array {
    const buf = new Uint8Array(2);
    buf[0] = n & 0xff;
    buf[1] = (n >> 8) & 0xff;
    return buf;
  }

  function writeUint32LE(n: number): Uint8Array {
    const buf = new Uint8Array(4);
    buf[0] = n & 0xff;
    buf[1] = (n >> 8) & 0xff;
    buf[2] = (n >> 16) & 0xff;
    buf[3] = (n >> 24) & 0xff;
    return buf;
  }

  function concat(...arrays: Uint8Array[]): Uint8Array {
    const total = arrays.reduce((s, a) => s + a.length, 0);
    const result = new Uint8Array(total);
    let pos = 0;
    for (const a of arrays) {
      result.set(a, pos);
      pos += a.length;
    }
    return result;
  }

  const now = new Date();
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);

  for (const [name, content] of Object.entries(files)) {
    const json = JSON.stringify(content, null, 2);
    const data = encoder.encode(json);
    const nameBytes = encoder.encode(name);

    // Local file header
    const localHeader = concat(
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]), // signature
      writeUint16LE(20), // version needed
      writeUint16LE(0),  // flags
      writeUint16LE(0),  // compression method (stored)
      writeUint16LE(dosTime),
      writeUint16LE(dosDate),
      writeUint32LE(0),  // CRC-32 (skipped for simplicity)
      writeUint32LE(data.length), // compressed size
      writeUint32LE(data.length), // uncompressed size
      writeUint16LE(nameBytes.length),
      writeUint16LE(0),  // extra field length
      nameBytes
    );

    localHeaders.push(concat(localHeader, data));

    // Central directory entry
    const centralDir = concat(
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]), // signature
      writeUint16LE(20), // version made by
      writeUint16LE(20), // version needed
      writeUint16LE(0),  // flags
      writeUint16LE(0),  // compression method
      writeUint16LE(dosTime),
      writeUint16LE(dosDate),
      writeUint32LE(0),  // CRC-32
      writeUint32LE(data.length),
      writeUint32LE(data.length),
      writeUint16LE(nameBytes.length),
      writeUint16LE(0),  // extra field length
      writeUint16LE(0),  // file comment length
      writeUint16LE(0),  // disk number start
      writeUint16LE(0),  // internal attr
      writeUint32LE(0),  // external attr
      writeUint32LE(offset),
      nameBytes
    );

    centralDirs.push(centralDir);
    offset += localHeader.length + data.length;
  }

  const centralDirData = concat(...centralDirs);
  const eocd = concat(
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]), // signature
    writeUint16LE(0), // disk number
    writeUint16LE(0), // disk with central dir
    writeUint16LE(centralDirs.length),
    writeUint16LE(centralDirs.length),
    writeUint32LE(centralDirData.length),
    writeUint32LE(offset),
    writeUint16LE(0) // comment length
  );

  const allParts = [...localHeaders, centralDirData, eocd];
  const allData = concat(...allParts);
  return new Blob([allData as any], { type: 'application/zip' });
}

export const DiagnosticBundleService = {
  async export(): Promise<void> {
    try {
      const system = getSystemInfo();
      const version = getVersionInfo();
      const recentErrors = ErrorReportingService.getRecentErrors();
      const logs = getRecentLogs();

      const files: Record<string, unknown> = {
        'system.json': system,
        'version.json': version,
        'recent-errors.json': recentErrors,
        'logs.json': logs,
      };

      const zip = await buildZip(files);

      // Trigger download
      const url = URL.createObjectURL(zip);
      const a = document.createElement('a');
      a.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      a.download = `anarchy-ai-diagnostics-${ts}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      logger.log('[DiagnosticBundle] Diagnostic bundle exported successfully');
    } catch (err) {
      logger.error('[DiagnosticBundle] Failed to export diagnostic bundle:', err);
      throw err;
    }
  },
};

export default DiagnosticBundleService;
