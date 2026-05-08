import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, AlertCircle, X } from 'lucide-react';
import { useNotificationStore, type Notification } from '../../stores/notificationStore';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import './ToastNotification.css';

const TOAST_DURATION = 4500; // ms

interface ToastItemProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ notification: n, onDismiss }) => {
  const [exiting, setExiting] = useState(false);
  const focusNodeFn = useAIConfigStore((s) => s.focusNodeFn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = () => {
    setExiting(true);
    setTimeout(() => onDismiss(n.id), 280);
  };

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, TOAST_DURATION);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleClick = () => {
    if (n.nodeId && focusNodeFn) {
      focusNodeFn(n.nodeId);
    }
    dismiss();
  };

  return (
    <div
      className={`toast-item toast-${n.type}${exiting ? ' toast-exit' : ''}${n.nodeId ? ' toast-clickable' : ''}`}
      onClick={handleClick}
      role="status"
      aria-live="polite"
    >
      <div className="toast-thumb-wrap">
        {n.imageUrl ? (
          <img src={n.imageUrl} alt="" className="toast-thumb" />
        ) : n.type === 'success' ? (
          <Sparkles size={16} className="toast-icon success" />
        ) : (
          <AlertCircle size={16} className="toast-icon error" />
        )}
      </div>
      <div className="toast-body">
        <div className="toast-title">{n.title}</div>
        {n.message && <div className="toast-msg">{n.message}</div>}
        {n.nodeId && <div className="toast-hint">Click to view ↗</div>}
      </div>
      <button
        className="toast-close"
        onClick={(e) => { e.stopPropagation(); dismiss(); }}
        title="Dismiss"
        aria-label="Dismiss notification"
      >
        <X size={11} />
      </button>
      <div className="toast-progress" style={{ animationDuration: `${TOAST_DURATION}ms` }} />
    </div>
  );
};

export const ToastNotification: React.FC = () => {
  const notifications = useNotificationStore((s) => s.notifications);
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  // Watch for new notifications and add them to visible list
  useEffect(() => {
    notifications.forEach((n) => {
      if (!seenRef.current.has(n.id)) {
        seenRef.current.add(n.id);
        setVisibleIds((prev) => [...prev, n.id]);
      }
    });
  }, [notifications]);

  const handleDismiss = (id: string) => {
    setVisibleIds((prev) => prev.filter((v) => v !== id));
  };

  const visible = notifications.filter((n) => visibleIds.includes(n.id));

  if (visible.length === 0) return null;

  return (
    <div className="toast-container" aria-label="Notifications">
      {visible.map((n) => (
        <ToastItem key={n.id} notification={n} onDismiss={handleDismiss} />
      ))}
    </div>
  );
};
