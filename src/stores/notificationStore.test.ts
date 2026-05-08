/**
 * Notification Store Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useNotificationStore } from './notificationStore';

describe('notificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [], unreadCount: 0 });
  });

  describe('initial state', () => {
    it('should have empty notifications', () => {
      const { notifications, unreadCount } = useNotificationStore.getState();
      expect(notifications).toEqual([]);
      expect(unreadCount).toBe(0);
    });
  });

  describe('addNotification', () => {
    it('should add notification', () => {
      const { addNotification } = useNotificationStore.getState();
      
      addNotification({
        type: 'success',
        title: 'Test',
        message: 'Test message',
      });
      
      const { notifications } = useNotificationStore.getState();
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('success');
      expect(notifications[0].title).toBe('Test');
      expect(notifications[0].read).toBe(false);
    });

    it('should increment unread count', () => {
      const { addNotification } = useNotificationStore.getState();
      
      addNotification({
        type: 'success',
        title: 'Test',
        message: 'Test message',
      });
      
      expect(useNotificationStore.getState().unreadCount).toBe(1);
    });

    it('should add to beginning of list', () => {
      const { addNotification } = useNotificationStore.getState();
      
      addNotification({
        type: 'success',
        title: 'First',
        message: 'First message',
      });
      
      addNotification({
        type: 'error',
        title: 'Second',
        message: 'Second message',
      });
      
      const { notifications } = useNotificationStore.getState();
      expect(notifications[0].title).toBe('Second');
      expect(notifications[1].title).toBe('First');
    });

    it('should limit to 50 notifications', () => {
      const { addNotification } = useNotificationStore.getState();
      
      for (let i = 0; i < 60; i++) {
        addNotification({
          type: 'info',
          title: `Test ${i}`,
          message: `Message ${i}`,
        });
      }
      
      const { notifications } = useNotificationStore.getState();
      expect(notifications.length).toBeLessThanOrEqual(50);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', () => {
      const { addNotification, markAsRead } = useNotificationStore.getState();
      
      addNotification({
        type: 'success',
        title: 'Test',
        message: 'Test message',
      });
      
      const id = useNotificationStore.getState().notifications[0].id;
      markAsRead(id);
      
      expect(useNotificationStore.getState().notifications[0].read).toBe(true);
    });

    it('should decrement unread count', () => {
      const { addNotification, markAsRead } = useNotificationStore.getState();
      
      addNotification({
        type: 'success',
        title: 'Test',
        message: 'Test message',
      });
      
      const id = useNotificationStore.getState().notifications[0].id;
      markAsRead(id);
      
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', () => {
      const { addNotification, markAllAsRead } = useNotificationStore.getState();
      
      addNotification({
        type: 'success',
        title: 'Test 1',
        message: 'Message 1',
      });
      
      addNotification({
        type: 'error',
        title: 'Test 2',
        message: 'Message 2',
      });
      
      markAllAsRead();
      
      const { notifications } = useNotificationStore.getState();
      expect(notifications.every(n => n.read)).toBe(true);
    });

    it('should reset unread count to 0', () => {
      const { addNotification, markAllAsRead } = useNotificationStore.getState();
      
      addNotification({
        type: 'success',
        title: 'Test',
        message: 'Test message',
      });
      
      markAllAsRead();
      
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });
  });

  describe('dismissNotification', () => {
    it('should remove notification', () => {
      const { addNotification, dismissNotification } = useNotificationStore.getState();
      
      addNotification({
        type: 'success',
        title: 'Test',
        message: 'Test message',
      });
      
      const id = useNotificationStore.getState().notifications[0].id;
      dismissNotification(id);
      
      expect(useNotificationStore.getState().notifications).toHaveLength(0);
    });

    it('should decrement unread count if notification was unread', () => {
      const { addNotification, dismissNotification } = useNotificationStore.getState();
      
      addNotification({
        type: 'success',
        title: 'Test',
        message: 'Test message',
      });
      
      const id = useNotificationStore.getState().notifications[0].id;
      dismissNotification(id);
      
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });

    it('should not decrement unread count if notification was read', () => {
      const { addNotification, markAsRead, dismissNotification } = useNotificationStore.getState();
      
      addNotification({
        type: 'success',
        title: 'Test',
        message: 'Test message',
      });
      
      const id = useNotificationStore.getState().notifications[0].id;
      markAsRead(id);
      dismissNotification(id);
      
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });
  });

  describe('clearAll', () => {
    it('should clear all notifications', () => {
      const { addNotification, clearAll } = useNotificationStore.getState();
      
      addNotification({
        type: 'success',
        title: 'Test',
        message: 'Test message',
      });
      
      clearAll();
      
      expect(useNotificationStore.getState().notifications).toEqual([]);
    });

    it('should reset unread count', () => {
      const { addNotification, clearAll } = useNotificationStore.getState();
      
      addNotification({
        type: 'success',
        title: 'Test',
        message: 'Test message',
      });
      
      clearAll();
      
      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });
  });
});
