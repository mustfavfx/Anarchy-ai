import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Minus, Square, X, Search, Bell, Check, AlertCircle, Sparkles } from 'lucide-react';
import { useNotificationStore } from '../../stores/notificationStore';
import './TitleBar.css';

interface TitleBarProps {
  onCloseRequest?: () => void;
}

// Check if running in Tauri environment
const isTauri = () => {
  return typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ !== undefined;
};

const formatTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString();
};

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'success': return <Sparkles size={14} className="notif-icon success" />;
    case 'error': return <AlertCircle size={14} className="notif-icon error" />;
    default: return <Bell size={14} className="notif-icon info" />;
  }
};

export const TitleBar: React.FC<TitleBarProps> = ({ onCloseRequest }) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [windowApi, setWindowApi] = useState<{ minimize: () => Promise<void>; unmaximize: () => Promise<void>; maximize: () => Promise<void>; close: () => Promise<void>; isMaximized: () => Promise<boolean> } | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const dismissNotification = useNotificationStore((state) => state.dismissNotification);

  useEffect(() => {
    // Close panel on outside click
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    if (showNotifications) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications]);

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
          console.error('Failed to get window API:', error);
        }
      }
    };
    loadTauriApi();
  }, []);

  const handleMinimize = useCallback(async () => {
    if (!windowApi) return;
    try { await windowApi.minimize(); } catch (err) { console.error('Minimize failed:', err); }
  }, [windowApi]);

  const handleMaximize = useCallback(async () => {
    if (!windowApi) return;
    try {
      if (isMaximized) await windowApi.unmaximize();
      else await windowApi.maximize();
      setIsMaximized(!isMaximized);
    } catch (err) { console.error('Maximize failed:', err); }
  }, [windowApi, isMaximized]);

  const handleClose = useCallback(async () => {
    if (onCloseRequest) onCloseRequest();
    else if (windowApi) { try { await windowApi.close(); } catch (err) {} }
    else window.close();
  }, [onCloseRequest, windowApi]);

  const toggleNotifications = () => {
    setShowNotifications(v => !v);
    if (!showNotifications && unreadCount > 0) {
      // Mark as read when opening
      setTimeout(() => markAllAsRead(), 300);
    }
  };

  return (
    <div className="title-bar" data-tauri-drag-region>
      <div className="title-bar-left" data-tauri-drag-region>
        <div className="window-title">Anarchy AI</div>
      </div>
      <div className="title-bar-center">
        <div className="titlebar-search">
          <Search size={14} />
          <input type="text" placeholder="Search projects, assets..." />
          <div className="titlebar-shortcut">⌘K</div>
        </div>
        <div ref={notificationRef} className="notification-wrapper">
          <button 
            className={`titlebar-notifications-btn ${unreadCount > 0 ? 'has-unread' : ''}`} 
            title={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
            onClick={toggleNotifications}
          >
            <Bell size={16} />
            {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          
          {showNotifications && (
            <div className="notification-panel">
              <div className="notification-header">
                <span className="notification-title">Notifications</span>
                {notifications.length > 0 && (
                  <button className="notification-clear" onClick={markAllAsRead} title="Mark all as read">
                    <Check size={14} />
                  </button>
                )}
              </div>
              <div className="notification-list">
                {notifications.length === 0 ? (
                  <div className="notification-empty">
                    <Bell size={24} className="empty-icon" />
                    <p>No notifications yet</p>
                    <small>Image generation events will appear here</small>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div 
                      key={n.id} 
                      className={`notification-item ${n.read ? 'read' : 'unread'} ${n.type}`}
                      onClick={() => { markAsRead(n.id); }}
                    >
                      <div className="notification-icon">
                        {n.imageUrl ? (
                          <img src={n.imageUrl} alt="" className="notif-thumb" />
                        ) : (
                          getNotificationIcon(n.type)
                        )}
                      </div>
                      <div className="notification-content">
                        <div className="notification-title-text">{n.title}</div>
                        <div className="notification-message">{n.message}</div>
                        <div className="notification-time">{formatTime(n.timestamp)}</div>
                      </div>
                      <button 
                        className="notification-dismiss" 
                        onClick={(e) => { e.stopPropagation(); dismissNotification(n.id); }}
                        title="Dismiss"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
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
