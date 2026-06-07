import React, { useEffect, useRef } from 'react';
import {
  Bell, X, CheckCheck, Trash2,
  Sparkles, AlertCircle, Info, AlertTriangle,
  ChevronRight, Inbox,
} from 'lucide-react';
import { useNotificationStore, type Notification } from '../../stores/notificationStore';
import './NotificationCenter.css';

// ── Type icon ─────────────────────────────────────────────────────────────

const TypeIcon: React.FC<{ type: Notification['type']; size?: number }> = ({ type, size = 14 }) => {
  if (type === 'success') return <Sparkles  size={size} className={`nc-type-icon nc-icon--success`} />;
  if (type === 'error')   return <AlertCircle size={size} className={`nc-type-icon nc-icon--error`} />;
  if (type === 'warning') return <AlertTriangle size={size} className={`nc-type-icon nc-icon--warning`} />;
  return <Info size={size} className={`nc-type-icon nc-icon--info`} />;
};

// ── Time formatting ───────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

// ── Single notification row ───────────────────────────────────────────────

const NotifRow: React.FC<{ n: Notification }> = ({ n }) => {
  const { markAsRead, dismissNotification } = useNotificationStore();

  const handleClick = () => {
    markAsRead(n.id);
    if (n.action) n.action.onClick();
  };

  return (
    <div
      className={`nc-row nc-row--${n.type}${n.read ? '' : ' nc-row--unread'}${n.action || n.nodeId ? ' nc-row--clickable' : ''}`}
      onClick={handleClick}
      role={n.action ? 'button' : undefined}
      tabIndex={n.action ? 0 : undefined}
      onKeyDown={e => { if (n.action && (e.key === 'Enter' || e.key === ' ')) handleClick(); }}
    >
      <div className="nc-row-left">
        {n.imageUrl
          ? <img src={n.imageUrl} alt="" className="nc-row-thumb" />
          : <div className="nc-row-icon-wrap"><TypeIcon type={n.type} size={14} /></div>
        }
      </div>

      <div className="nc-row-body">
        <div className="nc-row-title">{n.title}</div>
        {n.message && <div className="nc-row-msg">{n.message}</div>}
        {n.action && (
          <button
            className="nc-row-action"
            onClick={e => { e.stopPropagation(); n.action!.onClick(); markAsRead(n.id); }}
          >
            {n.action.label} <ChevronRight size={10} />
          </button>
        )}
        <div className="nc-row-time">{timeAgo(n.timestamp)}</div>
      </div>

      <div className="nc-row-right">
        {!n.read && <span className="nc-unread-dot" aria-label="Unread" />}
        <button
          className="nc-row-dismiss"
          title="Dismiss"
          aria-label="Dismiss"
          onClick={e => { e.stopPropagation(); dismissNotification(n.id); }}
        >
          <X size={11} />
        </button>
      </div>
    </div>
  );
};

// ── Bell button (exported separately for NavRail) ─────────────────────────

export const NotificationBell: React.FC = () => {
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const togglePanel = useNotificationStore((s) => s.togglePanel);

  return (
    <button
      className="nc-bell-btn"
      onClick={togglePanel}
      aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      title="Notifications"
    >
      <Bell size={18} />
      {unreadCount > 0 && (
        <span className="nc-bell-badge" aria-hidden="true">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};

// ── Notification Center Panel ─────────────────────────────────────────────

export const NotificationCenter: React.FC = () => {
  const panelOpen      = useNotificationStore((s) => s.panelOpen);
  const notifications  = useNotificationStore((s) => s.notifications);
  const unreadCount    = useNotificationStore((s) => s.unreadCount);
  const markAllAsRead  = useNotificationStore((s) => s.markAllAsRead);
  const clearAll       = useNotificationStore((s) => s.clearAll);
  const setPanelOpen   = useNotificationStore((s) => s.setPanelOpen);
  const panelRef       = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [panelOpen, setPanelOpen]);

  // Close on Escape
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setPanelOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [panelOpen, setPanelOpen]);

  if (!panelOpen) return null;

  return (
    <div className="nc-panel" ref={panelRef} role="dialog" aria-label="Notification center">
      {/* Header */}
      <div className="nc-header">
        <div className="nc-header-left">
          <Bell size={15} className="nc-header-icon" />
          <span className="nc-header-title">Notifications</span>
          {unreadCount > 0 && <span className="nc-header-badge">{unreadCount}</span>}
        </div>
        <div className="nc-header-actions">
          {unreadCount > 0 && (
            <button className="nc-hdr-btn" onClick={markAllAsRead} title="Mark all as read">
              <CheckCheck size={14} />
            </button>
          )}
          {notifications.length > 0 && (
            <button className="nc-hdr-btn nc-hdr-btn--danger" onClick={clearAll} title="Clear all">
              <Trash2 size={14} />
            </button>
          )}
          <button className="nc-hdr-btn" onClick={() => setPanelOpen(false)} title="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="nc-body">
        {notifications.length === 0 ? (
          <div className="nc-empty">
            <Inbox size={32} className="nc-empty-icon" />
            <span>All caught up!</span>
          </div>
        ) : (
          <div className="nc-list">
            {notifications.map((n) => (
              <NotifRow key={n.id} n={n} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
