/**
 * Notification Store - Zustand
 * Replaces NotificationContext for better performance
 */

import { create } from 'zustand';

// ── Types ────────────────────────────────────────────────────────────────────

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  nodeId?: string;
  imageUrl?: string;
}

// ── Store State ──────────────────────────────────────────────────────────────

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  
  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
}

// ── Store Creation ─────────────────────────────────────────────────────────────

let idCounter = 0;

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  
  addNotification: (notification) => {
    const id = `notif_${++idCounter}_${Date.now()}`;
    set((state) => ({
      notifications: [
        {
          ...notification,
          id,
          timestamp: Date.now(),
          read: false,
        },
        ...state.notifications,
      ].slice(0, 50), // Keep max 50 notifications
      unreadCount: state.unreadCount + 1,
    }));
  },
  
  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: state.unreadCount - 1,
    }));
  },
  
  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },
  
  dismissNotification: (id) => {
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      return {
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: notification && !notification.read 
          ? state.unreadCount - 1 
          : state.unreadCount,
      };
    });
  },
  
  clearAll: () => {
    set({ notifications: [], unreadCount: 0 });
  },
}));

// ── Selectors (for performance) ───────────────────────────────────────────────

export const selectNotifications = (state: NotificationState) => state.notifications;
export const selectUnreadCount = (state: NotificationState) => state.unreadCount;
export const selectUnreadNotifications = (state: NotificationState) => 
  state.notifications.filter((n) => !n.read);
