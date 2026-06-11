/**
 * Notification Store - Zustand
 * Full-featured in-app notification system
 */

import { create } from 'zustand';

// ── Types ────────────────────────────────────────────────────────────────────

export type NotificationType = 'success' | 'error' | 'info' | 'warning';
export type NotificationCategory = 'generation' | 'export' | 'project' | 'system' | 'credit';

export interface NotificationAction {
  label: string;
  onClick: () => void;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  /** Auto-dismiss duration in ms. 0 = persist until manually dismissed */
  duration?: number;
  nodeId?: string;
  imageUrl?: string;
  category?: NotificationCategory;
  action?: NotificationAction;
}

export type NewNotification = Omit<Notification, 'id' | 'timestamp' | 'read'>;

// ── Store State ──────────────────────────────────────────────────────────────

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  panelOpen: boolean;

  // Actions
  addNotification: (n: NewNotification) => string;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
}

// ── Store Creation ───────────────────────────────────────────────────────────

let idCounter = 0;

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  panelOpen: false,

  addNotification: (notification) => {
    const id = `notif_${++idCounter}_${Date.now()}`;
    set((state) => ({
      notifications: [
        { ...notification, id, timestamp: Date.now(), read: false },
        ...state.notifications,
      ].slice(0, 50),
      unreadCount: state.unreadCount + 1,
    }));
    return id;
  },

  markAsRead: (id) => {
    set((state) => {
      const n = state.notifications.find((x) => x.id === id);
      if (!n || n.read) return state;
      return {
        notifications: state.notifications.map((x) => x.id === id ? { ...x, read: true } : x),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    });
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  dismissNotification: (id) => {
    set((state) => {
      const n = state.notifications.find((x) => x.id === id);
      return {
        notifications: state.notifications.filter((x) => x.id !== id),
        unreadCount: n && !n.read ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
      };
    });
  },

  clearAll: () => set({ notifications: [], unreadCount: 0 }),

  setPanelOpen: (open) => set({ panelOpen: open }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
}));

// ── Selectors ────────────────────────────────────────────────────────────────

export const selectNotifications = (state: NotificationState) => state.notifications;
export const selectUnreadCount = (state: NotificationState) => state.unreadCount;
export const selectUnreadNotifications = (state: NotificationState) =>
  state.notifications.filter((n) => !n.read);

// ── Convenience helpers ───────────────────────────────────────────────────────

export const notify = {
  success: (title: string, message = '', extras?: Partial<NewNotification>) =>
    useNotificationStore.getState().addNotification({ type: 'success', title, message, duration: 5000, ...extras }),
  error: (title: string, message = '', extras?: Partial<NewNotification>) =>
    useNotificationStore.getState().addNotification({ type: 'error', title, message, duration: 0, ...extras }),
  info: (title: string, message = '', extras?: Partial<NewNotification>) =>
    useNotificationStore.getState().addNotification({ type: 'info', title, message, duration: 4000, ...extras }),
  warning: (title: string, message = '', extras?: Partial<NewNotification>) =>
    useNotificationStore.getState().addNotification({ type: 'warning', title, message, duration: 6000, ...extras }),
};
