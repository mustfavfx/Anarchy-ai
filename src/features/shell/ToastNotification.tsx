import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Sparkles, AlertCircle, Info, AlertTriangle, X, ChevronRight } from 'lucide-react';
import { useNotificationStore, type Notification } from '../../stores/notificationStore';
import { useAIConfigStore } from '../../stores/aiConfigStore';
import { useResolvedImage } from '../../hooks/useResolvedImage';
import './ToastNotification.css';

const DEFAULT_DURATION = 5000;
const MAX_VISIBLE = 5;

interface ToastItemProps {
  notification: Notification;
  onDismiss: (id: string) => void;
}

const TypeIcon: React.FC<{ type: Notification['type'] }> = ({ type }) => {
  if (type === 'success') return <Sparkles size={15} className="toast-icon success" />;
  if (type === 'error')   return <AlertCircle size={15} className="toast-icon error" />;
  if (type === 'warning') return <AlertTriangle size={15} className="toast-icon warning" />;
  return <Info size={15} className="toast-icon info" />;
};

const ToastItem: React.FC<ToastItemProps> = ({ notification: n, onDismiss }) => {
  const [exiting, setExiting] = useState(false);
  const [paused, setPaused]   = useState(false);
  const focusNodeFn = useAIConfigStore((s) => s.focusNodeFn);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef    = useRef<number>(0);
  const remainRef   = useRef<number>(n.duration ?? DEFAULT_DURATION);
  const duration    = n.duration ?? DEFAULT_DURATION;
  const resolvedImageUrl = useResolvedImage(n.imageUrl);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(n.id), 280);
  }, [n.id, onDismiss]);

  const startTimer = useCallback(() => {
    if (remainRef.current === 0) return; // persistent
    startRef.current = Date.now();
    timerRef.current = setTimeout(dismiss, remainRef.current);
  }, [dismiss]);

  const pauseTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      remainRef.current = Math.max(0, remainRef.current - (Date.now() - startRef.current));
    }
    setPaused(true);
  };

  const resumeTimer = () => {
    setPaused(false);
    startTimer();
  };

  useEffect(() => {
    if (duration === 0) return; // persistent notification
    startTimer();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClick = () => {
    if (n.nodeId && focusNodeFn) focusNodeFn(n.nodeId);
    if (n.action) { n.action.onClick(); dismiss(); }
    else if (n.nodeId) dismiss();
  };

  const isClickable = !!(n.nodeId || n.action);

  return (
    <div
      className={`toast-item toast-${n.type}${exiting ? ' toast-exit' : ''}${isClickable ? ' toast-clickable' : ''}${paused ? ' toast-paused' : ''}`}
      onClick={isClickable ? handleClick : undefined}
      onMouseEnter={duration > 0 ? pauseTimer : undefined}
      onMouseLeave={duration > 0 ? resumeTimer : undefined}
      role="status"
      aria-live="polite"
    >
      <div className="toast-thumb-wrap">
        {resolvedImageUrl
          ? <img src={resolvedImageUrl} alt="" className="toast-thumb" />
          : <TypeIcon type={n.type} />
        }
      </div>
      <div className="toast-body">
        <div className="toast-title">{n.title}</div>
        {n.message && <div className="toast-msg">{n.message}</div>}
        {n.action && (
          <button
            className="toast-action-btn"
            onClick={(e) => { e.stopPropagation(); n.action!.onClick(); dismiss(); }}
          >
            {n.action.label} <ChevronRight size={11} />
          </button>
        )}
        {n.nodeId && !n.action && <div className="toast-hint">Click to view ↗</div>}
      </div>
      <button
        className="toast-close"
        onClick={(e) => { e.stopPropagation(); dismiss(); }}
        title="Dismiss"
        aria-label="Dismiss notification"
      >
        <X size={11} />
      </button>
      {duration > 0 && (
        <div
          className={`toast-progress toast-progress--${n.type}${paused ? ' toast-progress-paused' : ''}`}
          style={{ animationDuration: `${duration}ms` }}
        />
      )}
    </div>
  );
};

export const ToastNotification: React.FC = () => {
  const notifications = useNotificationStore((s) => s.notifications);
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    notifications.forEach((n) => {
      if (!seenRef.current.has(n.id)) {
        seenRef.current.add(n.id);
        setVisibleIds((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), n.id]);
      }
    });
  }, [notifications]);

  const handleDismiss = (id: string) => {
    setVisibleIds((prev) => prev.filter((v) => v !== id));
  };

  const visible = notifications.filter((n) => visibleIds.includes(n.id));
  if (visible.length === 0) return null;

  return (
    <div className="toast-container" aria-label="Notifications" aria-live="polite">
      {visible.map((n) => (
        <ToastItem key={n.id} notification={n} onDismiss={handleDismiss} />
      ))}
    </div>
  );
};
