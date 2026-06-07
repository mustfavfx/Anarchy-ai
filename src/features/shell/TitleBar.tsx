import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../../utils/logger';
import { Minus, Square, X } from 'lucide-react';
import './TitleBar.css';

interface TitleBarProps {
  onCloseRequest?: () => void;
}

// Check if running in Tauri environment
const isTauri = () => {
  return typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== undefined;
};


export const TitleBar: React.FC<TitleBarProps> = ({ onCloseRequest }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [windowApi, setWindowApi] = useState<{ minimize: () => Promise<void>; unmaximize: () => Promise<void>; maximize: () => Promise<void>; close: () => Promise<void>; isMaximized: () => Promise<boolean> } | null>(null);
  useEffect(() => {
    const loadTauriApi = async () => {
      if (isTauri()) {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          const window = getCurrentWindow();
          setWindowApi(window);
          const maximized = await window.isMaximized();
          setIsMaximized(maximized);
        } catch (error) {
          // Window API not available
          logger.error('Failed to get window API:', error);
        }
      }
    };
    loadTauriApi();
  }, []);

  const handleMinimize = useCallback(async () => {
    if (!windowApi) return;
    try { await windowApi.minimize(); } catch (err) { logger.error('Minimize failed:', err); }
  }, [windowApi]);

  const handleMaximize = useCallback(async () => {
    if (!windowApi) return;
    try {
      if (isMaximized) await windowApi.unmaximize();
      else await windowApi.maximize();
      setIsMaximized(!isMaximized);
    } catch (err) { logger.error('Maximize failed:', err); }
  }, [windowApi, isMaximized]);

  const handleClose = useCallback(async () => {
    if (onCloseRequest) onCloseRequest();
    else if (windowApi) { try { await windowApi.close(); } catch (err) {} }
    else window.close();
  }, [onCloseRequest, windowApi]);

  return (
    <div className="title-bar" data-tauri-drag-region>
      <div className="title-bar-left" data-tauri-drag-region>
        <div className="window-title">Anarchy AI</div>
      </div>
      <div className="title-bar-center" />
      <div className="title-bar-right">
        <button className="window-btn minimize" onClick={handleMinimize} title="Minimize">
          <Minus size={14} />
        </button>
        <button className="window-btn maximize" onClick={handleMaximize} title={isMaximized ? "Restore" : "Maximize"}>
          <Square size={12} />
        </button>
        <button className="window-btn close" onClick={handleClose} title="Close">
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
