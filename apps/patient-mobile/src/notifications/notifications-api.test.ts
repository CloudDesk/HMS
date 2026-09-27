import { describe, expect, it, vi } from 'vitest';
import type { SessionManager } from '../auth/session-manager';
import { NotificationsApi } from './notifications-api';

describe('NotificationsApi', () => {
  const sampleNotificationsResponse = {
    data: [
      {
        id: 'notif-1',
        title: 'Appointment Confirmed',
        message: 'Your visit is confirmed for tomorrow',
        type: 'CALL_NEXT_PATIENT',
        is_read: false,
        created_at: '2026-09-24T10:00:00.000Z',
      },
    ],
    meta: {
      total: 1,
      page: 1,
      limit: 50,
      totalPages: 1,
    },
  };

  it('listNotifications calls /notifications/me with query params', async () => {
    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(sampleNotificationsResponse),
    } as unknown as SessionManager;

    const api = new NotificationsApi(mockSessionManager);
    const result = await api.listNotifications(false, 1, 50);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.title).toBe('Appointment Confirmed');
    expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
      '/notifications/me',
      expect.anything(),
      {
        query: {
          is_read: 'false',
          page: '1',
          limit: '50',
        },
      }
    );
  });

  it('getUnreadCount retrieves unread total', async () => {
    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(sampleNotificationsResponse),
    } as unknown as SessionManager;

    const api = new NotificationsApi(mockSessionManager);
    const count = await api.getUnreadCount();

    expect(count).toBe(1);
    expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
      '/notifications/me',
      expect.anything(),
      {
        query: {
          is_read: 'false',
          limit: '1',
        },
      }
    );
  });

  it('markAsRead calls PATCH /notifications/:id/read', async () => {
    const updatedNotif = {
      ...sampleNotificationsResponse.data[0],
      is_read: true,
    };
    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(updatedNotif),
    } as unknown as SessionManager;

    const api = new NotificationsApi(mockSessionManager);
    const result = await api.markAsRead('notif-1');

    expect(result.is_read).toBe(true);
    expect(mockSessionManager.authenticatedRequest).toHaveBeenCalledWith(
      '/notifications/notif-1/read',
      expect.anything(),
      {
        method: 'PATCH',
      }
    );
  });

  it('throws when response schema does not match', async () => {
    const invalidResponse = {
      data: [{ id: 'notif-1' }], // missing required fields
    };
    const mockSessionManager = {
      authenticatedRequest: vi.fn().mockResolvedValue(invalidResponse),
    } as unknown as SessionManager;

    const api = new NotificationsApi(mockSessionManager);
    await expect(api.listNotifications()).rejects.toThrow();
  });
});
